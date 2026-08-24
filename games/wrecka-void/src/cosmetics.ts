export type WreckCosmeticId = "standard" | "founder-ember";

export const WRECK_COSMETICS: Record<
  WreckCosmeticId,
  {
    player: string;
    playerEdge: string;
    glow: string;
    ball: string;
    ballEdge: string;
    chain: string;
    link: string;
  }
> = {
  standard: {
    player: "#ffffff",
    playerEdge: "#cccccc",
    glow: "#4444ff",
    ball: "#cccccc",
    ballEdge: "#888888",
    chain: "#777777",
    link: "#999999",
  },
  "founder-ember": {
    player: "#f4f1df",
    playerEdge: "#20c9bd",
    glow: "#ff6c4a",
    ball: "#ff7957",
    ballEdge: "#e7ff4f",
    chain: "#20c9bd",
    link: "#ff9a73",
  },
};
