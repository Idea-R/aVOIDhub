export const membershipPlans = {
  player: {
    key: "player",
    name: "Founding player",
    audience: "For people who play here",
    description:
      "Help fund the next odd little game and make the platform feel more like yours.",
    entitlements: [
      "No display ads on eligible aVOID pages",
      "A permanent Founding Player profile mark",
      "Member cosmetics as supported games add them",
      "Early access to selected experiments",
    ],
  },
  creator: {
    key: "creator",
    name: "Creator",
    audience: "For approved game makers",
    description:
      "Use the private submission and hosting workflow after your free creator application is approved.",
    entitlements: [
      "Everything in Founding Player",
      "Private game submissions",
      "Directory, subdomain, or managed-build review",
      "Hosting and monetization readiness checks",
    ],
  },
} as const;

export type MembershipPlanKey = keyof typeof membershipPlans;

export function isMembershipPlanKey(
  value: unknown,
): value is MembershipPlanKey {
  return typeof value === "string" && value in membershipPlans;
}

export function getStripePriceId(plan: MembershipPlanKey): string | null {
  const value =
    plan === "player"
      ? process.env.STRIPE_PLAYER_PRICE_ID
      : process.env.STRIPE_CREATOR_PRICE_ID;
  return value?.trim() || null;
}

export function getMembershipPriceLabel(plan: MembershipPlanKey): string {
  const value =
    plan === "player"
      ? process.env.NEXT_PUBLIC_PLAYER_PRICE_LABEL
      : process.env.NEXT_PUBLIC_CREATOR_PRICE_LABEL;
  return value?.trim() || "Price set at launch";
}
