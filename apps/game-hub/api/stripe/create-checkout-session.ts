// Stripe Checkout Session Creation
// This would typically be deployed as a Vercel/Netlify function or backend API

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { priceId, userId, successUrl, cancelUrl } = req.body

    // Get user data from Supabase
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if user already has a Stripe customer ID
    let customerId = user.stripe_customer_id

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.display_name || user.username,
        metadata: {
          supabase_user_id: userId
        }
      })
      customerId = customer.id

      // Update user profile with Stripe customer ID
      await supabase
        .from('user_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      metadata: {
        supabase_user_id: userId
      },
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
        metadata: {
          supabase_user_id: userId
        }
      }
    })

    res.status(200).json({ sessionId: session.id })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
