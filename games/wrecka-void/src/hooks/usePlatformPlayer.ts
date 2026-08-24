import { useEffect, useState } from "react";
import {
  fetchPlatformPlayer,
  type PlatformPlayerContext,
} from "../api/playerContext";
import type { WreckCosmeticId } from "../cosmetics";

const GUEST_CONTEXT: PlatformPlayerContext = {
  authenticated: false,
  player: null,
  entitlements: [],
  cosmetics: null,
};

function storedCosmetic(): WreckCosmeticId {
  return window.localStorage.getItem("wreckavoid:cosmetic:v1") ===
    "founder-ember"
    ? "founder-ember"
    : "standard";
}

export function usePlatformPlayer() {
  const [context, setContext] = useState(GUEST_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [cosmetic, setCosmetic] = useState<WreckCosmeticId>(storedCosmetic);

  useEffect(() => {
    let active = true;
    void fetchPlatformPlayer().then((next) => {
      if (!active) return;
      setContext(next);
      const selected = storedCosmetic();
      const unlocked = next.cosmetics?.wreckavoid.some(
        (option) => option.id === selected && option.unlocked,
      );
      if (!unlocked && selected !== "standard") {
        window.localStorage.setItem("wreckavoid:cosmetic:v1", "standard");
        setCosmetic("standard");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const selectCosmetic = (next: WreckCosmeticId) => {
    const unlocked =
      next === "standard" ||
      context.cosmetics?.wreckavoid.some(
        (option) => option.id === next && option.unlocked,
      );
    if (!unlocked) return false;
    window.localStorage.setItem("wreckavoid:cosmetic:v1", next);
    setCosmetic(next);
    return true;
  };

  return { ...context, loading, cosmetic, selectCosmetic };
}
