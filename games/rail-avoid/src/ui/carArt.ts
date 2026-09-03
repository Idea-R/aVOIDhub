import type { CarType } from '../core/types';
import locomotiveV1 from '/art/cars/locomotive-v1.webp?url&inline';
import barracksV1 from '/art/cars/barracks-v1.webp?url&inline';
import coalBunkerV1 from '/art/cars/coal-bunker-v1.webp?url&inline';
import gatlingV1 from '/art/cars/gatling-v1.webp?url&inline';
import gatlingV2 from '/art/cars/gatling-v2.webp?url&inline';
import gatlingV3 from '/art/cars/gatling-v3.webp?url&inline';
import cargoV1 from '/art/cars/cargo-v1.webp?url&inline';
import coachV1 from '/art/cars/coach-v1.webp?url&inline';

/**
 * Authored rolling-stock art is level-aware. Missing types intentionally fall back
 * to the lightweight CSS schematic so new simulation content never becomes invisible.
 */
const CAR_ART: Partial<Record<CarType, readonly string[]>> = {
  locomotive: [locomotiveV1],
  barracks: [barracksV1],
  coal_bunker: [coalBunkerV1],
  gatling: [gatlingV1, gatlingV2, gatlingV3],
  cargo: [cargoV1],
  coach: [coachV1],
};

export function carArtFor(type: CarType, level = 1): string | null {
  const variants = CAR_ART[type];
  if (!variants?.length) return null;
  return variants[Math.min(variants.length - 1, Math.max(0, level - 1))] ?? variants[0] ?? null;
}

export function hasCarArt(type: CarType): boolean { return !!CAR_ART[type]?.length; }
