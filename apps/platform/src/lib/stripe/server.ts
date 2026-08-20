import 'server-only'

import Stripe from 'stripe'

let stripeClient: Stripe | undefined

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient

  const key = process.env.STRIPE_RESTRICTED_KEY?.trim() || process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('Stripe is not configured for the platform runtime.')

  stripeClient = new Stripe(key, {
    apiVersion: '2026-07-29.dahlia',
    typescript: true,
    appInfo: {
      name: 'aVOIDgame.io',
      version: '0.1.0',
      url: 'https://avoidgame.io',
    },
  })
  return stripeClient
}

export function requireStripeWebhookSecret(): string {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!value) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.')
  return value
}
