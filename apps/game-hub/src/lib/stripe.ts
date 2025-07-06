import { loadStripe } from '@stripe/stripe-js'

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

export { stripePromise }

// Stripe configuration
export const STRIPE_CONFIG = {
  // Pro membership price (monthly)
  PRO_PRICE_ID: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1234567890',
  
  // Features
  PRO_FEATURES: [
    'Remove all advertisements',
    'Custom social media links on profile',
    'Access to global leaderboards',
    'Exclusive pro member badge',
    'Priority support',
    'Early access to new games'
  ],
  
  // Pricing
  PRO_PRICE: '$4.99',
  PRO_PRICE_CENTS: 499,
  
  // Trial
  TRIAL_DAYS: 7
}

// Stripe helper functions
export const createCheckoutSession = async (priceId: string, userId: string) => {
  try {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
        successUrl: `${window.location.origin}/profile?upgrade=success`,
        cancelUrl: `${window.location.origin}/profile?upgrade=cancelled`
      })
    })
    
    const { sessionId } = await response.json()
    
    const stripe = await stripePromise
    if (!stripe) throw new Error('Stripe not loaded')
    
    const { error } = await stripe.redirectToCheckout({ sessionId })
    
    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error creating checkout session:', error)
    throw error
  }
}

export const createCustomerPortalSession = async (customerId: string) => {
  try {
    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        returnUrl: `${window.location.origin}/profile`
      })
    })
    
    const { url } = await response.json()
    window.location.href = url
  } catch (error) {
    console.error('Error creating portal session:', error)
    throw error
  }
}
