export type TankCosmeticId = "standard" | "founder-meteor";

export interface PlatformPlayer {
  id: string;
  username: string;
  displayName: string;
}

export interface TankCosmeticOption {
  id: TankCosmeticId;
  name: string;
  description: string;
  unlocked: boolean;
}

export interface PlatformPlayerContext {
  authenticated: boolean;
  player: PlatformPlayer | null;
  entitlements: string[];
  cosmetics: { tankavoid: TankCosmeticOption[] } | null;
}

export async function fetchPlatformPlayer(): Promise<PlatformPlayerContext> {
  const response = await fetch("/api/v1/player", {
    credentials: "include",
    headers: { accept: "application/json" },
  }).catch(() => null);
  if (!response?.ok) {
    return {
      authenticated: false,
      player: null,
      entitlements: [],
      cosmetics: null,
    };
  }
  return response.json() as Promise<PlatformPlayerContext>;
}
