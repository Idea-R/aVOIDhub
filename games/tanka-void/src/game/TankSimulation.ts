import { resolveArmorImpact } from "./combatMath";
import {
  TANKAVOID_ENEMY_PROFILES,
  TANKAVOID_FIELD_REPAIR,
  TANKAVOID_WAVES,
  TANKAVOID_WAVE_COUNT,
} from "./content";
import {
  resolveCircleFromBox,
  segmentAxisAlignedBoxIntersection,
  segmentBlockedByBox,
  segmentOrientedBoxIntersection,
  separateCircles,
} from "./geometry";
import { normalizeSeed, SeededRandom } from "./random";
import {
  FIXED_STEP_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type CombatStatsSnapshot,
  type CombatantId,
  type CompletionReason,
  type CoverSnapshot,
  type CoverStrikeSnapshot,
  type EncounterStage,
  type EnemySnapshot,
  type ImpactSnapshot,
  type InputSnapshot,
  type ProjectileSnapshot,
  type RunPhase,
  type RunSnapshot,
  type TankSnapshot,
  type WorldPoint,
} from "./types";

const PLAYER_RADIUS = 36;
const PLAYER_MAX_HEALTH = 220;
const MAX_FORWARD_SPEED = 230;
const MAX_REVERSE_SPEED = 115;
const ACCELERATION = 360;
const COASTING_DECELERATION = 260;
const PLAYER_TURN_RATE = Math.PI * 0.82;
const PLAYER_FIRE_COOLDOWN_TICKS = 18;
const PLAYER_SHELL_DAMAGE = 40;
const SHELL_SPEED = 620;
const SHELL_LIFETIME_TICKS = 132;
const PROJECTILE_CAPACITY = 32;
const IMPACT_HISTORY_CAPACITY = 12;
const COVER_STRIKE_HISTORY_CAPACITY = 8;
const COVER_CAPACITY = 4;
const ENEMY_CAPACITY = 3;
const PARTICLE_CAPACITY = 0;
const DRAW_ITEM_CAPACITY = 64;
const FIRST_DEPLOYMENT_TICKS = 180;
const LATER_DEPLOYMENT_TICKS = 90;
const WAVE_CLEAR_TICKS = 120;
const RESOLUTION_HOLD_TICKS = 90;
const TANK_HALF_WIDTH = 38;
const TANK_HALF_HEIGHT = 28;
const STEP_SECONDS = FIXED_STEP_MS / 1000;

interface ProjectileState extends ProjectileSnapshot {
  active: boolean;
  ageTicks: number;
}

interface EnemyState extends EnemySnapshot {
  fireCooldown: number;
  orbitDirection: -1 | 1;
}

interface TankHit {
  team: CombatantId;
  id: string;
  tank: TankSnapshot;
  point: WorldPoint;
  distance: number;
}

export const TANK_RADIUS = PLAYER_RADIUS;
export const TANKAVOID_LIMITS = {
  enemies: ENEMY_CAPACITY,
  cover: COVER_CAPACITY,
  projectiles: PROJECTILE_CAPACITY,
  impacts: IMPACT_HISTORY_CAPACITY,
  coverStrikes: COVER_STRIKE_HISTORY_CAPACITY,
  particles: PARTICLE_CAPACITY,
  drawItems: DRAW_ITEM_CAPACITY,
} as const;

export const TANKAVOID_COVER: readonly CoverSnapshot[] = [
  { id: "north-west", x: 360, y: 110, width: 170, height: 120 },
  { id: "north-east", x: 670, y: 110, width: 170, height: 120 },
  { id: "south-west", x: 360, y: 490, width: 170, height: 120 },
  { id: "south-east", x: 670, y: 490, width: 170, height: 120 },
];

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
    armorRepaired: 0,
    enemiesDisabled: 0,
    commanderDisabled: false,
    wavesCleared: 0,
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

function publicEnemy(enemy: EnemyState): EnemySnapshot {
  return {
    id: enemy.id,
    archetype: enemy.archetype,
    label: enemy.label,
    x: enemy.x,
    y: enemy.y,
    hullAngle: enemy.hullAngle,
    turretAngle: enemy.turretAngle,
    speed: enemy.speed,
    health: enemy.health,
    maxHealth: enemy.maxHealth,
    disabled: enemy.disabled,
  };
}

