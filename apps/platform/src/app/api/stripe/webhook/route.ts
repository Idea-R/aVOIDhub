import type Stripe from 'stripe'
import { NextResponse, type NextRequest } from 'next/server'
import { getStripe, requireStripeWebhookSecret } from '@/lib/stripe/server'
import { syncSubscription } from '@/lib/stripe/subscriptions'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'missing_signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, requireStripeWebhookSecret())
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('stripe_webhook_events')
    .select('processed_at')
    .eq('event_id', event.id)
    .maybeSingle()
  if (existing?.processed_at) return NextResponse.json({ received: true, duplicate: true })

  await admin.from('stripe_webhook_events').upsert({
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    processing_error: null,
  }, { onConflict: 'event_id' })

  try {
    if (event.type.startsWith('customer.subscription.')) {
      await syncSubscription(event.data.object as Stripe.Subscription)
    } else if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      if (subscriptionId) await syncSubscription(await getStripe().subscriptions.retrieve(subscriptionId))
    }

    await admin.from('stripe_webhook_events').update({
      processed_at: new Date().toISOString(),
      processing_error: null,
    }).eq('event_id', event.id)
  } catch (error) {
    await admin.from('stripe_webhook_events').update({
      processing_error: error instanceof Error ? error.message.slice(0, 500) : 'unknown_error',
    }).eq('event_id', event.id)
    return NextResponse.json({ error: 'webhook_processing_failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

