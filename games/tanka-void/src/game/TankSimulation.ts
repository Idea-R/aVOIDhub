import { SeededRandom, normalizeSeed } from "./random";
import {
  FIXED_STEP_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type InputSnapshot,
  type RunPhase,
  type RunSnapshot,
  type TankSnapshot,
  type WorldPoint,
} from "./types";

const TANK_RADIUS = 36;
const MAX_FORWARD_SPEED = 230;
const MAX_REVERSE_SPEED = 115;
const ACCELERATION = 360;
const COASTING_DECELERATION = 260;
const TURN_RATE = Math.PI * 0.82;
const STEP_SECONDS = FIXED_STEP_MS / 1000;

function approach(current: number, target: number, amount: number): number {
  if (current < target) return Math.min(target, current + amount);
  if (current > target) return Math.max(target, current - amount);
  return current;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export class TankSimulation {
  private phase: RunPhase = "briefing";
  private seed = 1;
  private tick = 0;
  private triggerPulls = 0;
  private fireWasDown = false;
  private tank: TankSnapshot = this.initialTank();
  private beacon: WorldPoint = {
    x: WORLD_WIDTH * 0.75,
    y: WORLD_HEIGHT * 0.35,
  };

  start(seed: number): void {
    this.seed = normalizeSeed(seed);
    const random = new SeededRandom(this.seed);
    this.phase = "running";
    this.tick = 0;
    this.triggerPulls = 0;
    this.fireWasDown = false;
    this.tank = this.initialTank();
    this.beacon = {
      x: random.range(WORLD_WIDTH * 0.62, WORLD_WIDTH * 0.86),
      y: random.range(WORLD_HEIGHT * 0.22, WORLD_HEIGHT * 0.78),
    };
  }

  pause(): void {
    if (this.phase === "running") this.phase = "paused";
  }

  resume(): void {
    if (this.phase === "paused") this.phase = "running";
  }

  finish(): void {
    if (this.phase === "running" || this.phase === "paused")
      this.phase = "complete";
  }

  returnToBriefing(): void {
    this.phase = "briefing";
    this.tick = 0;
    this.triggerPulls = 0;
    this.fireWasDown = false;
    this.tank = this.initialTank();
  }

  step(input: InputSnapshot): void {
    if (this.phase !== "running") return;

    const throttle = clamp(input.throttle, -1, 1);
    const turn = clamp(input.turn, -1, 1);
    const targetSpeed =
      throttle >= 0
        ? throttle * MAX_FORWARD_SPEED
        : throttle * MAX_REVERSE_SPEED;
    const rate = throttle === 0 ? COASTING_DECELERATION : ACCELERATION;

    this.tank.speed = approach(
      this.tank.speed,
      targetSpeed,
      rate * STEP_SECONDS,
    );
    const direction = this.tank.speed < 0 ? -1 : 1;
    const steeringAuthority =
      0.35 + 0.65 * Math.min(1, Math.abs(this.tank.speed) / MAX_FORWARD_SPEED);
    this.tank.hullAngle = normalizeAngle(
      this.tank.hullAngle +
        turn * direction * TURN_RATE * steeringAuthority * STEP_SECONDS,
    );
    this.tank.x +=
      Math.cos(this.tank.hullAngle) * this.tank.speed * STEP_SECONDS;
    this.tank.y +=
      Math.sin(this.tank.hullAngle) * this.tank.speed * STEP_SECONDS;

    const clampedX = clamp(this.tank.x, TANK_RADIUS, WORLD_WIDTH - TANK_RADIUS);
    const clampedY = clamp(
      this.tank.y,
      TANK_RADIUS,
      WORLD_HEIGHT - TANK_RADIUS,
    );
    if (clampedX !== this.tank.x || clampedY !== this.tank.y)
      this.tank.speed *= 0.4;
    this.tank.x = clampedX;
    this.tank.y = clampedY;
    this.tank.turretAngle = normalizeAngle(
      Math.atan2(input.aim.y - this.tank.y, input.aim.x - this.tank.x),
    );

    if (input.fire && !this.fireWasDown) this.triggerPulls += 1;
    this.fireWasDown = input.fire;
    this.tick += 1;
  }

  snapshot(): RunSnapshot {
    return {
      phase: this.phase,
      seed: this.seed,
      tick: this.tick,
      elapsedSeconds: this.tick * STEP_SECONDS,
      triggerPulls: this.triggerPulls,
      tank: { ...this.tank },
      beacon: { ...this.beacon },
    };
  }

  private initialTank(): TankSnapshot {
    return {
      x: WORLD_WIDTH * 0.3,
      y: WORLD_HEIGHT * 0.5,
      hullAngle: 0,
      turretAngle: 0,
      speed: 0,
    };
  }
}
