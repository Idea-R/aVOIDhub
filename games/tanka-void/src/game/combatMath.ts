import type { ArmorFace, ImpactOutcome, WorldPoint } from "./types";

const DEGREES = 180 / Math.PI;
const FRONT_LIMIT = 45;
const REAR_LIMIT = 135;
const GLANCING_LIMIT = 50;
const RICOCHET_LIMIT = 68;
const ANGLE_EPSILON = 1e-9;
const MAX_BASE_DAMAGE = 1_000;
const MAX_PENETRATION = 2;

export const FACE_MULTIPLIER: Readonly<Record<ArmorFace, number>> = {
  front: 0.55,
  left: 0.9,
  right: 0.9,
  rear: 1.35,
};

export interface ArmorImpactInput {
  travelDirection: WorldPoint;
  impactDirection: WorldPoint;
  hullAngle: number;
  baseDamage: number;
  penetration: number;
  currentHealth: number;
}

export interface ArmorImpactResolution {
  face: ArmorFace;
  outcome: ImpactOutcome;
  incidenceDegrees: number;
  faceMultiplier: number;
  outcomeMultiplier: number;
  damage: number;
  remainingHealth: number;
  outwardNormal: WorldPoint;
}

export function normalizeVector(vector: WorldPoint): WorldPoint {
  const length = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(length) || length <= Number.EPSILON)
    throw new RangeError("Impact direction must be a finite non-zero vector.");
  return { x: vector.x / length, y: vector.y / length };
}

export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle))
    throw new RangeError("Hull angle must be finite.");
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function rotate(vector: WorldPoint, angle: number): WorldPoint {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: vector.x * cosine - vector.y * sine,
    y: vector.x * sine + vector.y * cosine,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function classifyArmorFace(
  sourceDirection: WorldPoint,
  hullAngle: number,
): ArmorFace {
  const source = normalizeVector(sourceDirection);
  const local = rotate(source, -normalizeAngle(hullAngle));
  const localDegrees = Math.atan2(local.y, local.x) * DEGREES;
  const absoluteDegrees = Math.abs(localDegrees);
  if (absoluteDegrees <= FRONT_LIMIT) return "front";
  if (absoluteDegrees >= REAR_LIMIT) return "rear";
  return localDegrees > 0 ? "right" : "left";
}

export function armorFaceNormal(
  face: ArmorFace,
  hullAngle: number,
): WorldPoint {
  const localNormal: Record<ArmorFace, WorldPoint> = {
    front: { x: 1, y: 0 },
    right: { x: 0, y: 1 },
    rear: { x: -1, y: 0 },
    left: { x: 0, y: -1 },
  };
  return rotate(localNormal[face], normalizeAngle(hullAngle));
}

export function resolveArmorImpact(
  input: ArmorImpactInput,
): ArmorImpactResolution {
  const travel = normalizeVector(input.travelDirection);
  const impactDirection = normalizeVector(input.impactDirection);
  const face = classifyArmorFace(impactDirection, input.hullAngle);
  const outwardNormal = armorFaceNormal(face, input.hullAngle);
  const sourceDirection = { x: -travel.x, y: -travel.y };
  const dot = clamp(
    sourceDirection.x * outwardNormal.x + sourceDirection.y * outwardNormal.y,
    -1,
    1,
  );
  const incidenceDegrees = Math.acos(dot) * DEGREES;
  const outcome: ImpactOutcome =
    incidenceDegrees > RICOCHET_LIMIT + ANGLE_EPSILON
      ? "ricochet"
      : incidenceDegrees >= GLANCING_LIMIT - ANGLE_EPSILON
        ? "glancing"
        : "penetration";
  const outcomeMultiplier =
    outcome === "ricochet" ? 0 : outcome === "glancing" ? 0.45 : 1;
  const baseDamage = clamp(
    Number.isFinite(input.baseDamage) ? input.baseDamage : 0,
    0,
    MAX_BASE_DAMAGE,
  );
  const penetration = clamp(
    Number.isFinite(input.penetration) ? input.penetration : 0,
    0,
    MAX_PENETRATION,
  );
  const currentHealth = Math.max(
    0,
    Number.isFinite(input.currentHealth) ? input.currentHealth : 0,
  );
  const damage = Math.min(
    currentHealth,
    baseDamage * penetration * FACE_MULTIPLIER[face] * outcomeMultiplier,
  );

  return {
    face,
    outcome,
    incidenceDegrees,
    faceMultiplier: FACE_MULTIPLIER[face],
    outcomeMultiplier,
    damage,
    remainingHealth: Math.max(0, currentHealth - damage),
    outwardNormal,
  };
}