export class TankSimulation {
  private phase: RunPhase = "briefing";
  private stage: EncounterStage = "deploying";
  private stageTicksRemaining = 0;
  private seed = 1;
  private tick = 0;
  private combatTicks = 0;
  private wave = 1;
  private triggerPulls = 0;
  private playerFireCooldown = 0;
  private nextProjectileId = 1;
  private nextImpactId = 1;
  private nextCoverStrikeId = 1;
  private completionReason: CompletionReason | undefined;
  private tank = this.initialPlayer();
  private enemies = this.createWaveEnemies(1);
  private readonly projectilePool = createProjectilePool();
  private impacts: ImpactSnapshot[] = [];
  private coverStrikes: CoverStrikeSnapshot[] = [];
  private stats = createStats();

  start(seed: number): void {
    this.seed = normalizeSeed(seed);
    this.phase = "running";
    this.stage = "deploying";
    this.stageTicksRemaining = FIRST_DEPLOYMENT_TICKS;
    this.tick = 0;
    this.combatTicks = 0;
    this.wave = 1;
    this.triggerPulls = 0;
    this.playerFireCooldown = 0;
    this.nextProjectileId = 1;
    this.nextImpactId = 1;
    this.nextCoverStrikeId = 1;
    this.completionReason = undefined;
    this.tank = this.initialPlayer();
    this.enemies = this.createWaveEnemies(this.wave);
    this.impacts = [];
    this.coverStrikes = [];
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
    this.stage = "resolved";
    this.stageTicksRemaining = 0;
    this.completionReason = reason;
    this.tank.speed = 0;
    for (const enemy of this.enemies) enemy.speed = 0;
    this.clearProjectiles();
  }

  returnToBriefing(): void {
    this.phase = "briefing";
    this.stage = "deploying";
    this.stageTicksRemaining = 0;
    this.tick = 0;
    this.combatTicks = 0;
    this.wave = 1;
    this.triggerPulls = 0;
    this.completionReason = undefined;
    this.tank = this.initialPlayer();
    this.enemies = this.createWaveEnemies(this.wave);
    this.impacts = [];
    this.coverStrikes = [];
    this.stats = createStats();
    this.clearProjectiles();
  }

  step(input: InputSnapshot): void {
    if (this.phase !== "running") return;

    if (this.stage === "deploying") {
      this.tick += 1;
      this.stageTicksRemaining = Math.max(0, this.stageTicksRemaining - 1);
      if (this.stageTicksRemaining === 0) this.stage = "combat";
      return;
    }

    if (this.stage === "wave-clear") {
      this.tick += 1;
      this.stageTicksRemaining = Math.max(0, this.stageTicksRemaining - 1);
      if (this.stageTicksRemaining === 0) this.advanceWave();
      return;
    }

    if (this.stage === "resolved") {
      this.tick += 1;
      this.stageTicksRemaining = Math.max(0, this.stageTicksRemaining - 1);
      if (this.stageTicksRemaining === 0)
        this.finish(this.completionReason ?? "systems-check");
      return;
    }

    this.combatTicks += 1;
    this.playerFireCooldown = Math.max(0, this.playerFireCooldown - 1);
    for (const enemy of this.enemies)
      enemy.fireCooldown = Math.max(0, enemy.fireCooldown - 1);
    this.updatePlayer(input);
    for (const enemy of this.enemies) this.updateEnemy(enemy);
    this.resolveTankSeparation();
    this.updateProjectiles();
    this.tick += 1;

    if (this.tank.disabled) this.beginResolution("player-disabled");
    else if (this.enemies.every((enemy) => enemy.disabled)) {
      this.stats.wavesCleared += 1;
      if (this.wave === TANKAVOID_WAVE_COUNT)
        this.beginResolution("run-cleared");
      else this.beginWaveClear();
    }
  }

