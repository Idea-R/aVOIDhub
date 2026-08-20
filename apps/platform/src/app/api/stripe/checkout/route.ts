import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestUser } from '@/lib/auth/request-user'
import { getSiteUrl } from '@/lib/env'
import { hasAllowedWriteOrigin } from '@/lib/http/same-origin'
import { getStripePriceId, isMembershipPlanKey } from '@/lib/membership'
import { ensureUserProfile } from '@/lib/profiles/server'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({ plan: z.string() })

export async function POST(request: NextRequest) {
  if (!hasAllowedWriteOrigin(request)) return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 })
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'authentication_required', login: '/login/' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isMembershipPlanKey(parsed.data.plan)) {
    return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })
  }
  const priceId = getStripePriceId(parsed.data.plan)
  if (!priceId) return NextResponse.json({ error: 'membership_not_open' }, { status: 503 })

  const profile = await ensureUserProfile(user)
  const admin = createAdminClient()
  const { data: billing, error: billingError } = await admin
    .from('billing_accounts')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (billingError) return NextResponse.json({ error: 'billing_lookup_failed' }, { status: 500 })

  const stripe = getStripe()
  let customerId = billing?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile.username,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    const { error } = await admin.from('billing_accounts').insert({
      user_id: user.id,
      stripe_customer_id: customerId,
    })
    if (error) return NextResponse.json({ error: 'billing_account_failed' }, { status: 500 })
  }

  const siteUrl = getSiteUrl(request.url)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    integration_identifier: 'avoidgame_qmtzrvak',
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${siteUrl}/account/?checkout=success`,
    cancel_url: `${siteUrl}/membership/?checkout=cancelled`,
    metadata: { supabase_user_id: user.id, plan_key: parsed.data.plan },
    subscription_data: { metadata: { supabase_user_id: user.id, plan_key: parsed.data.plan } },
  })

  if (!session.url) return NextResponse.json({ error: 'checkout_unavailable' }, { status: 500 })
  return NextResponse.json({ url: session.url })
}

