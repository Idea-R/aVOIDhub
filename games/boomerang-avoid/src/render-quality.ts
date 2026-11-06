export type RenderQualityMode = "auto" | "high" | "low";
export type AdaptiveTier = 0 | 1 | 2;
export interface RenderQualityState {
  tier: AdaptiveTier;
  lastAt: number | null;
  warmupMs: number;
  windowMs: number;
  samples: number;
  slowSamples: number;
}
export function initialRenderQuality(): RenderQualityState {
  return {
    tier: 0,
    lastAt: null,
    warmupMs: 0,
    windowMs: 0,
    samples: 0,
    slowSamples: 0,
  };
}
/** Pure delivery-time policy: visible samples only; no simulation or wall-clock catch-up. */
export function sampleRenderQuality(
  state: RenderQualityState,
  now: number,
  visible: boolean,
  mode: RenderQualityMode,
): RenderQualityState {
  const reset = (lastAt: number | null): RenderQualityState => ({
    ...state,
    lastAt,
    warmupMs: 0,
    windowMs: 0,
    samples: 0,
    slowSamples: 0,
  });
  if (!Number.isFinite(now) || now < 0 || !visible) return reset(null);
  if (mode !== "auto") return reset(now);
  if (state.lastAt === null) return { ...state, lastAt: now };
  const interval = now - state.lastAt;
  if (interval <= 0 || interval > 1000) return reset(now);
  if (state.tier === 2) return { ...state, lastAt: now };
  if (state.warmupMs < 3000)
    return {
      ...state,
      lastAt: now,
      warmupMs: Math.min(3000, state.warmupMs + interval),
    };
  const threshold = state.tier === 0 ? 35 : 80;
  const next = {
    ...state,
    lastAt: now,
    windowMs: state.windowMs + interval,
    samples: state.samples + 1,
    slowSamples: state.slowSamples + Number(interval > threshold),
  };
  if (next.windowMs < 2000 || next.samples < 8) return next;
  const sustained =
    next.windowMs / next.samples > threshold &&
    next.slowSamples / next.samples >= 0.75;
  return {
    ...next,
    tier: sustained ? ((state.tier + 1) as AdaptiveTier) : state.tier,
    windowMs: 0,
    samples: 0,
    slowSamples: 0,
  };
}
export function effectiveRenderQuality(
  mode: RenderQualityMode,
  tier: AdaptiveTier,
  deviceDpr: number,
) {
  const native = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  if (mode === "high")
    return {
      quality: "high",
      dpr: Math.min(native, 2),
      shadows: true,
      particles: 48,
    };
  if (mode === "low")
    return {
      quality: "low",
      dpr: Math.min(native, 1),
      shadows: false,
      particles: 24,
    };
  if (tier === 2)
    return {
      quality: "minimal",
      dpr: Math.min(native, 0.75),
      shadows: false,
      particles: 24,
    };
  if (tier === 1)
    return {
      quality: "low",
      dpr: Math.min(native, 1),
      shadows: false,
      particles: 24,
    };
  return {
    quality: "balanced",
    dpr: Math.min(native, 1.65),
    shadows: true,
    particles: 48,
  };
}
