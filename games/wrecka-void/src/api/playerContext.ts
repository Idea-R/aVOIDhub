import type { WreckCosmeticId } from "../cosmetics";

export interface PlatformPlayer {
  id: string;
  username: string;
  displayName: string;
}

export interface CosmeticOption {
  id: WreckCosmeticId;
  name: string;
  description: string;
  unlocked: boolean;
}

export interface PlatformPlayerContext {
  authenticated: boolean;
  player: PlatformPlayer | null;
  entitlements: string[];
  cosmetics: { wreckavoid: CosmeticOption[] } | null;
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
