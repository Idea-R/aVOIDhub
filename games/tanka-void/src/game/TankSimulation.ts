import { resolveArmorImpact } from "./combatMath";
import { segmentOrientedBoxIntersection } from "./geometry";
import { normalizeSeed } from "./random";
import {
  FIXED_STEP_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type CombatStatsSnapshot,
  type CombatantId,
  type CompletionReason,
  type ImpactSnapshot,
  type InputSnapshot,
  type ProjectileSnapshot,
  type RunPhase,
  type RunSnapshot,
  type TankSnapshot,
  type WorldPoint,
} from "./types";

const PLAYER_RADIUS = 36;
const PLAYER_MAX_HEALTH = 140;
const ENEMY_MAX_HEALTH = 120;
const MAX_FORWARD_SPEED = 230;
const MAX_REVERSE_SPEED = 115;
const ACCELERATION = 360;
const COASTING_DECELERATION = 260;
const PLAYER_TURN_RATE = Math.PI * 0.82;
const ENEMY_TURN_RATE = Math.PI * 0.42;
const ENEMY_TURRET_RATE = Math.PI * 0.72;
const ENEMY_FORWARD_SPEED = 92;
const ENEMY_REVERSE_SPEED = 58;
const PLAYER_FIRE_COOLDOWN_TICKS = 18;
const ENEMY_FIRE_INTERVAL_TICKS = 84;
const PLAYER_SHELL_DAMAGE = 40;
const ENEMY_SHELL_DAMAGE = 26;
const SHELL_SPEED = 620;
const SHELL_LIFETIME_TICKS = 132;
const PROJECTILE_CAPACITY = 32;
const IMPACT_HISTORY_CAPACITY = 8;
const TANK_HALF_WIDTH = 38;
const TANK_HALF_HEIGHT = 28;
const STEP_SECONDS = FIXED_STEP_MS / 1000;

interface ProjectileState extends ProjectileSnapshot {
  active: boolean;
  ageTicks: number;
}

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

function moveAngleToward(
  current: number,
  target: number,
  maximumDelta: number,
): number {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maximumDelta) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(delta) * maximumDelta);
}

