export const membershipPlans = {
  player: {
    key: 'player',
    name: 'Founding player',
    audience: 'For people who play here',
    description: 'Remove platform ads, collect profile flair, and help fund the next strange little game.',
    entitlements: ['Ad-free platform pages', 'Founding profile mark', 'Early experiments', 'Supporter cosmetics'],
  },
  creator: {
    key: 'creator',
    name: 'Creator',
    audience: 'For people who make games',
    description: 'Build a creator page, submit games for review, and prepare an aVOID-hosted release.',
    entitlements: ['Everything in Founding player', 'Creator profile', 'Game submissions', 'Hosting review queue'],
  },
} as const

export type MembershipPlanKey = keyof typeof membershipPlans

export function isMembershipPlanKey(value: unknown): value is MembershipPlanKey {
  return typeof value === 'string' && value in membershipPlans
}

export function getStripePriceId(plan: MembershipPlanKey): string | null {
  const value = plan === 'player'
    ? process.env.STRIPE_PLAYER_PRICE_ID
    : process.env.STRIPE_CREATOR_PRICE_ID
  return value?.trim() || null
}

export function getMembershipPriceLabel(plan: MembershipPlanKey): string {
  const value = plan === 'player'
    ? process.env.NEXT_PUBLIC_PLAYER_PRICE_LABEL
    : process.env.NEXT_PUBLIC_CREATOR_PRICE_LABEL
  return value?.trim() || 'Price set at launch'
}
