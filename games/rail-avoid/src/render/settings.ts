/** Quality / accessibility knobs shared by all render layers. */
export type QualityLevel = 'high' | 'medium' | 'low';

export interface RenderSettings {
  quality: QualityLevel;
  particleMul: number;
  weather: boolean;
  decorDensity: number;
  glow: boolean;
  reducedMotion: boolean;
  screenShake: boolean;
}

export const LAYER_DEPTH = {
  terrain: 0,
  decor: 5,
  track: 20,
  trackPulse: 21,
  plannable: 25,
  settlements: 30,
  void: 40,        // the void swallows consumed track and settlements
  shadows: 90,
  world: 100,      // y-sorted (children depth = projected y)
  projectiles: 2000,
  air: 2100,
  fx: 2200,
  fxGlow: 2201,
  weather: 2300,
  tint: 2400,
  overlay: 2500,
} as const;

export function settingsForQuality(q: QualityLevel, reducedMotion: boolean, screenShake: boolean): RenderSettings {
  switch (q) {
    case 'low':
      return { quality: q, particleMul: 0.3, weather: false, decorDensity: 0.35, glow: false, reducedMotion, screenShake };
    case 'medium':
      return { quality: q, particleMul: 0.6, weather: true, decorDensity: 0.65, glow: true, reducedMotion, screenShake };
    default:
      return { quality: q, particleMul: 1, weather: true, decorDensity: 1, glow: true, reducedMotion, screenShake };
  }
}
