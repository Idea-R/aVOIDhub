import { useEffect, useState } from "react";
import {
  fetchPlatformPlayer,
  type PlatformPlayerContext,
  type TankCosmeticId,
} from "./api/playerContext";

const GUEST_CONTEXT: PlatformPlayerContext = {
  authenticated: false,
  player: null,
  entitlements: [],
  cosmetics: null,
};

function storedCosmetic(): TankCosmeticId {
  return localStorage.getItem("tankavoid:cosmetic:v1") === "founder-meteor"
    ? "founder-meteor"
    : "standard";
}

export function usePlatformPlayer() {
  const [context, setContext] = useState(GUEST_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [cosmetic, setCosmetic] = useState<TankCosmeticId>(storedCosmetic);

  useEffect(() => {
    let active = true;
    void fetchPlatformPlayer().then((next) => {
      if (!active) return;
      setContext(next);
      const selected = storedCosmetic();
      const unlocked = next.cosmetics?.tankavoid.some(
        (option) => option.id === selected && option.unlocked,
      );
      if (!unlocked && selected !== "standard") {
        localStorage.setItem("tankavoid:cosmetic:v1", "standard");
        setCosmetic("standard");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const selectCosmetic = (next: TankCosmeticId) => {
    const unlocked =
      next === "standard" ||
      context.cosmetics?.tankavoid.some(
        (option) => option.id === next && option.unlocked,
      );
    if (!unlocked) return false;
    localStorage.setItem("tankavoid:cosmetic:v1", next);
    setCosmetic(next);
    return true;
  };

  return { ...context, loading, cosmetic, selectCosmetic };
}