function distanceBetween(first: WorldPoint, second: WorldPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function createTank(
  x: number,
  y: number,
  hullAngle: number,
  maxHealth: number,
): TankSnapshot {
  return {
    x,
    y,
    hullAngle,
    turretAngle: hullAngle,
    speed: 0,
    health: maxHealth,
    maxHealth,
    disabled: false,
  };
}

function createStats(): CombatStatsSnapshot {
  return {
    shotsFired: 0,
    hits: 0,
    ricochets: 0,
    damageDealt: 0,
    damageTaken: 0,
  };
}

function createProjectilePool(): ProjectileState[] {
  return Array.from({ length: PROJECTILE_CAPACITY }, () => ({
    id: 0,
    owner: "player" as const,
    position: { x: 0, y: 0 },
    previousPosition: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    speed: 0,
    baseDamage: 0,
    penetration: 1,
    active: false,
    ageTicks: 0,
  }));
}

export class TankSimulation {
  private phase: RunPhase = "briefing";
  private seed = 1;
  private tick = 0;
  private triggerPulls = 0;
  private playerFireCooldown = 0;
  private enemyFireCooldown = ENEMY_FIRE_INTERVAL_TICKS;
  private nextProjectileId = 1;
  private nextImpactId = 1;
  private completionReason: CompletionReason | undefined;
  private tank = this.initialPlayer();
  private enemy = this.initialEnemy();
  private readonly projectilePool = createProjectilePool();
  private impacts: ImpactSnapshot[] = [];
  private stats = createStats();

  start(seed: number): void {
    this.seed = normalizeSeed(seed);
    this.phase = "running";
    this.tick = 0;
    this.triggerPulls = 0;
    this.playerFireCooldown = 0;
    this.enemyFireCooldown = ENEMY_FIRE_INTERVAL_TICKS;
    this.nextProjectileId = 1;
    this.nextImpactId = 1;
    this.completionReason = undefined;
    this.tank = this.initialPlayer();
    this.enemy = this.initialEnemy();
    this.impacts = [];
    this.stats = createStats();
    this.clearProjectiles();
  }

  pause(): void {
    if (this.phase === "running") this.phase = "paused";
  }

  resume(): void {
    if (this.phase === "paused") this.phase = "running";
  }

  finish(reason: CompletionReason = "systems-check"): void {
    if (this.phase !== "running" && this.phase !== "paused") return;
    this.phase = "complete";
    this.completionReason = reason;
    this.tank.speed = 0;
    this.enemy.speed = 0;
    this.clearProjectiles();
  }

  returnToBriefing(): void {
    this.phase = "briefing";
    this.tick = 0;
    this.triggerPulls = 0;
    this.completionReason = undefined;
    this.tank = this.initialPlayer();
    this.enemy = this.initialEnemy();
    this.impacts = [];
    this.stats = createStats();
    this.clearProjectiles();
  }

  step(input: InputSnapshot): void {
    if (this.phase !== "running") return;

    this.playerFireCooldown = Math.max(0, this.playerFireCooldown - 1);
    this.enemyFireCooldown = Math.max(0, this.enemyFireCooldown - 1);
    this.updatePlayer(input);
    this.updateEnemy();
    this.updateProjectiles();
    this.tick += 1;

    if (this.enemy.disabled) this.finish("enemy-disabled");
    else if (this.tank.disabled) this.finish("player-disabled");
  }

  snapshot(): RunSnapshot {
    return {
      phase: this.phase,
      seed: this.seed,
      tick: this.tick,
      elapsedSeconds: this.tick * STEP_SECONDS,
      triggerPulls: this.triggerPulls,
      tank: { ...this.tank },
      enemy: { ...this.enemy },
      projectiles: this.projectilePool
        .filter((projectile) => projectile.active)
        .map((projectile) => ({
          id: projectile.id,
          owner: projectile.owner,
          position: { ...projectile.position },
          previousPosition: { ...projectile.previousPosition },
          direction: { ...projectile.direction },
          speed: projectile.speed,
          baseDamage: projectile.baseDamage,
          penetration: projectile.penetration,
        })),
      impacts: this.impacts.map((impact) => ({
        ...impact,
        point: { ...impact.point },
      })),
      stats: { ...this.stats },
      completionReason: this.completionReason,
    };
  }

  projectileCapacity(): number {
    return this.projectilePool.length;
  }

  private updatePlayer(input: InputSnapshot): void {
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
        turn * direction * PLAYER_TURN_RATE * steeringAuthority * STEP_SECONDS,
    );
    this.tank.x +=
      Math.cos(this.tank.hullAngle) * this.tank.speed * STEP_SECONDS;
    this.tank.y +=
      Math.sin(this.tank.hullAngle) * this.tank.speed * STEP_SECONDS;
    this.clampTankToWorld(this.tank);
    this.tank.turretAngle = normalizeAngle(
      Math.atan2(input.aim.y - this.tank.y, input.aim.x - this.tank.x),
    );

    if (input.fire) {
      this.triggerPulls += 1;
      if (this.playerFireCooldown === 0) {
        const fired = this.spawnProjectile(
          "player",
          this.tank,
          this.tank.turretAngle,
          PLAYER_SHELL_DAMAGE,
        );
        if (fired) {
          this.playerFireCooldown = PLAYER_FIRE_COOLDOWN_TICKS;
          this.stats.shotsFired += 1;
        }
      }
    }
  }

  private updateEnemy(): void {
    if (this.enemy.disabled) return;
    const playerPoint = { x: this.tank.x, y: this.tank.y };
    const enemyPoint = { x: this.enemy.x, y: this.enemy.y };
    const distance = distanceBetween(enemyPoint, playerPoint);
    const targetAngle = Math.atan2(
      this.tank.y - this.enemy.y,
      this.tank.x - this.enemy.x,
    );

    this.enemy.hullAngle = moveAngleToward(
      this.enemy.hullAngle,
      targetAngle,
      ENEMY_TURN_RATE * STEP_SECONDS,
    );
    this.enemy.turretAngle = moveAngleToward(
      this.enemy.turretAngle,
      targetAngle,
      ENEMY_TURRET_RATE * STEP_SECONDS,
    );
    const targetSpeed =
      distance > 430
        ? ENEMY_FORWARD_SPEED
        : distance < 285
          ? -ENEMY_REVERSE_SPEED
          : 0;
    this.enemy.speed = approach(
      this.enemy.speed,
      targetSpeed,
      ACCELERATION * 0.45 * STEP_SECONDS,
    );
    this.enemy.x +=
      Math.cos(this.enemy.hullAngle) * this.enemy.speed * STEP_SECONDS;
    this.enemy.y +=
      Math.sin(this.enemy.hullAngle) * this.enemy.speed * STEP_SECONDS;
    this.clampTankToWorld(this.enemy);

    const aimError = Math.abs(
      normalizeAngle(targetAngle - this.enemy.turretAngle),
    );
    if (this.enemyFireCooldown === 0 && aimError <= 0.09 && distance <= 780) {
      if (
        this.spawnProjectile(
          "enemy",
          this.enemy,
          this.enemy.turretAngle,
          ENEMY_SHELL_DAMAGE,
        )
      )
        this.enemyFireCooldown = ENEMY_FIRE_INTERVAL_TICKS;
    }
  }

  private updateProjectiles(): void {
    for (const projectile of this.projectilePool) {
      if (!projectile.active) continue;
      projectile.previousPosition = { ...projectile.position };
      projectile.position.x +=
        projectile.direction.x * projectile.speed * STEP_SECONDS;
      projectile.position.y +=
        projectile.direction.y * projectile.speed * STEP_SECONDS;
      projectile.ageTicks += 1;

      const targetId: CombatantId =
        projectile.owner === "player" ? "enemy" : "player";
      const target = targetId === "player" ? this.tank : this.enemy;
      if (!target.disabled) {
        const impactPoint = segmentOrientedBoxIntersection(
          projectile.previousPosition,
          projectile.position,
          {
            center: { x: target.x, y: target.y },
            angle: target.hullAngle,
            halfWidth: TANK_HALF_WIDTH,
            halfHeight: TANK_HALF_HEIGHT,
          },
        );
        if (impactPoint) {
          this.applyImpact(projectile, targetId, target, impactPoint);
          projectile.active = false;
          continue;
        }
      }

      if (
        projectile.ageTicks >= SHELL_LIFETIME_TICKS ||
        projectile.position.x < 0 ||
        projectile.position.x > WORLD_WIDTH ||
        projectile.position.y < 0 ||
        projectile.position.y > WORLD_HEIGHT
      )
        projectile.active = false;
    }
  }

  private applyImpact(
    projectile: ProjectileState,
    targetId: CombatantId,
    target: TankSnapshot,
    impactPoint: WorldPoint,
  ): void {
    const resolution = resolveArmorImpact({
      travelDirection: projectile.direction,
      impactDirection: {
        x: impactPoint.x - target.x,
        y: impactPoint.y - target.y,
      },
      hullAngle: target.hullAngle,
      baseDamage: projectile.baseDamage,
      penetration: projectile.penetration,
      currentHealth: target.health,
    });
    target.health = resolution.remainingHealth;
    target.disabled = target.health <= 0;
    target.speed = target.disabled ? 0 : target.speed * 0.72;

    const impact: ImpactSnapshot = {
      id: this.nextImpactId,
      tick: this.tick,
      target: targetId,
      point: { ...impactPoint },
      face: resolution.face,
      outcome: resolution.outcome,
      incidenceDegrees: resolution.incidenceDegrees,
      damage: resolution.damage,
    };
    this.nextImpactId += 1;
    this.impacts = [...this.impacts, impact].slice(-IMPACT_HISTORY_CAPACITY);

    if (projectile.owner === "player") {
      this.stats.hits += 1;
      this.stats.damageDealt += resolution.damage;
      if (resolution.outcome === "ricochet") this.stats.ricochets += 1;
    } else {
      this.stats.damageTaken += resolution.damage;
    }
  }

  private spawnProjectile(
    owner: CombatantId,
    source: TankSnapshot,
    angle: number,
    baseDamage: number,
  ): boolean {
    const projectile = this.projectilePool.find(
      (candidate) => !candidate.active,
    );
    if (!projectile) return false;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const position = {
      x: source.x + direction.x * 54,
      y: source.y + direction.y * 54,
    };
    projectile.id = this.nextProjectileId;
    projectile.owner = owner;
    projectile.position = position;
    projectile.previousPosition = { ...position };
    projectile.direction = direction;
    projectile.speed = SHELL_SPEED;
    projectile.baseDamage = baseDamage;
    projectile.penetration = 1;
    projectile.active = true;
    projectile.ageTicks = 0;
    this.nextProjectileId += 1;
    return true;
  }

  private clearProjectiles(): void {
    for (const projectile of this.projectilePool) projectile.active = false;
  }

  private clampTankToWorld(tank: TankSnapshot): void {
    const clampedX = clamp(tank.x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
    const clampedY = clamp(tank.y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
    if (clampedX !== tank.x || clampedY !== tank.y) tank.speed *= 0.4;
    tank.x = clampedX;
    tank.y = clampedY;
  }

  private initialPlayer(): TankSnapshot {
    return createTank(
      WORLD_WIDTH * 0.26,
      WORLD_HEIGHT * 0.5,
      0,
      PLAYER_MAX_HEALTH,
    );
  }

  private initialEnemy(): TankSnapshot {
    return createTank(
      WORLD_WIDTH * 0.76,
      WORLD_HEIGHT * 0.5,
      Math.PI,
      ENEMY_MAX_HEALTH,
    );
  }
}
