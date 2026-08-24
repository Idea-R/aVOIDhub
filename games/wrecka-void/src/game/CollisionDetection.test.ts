import { describe, expect, it } from "vitest";
import { CollisionDetection } from "./CollisionDetection";
import { ParticleSystem } from "./ParticleSystem";
import type { Enemy } from "../types/Game";
import type { ActiveEffects, PlayerUpgrades } from "../types/PowerUps";

const upgrades: PlayerUpgrades = {
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

const effects: ActiveEffects = {};

function pusher(health: number): Enemy {
  return {
    id: 1,
    pos: { x: 100, y: 100 },
    velocity: { x: 0, y: 0 },
    health,
    maxHealth: health,
    type: "pusher",
    size: 26,
    color: "#ff6600",
    pushForce: 300,
  };
}

describe("CollisionDetection pusher collision", () => {
  it("deflects the ball and applies defined minimal damage", () => {
    const enemy = pusher(10);
    const velocity = { x: 0, y: 0 };

    const result = CollisionDetection.checkBallEnemyCollisions(
      { x: 120, y: 100 },
      25,
      [enemy],
      upgrades,
      effects,
      new ParticleSystem(),
      velocity,
    );

    expect(enemy.health).toBe(9);
    expect(velocity.x).toBeGreaterThan(0);
    expect(result.pushedEnemies).toEqual([0]);
    expect(result.destroyedEnemies).toEqual([]);
    expect(result.totalPoints).toBe(0);
  });

  it("awards pusher points when the minimal hit is lethal", () => {
    const enemy = pusher(1);

    const result = CollisionDetection.checkBallEnemyCollisions(
      { x: 120, y: 100 },
      25,
      [enemy],
      upgrades,
      effects,
      new ParticleSystem(),
      { x: 0, y: 0 },
    );

    expect(result.destroyedEnemies).toEqual([0]);
    expect(result.totalPoints).toBe(30);
  });
});