  snapshot(): RunSnapshot {
    const waveDefinition = TANKAVOID_WAVES[this.wave - 1];
    return {
      phase: this.phase,
      stage: this.stage,
      stageTicksRemaining: this.stageTicksRemaining,
      seed: this.seed,
      tick: this.tick,
      elapsedSeconds: this.tick * STEP_SECONDS,
      combatSeconds: this.combatTicks * STEP_SECONDS,
      combatTicks: this.combatTicks,
      triggerPulls: this.triggerPulls,
      wave: this.wave,
      waveCount: TANKAVOID_WAVE_COUNT,
      waveTitle: waveDefinition.title,
      tank: { ...this.tank },
      enemies: this.enemies.map(publicEnemy),
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
      cover: TANKAVOID_COVER.map((cover) => ({ ...cover })),
      impacts: this.impacts.map((impact) => ({
        ...impact,
        point: { ...impact.point },
      })),
      coverStrikes: this.coverStrikes.map((strike) => ({
        ...strike,
        point: { ...strike.point },
      })),
      stats: { ...this.stats },
      completionReason: this.completionReason,
    };
  }

  projectileCapacity(): number {
    return this.projectilePool.length;
  }

  limits(): typeof TANKAVOID_LIMITS {
    return TANKAVOID_LIMITS;
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
    this.resolveTankCoverCollision(this.tank);
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

  private updateEnemy(enemy: EnemyState): void {
    if (enemy.disabled) return;
    const profile = TANKAVOID_ENEMY_PROFILES[enemy.archetype];
    const playerPoint = { x: this.tank.x, y: this.tank.y };
    const enemyPoint = { x: enemy.x, y: enemy.y };
    const distance = distanceBetween(enemyPoint, playerPoint);
    const aimAngle = Math.atan2(this.tank.y - enemy.y, this.tank.x - enemy.x);
    const hasLineOfSight = !TANKAVOID_COVER.some((cover) =>
      segmentBlockedByBox(enemyPoint, playerPoint, cover),
    );
    let targetAngle = aimAngle;
    let targetSpeed = 0;

    if (!hasLineOfSight) {
      const routePoint =
        Math.abs(enemy.y - WORLD_HEIGHT / 2) > 42
          ? { x: enemy.x, y: WORLD_HEIGHT / 2 }
          : { x: this.tank.x, y: WORLD_HEIGHT / 2 };
      targetAngle = Math.atan2(routePoint.y - enemy.y, routePoint.x - enemy.x);
      targetSpeed = profile.forwardSpeed;
    } else if (enemy.archetype === "scout") {
      targetAngle =
        aimAngle +
        enemy.orbitDirection *
          (distance > profile.preferredRange + 70 ? 0.38 : 1.18);
      targetSpeed =
        distance < profile.minimumRange
          ? -profile.reverseSpeed
          : profile.forwardSpeed;
    } else if (enemy.archetype === "hunter") {
      if (distance < profile.minimumRange) targetSpeed = -profile.reverseSpeed;
      else if (distance > profile.preferredRange + 75)
        targetSpeed = profile.forwardSpeed;
      else {
        targetAngle = aimAngle + enemy.orbitDirection * (Math.PI / 2);
        targetSpeed = profile.forwardSpeed * 0.7;
      }
    } else {
      targetAngle =
        aimAngle +
        (enemy.archetype === "commander" ? enemy.orbitDirection * 0.12 : 0);
      targetSpeed =
        distance > profile.preferredRange
          ? profile.forwardSpeed
          : distance < profile.minimumRange
            ? -profile.reverseSpeed
            : 0;
    }

    enemy.hullAngle = moveAngleToward(
      enemy.hullAngle,
      targetAngle,
      profile.turnRate * STEP_SECONDS,
    );
    enemy.turretAngle = moveAngleToward(
      enemy.turretAngle,
      aimAngle,
      profile.turretRate * STEP_SECONDS,
    );
    enemy.speed = approach(
      enemy.speed,
      targetSpeed,
      ACCELERATION * 0.45 * STEP_SECONDS,
    );
    enemy.x += Math.cos(enemy.hullAngle) * enemy.speed * STEP_SECONDS;
    enemy.y += Math.sin(enemy.hullAngle) * enemy.speed * STEP_SECONDS;
    this.clampTankToWorld(enemy);
    this.resolveTankCoverCollision(enemy);

    const liveAimAngle = Math.atan2(
      this.tank.y - enemy.y,
      this.tank.x - enemy.x,
    );
    const aimError = Math.abs(normalizeAngle(liveAimAngle - enemy.turretAngle));
    const canFire = !TANKAVOID_COVER.some((cover) =>
      segmentBlockedByBox(
        { x: enemy.x, y: enemy.y },
        { x: this.tank.x, y: this.tank.y },
        cover,
      ),
    );
    if (
      canFire &&
      enemy.fireCooldown === 0 &&
      aimError <= 0.09 &&
      distance <= profile.maximumFireRange
    ) {
      if (
        this.spawnProjectile(
          "enemy",
          enemy,
          enemy.turretAngle,
          profile.shellDamage,
        )
      )
        enemy.fireCooldown = profile.fireIntervalTicks;
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

      const tankHit = this.findFirstTankImpact(projectile);
      const coverImpact = this.findFirstCoverImpact(
        projectile.previousPosition,
        projectile.position,
      );
      const coverDistance = coverImpact
        ? distanceBetween(projectile.previousPosition, coverImpact.point)
        : Number.POSITIVE_INFINITY;

      if (coverImpact && coverDistance <= (tankHit?.distance ?? Infinity)) {
        this.recordCoverStrike(
          projectile,
          coverImpact.cover,
          coverImpact.point,
        );
        projectile.active = false;
        continue;
      }
      if (tankHit) {
        this.applyImpact(
          projectile,
          tankHit.team,
          tankHit.id,
          tankHit.tank,
          tankHit.point,
        );
        projectile.active = false;
        continue;
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

  private findFirstTankImpact(projectile: ProjectileState): TankHit | null {
    if (projectile.owner === "enemy") {
      if (this.tank.disabled) return null;
      const point = this.tankIntersection(
        projectile.previousPosition,
        projectile.position,
        this.tank,
      );
      return point
        ? {
            team: "player",
            id: "player",
            tank: this.tank,
            point,
            distance: distanceBetween(projectile.previousPosition, point),
          }
        : null;
    }

    let nearest: TankHit | null = null;
    for (const enemy of this.enemies) {
      if (enemy.disabled) continue;
      const point = this.tankIntersection(
        projectile.previousPosition,
        projectile.position,
        enemy,
      );
      if (!point) continue;
      const distance = distanceBetween(projectile.previousPosition, point);
      if (!nearest || distance < nearest.distance)
        nearest = {
          team: "enemy",
          id: enemy.id,
          tank: enemy,
          point,
          distance,
        };
    }
    return nearest;
  }

  private tankIntersection(
    start: WorldPoint,
    end: WorldPoint,
    target: TankSnapshot | EnemyState,
  ): WorldPoint | null {
    return segmentOrientedBoxIntersection(start, end, {
      center: { x: target.x, y: target.y },
      angle: target.hullAngle,
      halfWidth: TANK_HALF_WIDTH,
      halfHeight: TANK_HALF_HEIGHT,
    });
  }

  private applyImpact(
    projectile: ProjectileState,
    targetTeam: CombatantId,
    targetId: string,
    target: TankSnapshot,
    impactPoint: WorldPoint,
  ): void {
    const wasDisabled = target.disabled;
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
      target: targetTeam,
      targetId,
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
      if (!wasDisabled && target.disabled) {
        this.stats.enemiesDisabled += 1;
        if ("archetype" in target && target.archetype === "commander")
          this.stats.commanderDisabled = true;
      }
    } else this.stats.damageTaken += resolution.damage;
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

  private beginWaveClear(): void {
    if (this.stage !== "combat") return;
    this.stage = "wave-clear";
    this.stageTicksRemaining = WAVE_CLEAR_TICKS;
    this.tank.speed = 0;
    for (const enemy of this.enemies) enemy.speed = 0;
    this.clearProjectiles();
  }

  private advanceWave(): void {
    const previousHealth = this.tank.health;
    this.tank.health = Math.min(
      this.tank.maxHealth,
      this.tank.health + TANKAVOID_FIELD_REPAIR,
    );
    this.stats.armorRepaired += this.tank.health - previousHealth;
    this.wave += 1;
    this.stage = "deploying";
    this.stageTicksRemaining = LATER_DEPLOYMENT_TICKS;
    this.playerFireCooldown = 0;
    this.enemies = this.createWaveEnemies(this.wave);
    this.clearProjectiles();
  }

  private beginResolution(
    reason: Exclude<CompletionReason, "systems-check">,
  ): void {
    if (this.stage !== "combat") return;
    this.stage = "resolved";
    this.stageTicksRemaining = RESOLUTION_HOLD_TICKS;
    this.completionReason = reason;
    this.tank.speed = 0;
    for (const enemy of this.enemies) enemy.speed = 0;
    this.clearProjectiles();
  }

  private createWaveEnemies(waveNumber: number): EnemyState[] {
    const definition = TANKAVOID_WAVES[waveNumber - 1] ?? TANKAVOID_WAVES[0];
    const random = new SeededRandom(
      normalizeSeed(this.seed ^ Math.imul(waveNumber, 0x9e3779b1)),
    );
    return definition.enemies.map((spawn, index) => {
      const profile = TANKAVOID_ENEMY_PROFILES[spawn.archetype];
      const tank = createTank(
        clamp(spawn.x + random.range(-18, 18), PLAYER_RADIUS, 1164),
        clamp(spawn.y + random.range(-24, 24), PLAYER_RADIUS, 684),
        Math.PI,
        profile.maxHealth,
      );
      return {
        ...tank,
        id: `wave-${waveNumber}-${index + 1}-${spawn.archetype}`,
        archetype: spawn.archetype,
        label: profile.label,
        fireCooldown: profile.fireIntervalTicks + index * 24,
        orbitDirection: random.next() < 0.5 ? -1 : 1,
      };
    });
  }

  private findFirstCoverImpact(
    start: WorldPoint,
    end: WorldPoint,
  ): { cover: CoverSnapshot; point: WorldPoint } | null {
    let nearest: {
      cover: CoverSnapshot;
      point: WorldPoint;
      distance: number;
    } | null = null;
    for (const cover of TANKAVOID_COVER) {
      const point = segmentAxisAlignedBoxIntersection(start, end, cover);
      if (!point) continue;
      const distance = distanceBetween(start, point);
      if (!nearest || distance < nearest.distance)
        nearest = { cover, point, distance };
    }
    return nearest ? { cover: nearest.cover, point: nearest.point } : null;
  }

  private recordCoverStrike(
    projectile: ProjectileState,
    cover: CoverSnapshot,
    point: WorldPoint,
  ): void {
    const strike: CoverStrikeSnapshot = {
      id: this.nextCoverStrikeId,
      tick: this.tick,
      coverId: cover.id,
      owner: projectile.owner,
      point: { ...point },
    };
    this.nextCoverStrikeId += 1;
    this.coverStrikes = [...this.coverStrikes, strike].slice(
      -COVER_STRIKE_HISTORY_CAPACITY,
    );
  }

  private resolveTankSeparation(): void {
    for (let pass = 0; pass < 2; pass += 1) {
      for (const enemy of this.enemies) {
        const [player, movedEnemy] = separateCircles(
          this.tank,
          enemy,
          PLAYER_RADIUS,
        );
        this.tank.x = player.x;
        this.tank.y = player.y;
        enemy.x = movedEnemy.x;
        enemy.y = movedEnemy.y;
      }
      for (let first = 0; first < this.enemies.length; first += 1) {
        for (
          let second = first + 1;
          second < this.enemies.length;
          second += 1
        ) {
          const [left, right] = separateCircles(
            this.enemies[first],
            this.enemies[second],
            PLAYER_RADIUS,
          );
          this.enemies[first].x = left.x;
          this.enemies[first].y = left.y;
          this.enemies[second].x = right.x;
          this.enemies[second].y = right.y;
        }
      }
    }
    this.resolveTankCoverCollision(this.tank);
    this.clampTankToWorld(this.tank);
    for (const enemy of this.enemies) {
      this.resolveTankCoverCollision(enemy);
      this.clampTankToWorld(enemy);
    }
  }

  private resolveTankCoverCollision(tank: TankSnapshot): void {
    for (const cover of TANKAVOID_COVER) {
      const resolved = resolveCircleFromBox(tank, PLAYER_RADIUS, cover);
      if (resolved.x !== tank.x || resolved.y !== tank.y) tank.speed *= 0.28;
      tank.x = resolved.x;
      tank.y = resolved.y;
    }
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
}
