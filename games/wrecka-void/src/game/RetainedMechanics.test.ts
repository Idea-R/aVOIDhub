import { afterEach, describe, expect, it, vi } from "vitest";
import { PowerUpManager } from "../components/Game/PowerUpManager";
import type { Enemy } from "../types/Game";
import type { PlayerUpgrades } from "../types/PowerUps";
import { CollisionDetection } from "./CollisionDetection";
import { EnemyManager } from "./EnemyManager";
import { ParticleSystem } from "./ParticleSystem";

const baseUpgrades: PlayerUpgrades = {
  chainDamage: 0,
  ballDamage: 0,
  healthIncrease: 0,
  speedBoost: 0,
  ballSize: 0,
  chainExtensions: 0,
  hasSecondChain: false,
  secondChainDamage: 0,
  secondChainSpeed: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("retained WreckaVOID mechanics", () => {
  it("spawns a boss, executes its projectile pattern, and keeps contact nonlethal", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const enemies = new EnemyManager();
    const player = { x: 400, y: 300 };

    enemies.spawnBoss(800, 600, player);
    const boss = enemies.getEnemies()[0];
    expect(boss).toMatchObject({ type: "boss", projectileType: "spread" });

    enemies.updateBossShooting(player);
    expect(enemies.getProjectiles()).toHaveLength(3);

    const contact = CollisionDetection.checkPlayerEnemyCollisions(
      boss.pos,
      20,
      [boss],
      {},
      new ParticleSystem(),
    );
    expect(contact.damage).toBe(30);
    expect(contact.hitEnemies).toEqual([]);
  });

  it("applies projectile damage and reports the projectile for one removal", () => {
    const hit = CollisionDetection.checkProjectilePlayerCollisions(
      { x: 50, y: 50 },
      20,
      [
        {
          id: 1,
          pos: { x: 50, y: 50 },
          velocity: { x: 0, y: 0 },
          size: 8,
          color: "#ff0088",
          damage: 15,
          life: 5000,
        },
      ],
      new ParticleSystem(),
    );

    expect(hit).toEqual({ damage: 15, hitProjectiles: [0] });
  });

  it("lets the unlocked second chain destroy an enemy once", () => {
    const enemy: Enemy = {
      id: 1,
      pos: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      health: 1,
      maxHealth: 1,
      type: "basic",
      size: 22,
      color: "#ffaa44",
    };

    const result = CollisionDetection.checkSecondChainEnemyCollisions(
      [{ pos: { x: 100, y: 100 }, oldPos: { x: 100, y: 100 } }],
      [enemy],
      { ...baseUpgrades, hasSecondChain: true },
      {},
      new ParticleSystem(),
    );

    expect(result.destroyedEnemies).toEqual([0]);
    expect(result.totalPoints).toBe(6);
  });

  it("produces and collects the second-chain power-up when eligible", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const powerUps = new PowerUpManager();
    powerUps.spawnSpecificPowerUp(
      { x: 100, y: 100 },
      { ...baseUpgrades, chainExtensions: 2 },
      "permanent",
      "very_rare",
    );

    const collected = powerUps.checkCollisions({ x: 100, y: 100 }, 20);
    expect(collected?.name).toBe("Second Chain");
    expect(collected?.effect.secondChain).toBe(true);
    expect(powerUps.getPowerUps()).toHaveLength(0);
  });
});
