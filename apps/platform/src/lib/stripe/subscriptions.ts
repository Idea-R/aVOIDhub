import 'server-only'

import type Stripe from 'stripe'
import { getStripePriceId, isMembershipPlanKey, type MembershipPlanKey } from '@/lib/membership'
import { createAdminClient } from '@/lib/supabase/admin'

const entitlementStatuses = new Set<Stripe.Subscription.Status>(['active', 'trialing'])

function planFromSubscription(subscription: Stripe.Subscription): MembershipPlanKey | null {
  const metadataPlan = subscription.metadata.plan_key
  if (isMembershipPlanKey(metadataPlan)) return metadataPlan

  const priceId = subscription.items.data[0]?.price.id
  if (priceId === getStripePriceId('player')) return 'player'
  if (priceId === getStripePriceId('creator')) return 'creator'
  return null
}

function userFromSubscription(subscription: Stripe.Subscription): string | null {
  return subscription.metadata.supabase_user_id || null
}

async function rebuildSubscriptionEntitlements(userId: string) {
  const admin = createAdminClient()
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from('billing_subscriptions')
    .select('plan_key, status, stripe_subscription_id')
    .eq('user_id', userId)

  if (subscriptionsError) throw subscriptionsError
  const active = (subscriptions ?? []).filter((item) => entitlementStatuses.has(item.status as Stripe.Subscription.Status))
  const planKeys = [...new Set(active.map((item) => item.plan_key))]
  const desired = new Map<string, string>()

  if (planKeys.length) {
    const { data: planEntitlements, error } = await admin
      .from('plan_entitlements')
      .select('plan_key, entitlement_key')
      .in('plan_key', planKeys)
    if (error) throw error

    for (const item of planEntitlements ?? []) {
      const source = active.find((subscription) => subscription.plan_key === item.plan_key)
      if (source) desired.set(item.entitlement_key, source.stripe_subscription_id)
    }
  }

  const { data: existing, error: existingError } = await admin
    .from('user_entitlements')
    .select('entitlement_key')
    .eq('user_id', userId)
    .eq('source', 'subscription')
  if (existingError) throw existingError

  const obsolete = (existing ?? []).filter((item) => !desired.has(item.entitlement_key))
  for (const item of obsolete) {
    const { error } = await admin
      .from('user_entitlements')
      .delete()
      .eq('user_id', userId)
      .eq('entitlement_key', item.entitlement_key)
      .eq('source', 'subscription')
    if (error) throw error
  }

  if (desired.size) {
    const now = new Date().toISOString()
    const { error } = await admin.from('user_entitlements').upsert(
      [...desired].map(([entitlementKey, sourceReference]) => ({
        user_id: userId,
        entitlement_key: entitlementKey,
        source: 'subscription',
        source_reference: sourceReference,
        starts_at: now,
        expires_at: null,
        updated_at: now,
      })),
      { onConflict: 'user_id,entitlement_key' },
    )
    if (error) throw error
  }
}

export async function syncSubscription(subscription: Stripe.Subscription) {
  const admin = createAdminClient()
  let userId = userFromSubscription(subscription)
  let planKey = planFromSubscription(subscription)

  if (!userId || !planKey) {
    const { data: existing } = await admin
      .from('billing_subscriptions')
      .select('user_id, plan_key')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()
    userId ||= existing?.user_id ?? null
    planKey ||= isMembershipPlanKey(existing?.plan_key) ? existing.plan_key : null
  }

  if (!userId || !planKey) throw new Error(`Subscription ${subscription.id} is missing platform metadata.`)
  const firstItem = subscription.items.data[0]
  const periodEnd = firstItem?.current_period_end

  const { error } = await admin.from('billing_subscriptions').upsert({
    stripe_subscription_id: subscription.id,
    user_id: userId,
    plan_key: planKey,
    stripe_price_id: firstItem?.price.id ?? null,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_subscription_id' })
  if (error) throw error

  await rebuildSubscriptionEntitlements(userId)
}

