export const launchCosmetics = {
  wreckavoid: [
    {
      id: "standard",
      name: "Yard steel",
      description: "The original cold-steel wrecking rig.",
      entitlement: null,
    },
    {
      id: "founder-ember",
      name: "Founder ember",
      description: "Hot coral, teal sparks, and a meteor-bright wrecking ball.",
      entitlement: "cosmetics.supporter",
    },
  ],
  tankavoid: [
    {
      id: "standard",
      name: "Field lime",
      description: "The Proving Grounds issue paint.",
      entitlement: null,
    },
    {
      id: "founder-meteor",
      name: "Founder meteor",
      description: "Teal armor, ember trim, and a founder mark on the turret.",
      entitlement: "cosmetics.supporter",
    },
  ],
} as const;

export type LaunchCosmeticGame = keyof typeof launchCosmetics;

export function cosmeticOptions(
  game: LaunchCosmeticGame,
  entitlements: ReadonlySet<string>,
) {
  return launchCosmetics[game].map((cosmetic) => ({
    ...cosmetic,
    unlocked:
      cosmetic.entitlement === null || entitlements.has(cosmetic.entitlement),
  }));
}
