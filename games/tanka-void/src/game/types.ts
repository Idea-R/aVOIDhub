export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 720;
export const FIXED_STEP_MS = 1000 / 60;

export type RunPhase = "briefing" | "running" | "paused" | "complete";
export type PauseReason = "manual" | "focus";
export type CombatantId = "player" | "enemy";
export type ArmorFace = "front" | "left" | "right" | "rear";
export type ImpactOutcome = "penetration" | "glancing" | "ricochet";
export type CompletionReason =
  | "enemy-disabled"
  | "player-disabled"
  | "systems-check";

export interface WorldPoint {
  x: number;
  y: number;
}

export interface InputSnapshot {
  throttle: number;
  turn: number;
  aim: WorldPoint;
  fire: boolean;
}

export interface TankSnapshot {
  x: number;
  y: number;
  hullAngle: number;
  turretAngle: number;
  speed: number;
  health: number;
  maxHealth: number;
  disabled: boolean;
}

export interface ProjectileSnapshot {
  id: number;
  owner: CombatantId;
  position: WorldPoint;
  previousPosition: WorldPoint;
  direction: WorldPoint;
  speed: number;
  baseDamage: number;
  penetration: number;
}

export interface ImpactSnapshot {
  id: number;
  tick: number;
  target: CombatantId;
  point: WorldPoint;
  face: ArmorFace;
  outcome: ImpactOutcome;
  incidenceDegrees: number;
  damage: number;
}

export interface CombatStatsSnapshot {
  shotsFired: number;
  hits: number;
  ricochets: number;
  damageDealt: number;
  damageTaken: number;
}

export interface RunSnapshot {
  phase: RunPhase;
  seed: number;
  tick: number;
  elapsedSeconds: number;
  triggerPulls: number;
  tank: TankSnapshot;
  enemy: TankSnapshot;
  projectiles: ProjectileSnapshot[];
  impacts: ImpactSnapshot[];
  stats: CombatStatsSnapshot;
  completionReason?: CompletionReason;
}

export interface ViewportLayout {
  cssWidth: number;
  cssHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface RuntimeDiagnostics {
  starts: number;
  finishes: number;
  resets: number;
  inputListeners: number;
  resizeObservers: number;
  framePending: boolean;
  simulationSteps: number;
  droppedMilliseconds: number;
  activeProjectiles: number;
  projectileCapacity: number;
  impactHistory: number;
  destroyed: boolean;
}

export interface RuntimeCallbacks {
  onSnapshot(snapshot: RunSnapshot): void;
  onDiagnostics(diagnostics: RuntimeDiagnostics): void;
}
