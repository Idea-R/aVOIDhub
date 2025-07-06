// Stripe Webhook Handler
// Handles subscription events from Stripe

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sig = req.headers['stripe-signature']
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)
  } catch (err: any) {
    console.log(`Webhook signature verification failed.`, err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      await handleSubscriptionChange(subscription)
      break
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await handleSubscriptionCancelled(subscription)
      break
    }
    
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      await handlePaymentSucceeded(invoice)
      break
    }
    
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await handlePaymentFailed(invoice)
      break
    }
    
    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  res.status(200).json({ received: true })
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.supabase_user_id
  if (!userId) return

  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000)

  await supabase
    .from('user_profiles')
    .update({
      is_pro_member: isActive,
      subscription_status: subscription.status,
      subscription_expires_at: currentPeriodEnd.toISOString()
    })
    .eq('id', userId)

  console.log(`Updated subscription for user ${userId}: ${subscription.status}`)
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.supabase_user_id
  if (!userId) return

  await supabase
    .from('user_profiles')
    .update({
      is_pro_member: false,
      subscription_status: 'cancelled'
    })
    .eq('id', userId)

  console.log(`Cancelled subscription for user ${userId}`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle successful payment
  console.log(`Payment succeeded for invoice ${invoice.id}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Handle failed payment
  console.log(`Payment failed for invoice ${invoice.id}`)
  
  const subscription = invoice.subscription as string
  if (subscription) {
    const sub = await stripe.subscriptions.retrieve(subscription)
    const userId = sub.metadata.supabase_user_id
    
    if (userId) {
      // Could send email notification or update user status
      console.log(`Payment failed for user ${userId}`)
    }
  }
}
