export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 720;
export const FIXED_STEP_MS = 1000 / 60;

export type RunPhase = "briefing" | "running" | "paused" | "complete";
export type PauseReason = "manual" | "focus";

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
}

export interface RunSnapshot {
  phase: RunPhase;
  seed: number;
  tick: number;
  elapsedSeconds: number;
  triggerPulls: number;
  tank: TankSnapshot;
  beacon: WorldPoint;
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
  destroyed: boolean;
}

export interface RuntimeCallbacks {
  onSnapshot(snapshot: RunSnapshot): void;
  onDiagnostics(diagnostics: RuntimeDiagnostics): void;
}
