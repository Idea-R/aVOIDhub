// Stripe Customer Portal Session Creation

import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { customerId, returnUrl } = req.body

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    })

    res.status(200).json({ url: session.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
