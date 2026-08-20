export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 720;
export const FIXED_STEP_MS = 1000 / 60;

export type RunPhase = "briefing" | "running" | "paused" | "complete";
export type EncounterStage = "deploying" | "combat" | "wave-clear" | "resolved";
export type PauseReason = "manual" | "focus";
export type CombatantId = "player" | "enemy";
export type EnemyArchetype = "scout" | "bruiser" | "hunter" | "commander";
export type ArmorFace = "front" | "left" | "right" | "rear";
export type ImpactOutcome = "penetration" | "glancing" | "ricochet";
export type CompletionReason =
  | "run-cleared"
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

export interface EnemySnapshot extends TankSnapshot {
  id: string;
  archetype: EnemyArchetype;
  label: string;
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

export interface CoverSnapshot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoverStrikeSnapshot {
  id: number;
  tick: number;
  coverId: string;
  owner: CombatantId;
  point: WorldPoint;
}

export interface ImpactSnapshot {
  id: number;
  tick: number;
  target: CombatantId;
  targetId: string;
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
  armorRepaired: number;
  enemiesDisabled: number;
  wavesCleared: number;
}

export interface RunSnapshot {
  phase: RunPhase;
  stage: EncounterStage;
  stageTicksRemaining: number;
  seed: number;
  tick: number;
  elapsedSeconds: number;
  combatSeconds: number;
  triggerPulls: number;
  wave: number;
  waveCount: number;
  waveTitle: string;
  tank: TankSnapshot;
  enemies: EnemySnapshot[];
  projectiles: ProjectileSnapshot[];
  cover: CoverSnapshot[];
  impacts: ImpactSnapshot[];
  coverStrikes: CoverStrikeSnapshot[];
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
  maximumFrameDeltaMilliseconds: number;
  maximumStepsPerFrame: number;
  activeProjectiles: number;
  projectileCapacity: number;
  activeEnemies: number;
  enemyCapacity: number;
  coverCount: number;
  coverCapacity: number;
  impactHistory: number;
  impactHistoryCapacity: number;
  coverStrikeHistory: number;
  coverStrikeHistoryCapacity: number;
  particleCount: number;
  particleCapacity: number;
  drawItems: number;
  drawItemCapacity: number;
  audioState: "locked" | "ready" | "unavailable";
  soundMuted: boolean;
  audioContexts: number;
  activeAudioVoices: number;
  audioVoiceCapacity: number;
  destroyed: boolean;
}

export interface RuntimeCallbacks {
  onSnapshot(snapshot: RunSnapshot): void;
  onDiagnostics(diagnostics: RuntimeDiagnostics): void;
}
