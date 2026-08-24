import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChainDetonationManager } from '../entities/ChainDetonation';
import { PowerUpManager } from '../entities/PowerUp';
import { DefenseCore } from '../systems/DefenseCore';
import { RunRandomStreams } from './seededRandom';

function powerUpSnapshot(seed: number) {
  vi.stubGlobal('window', { innerWidth: 1280 });
  vi.stubGlobal('navigator', { userAgent: 'deterministic-test' });
  const random = new RunRandomStreams(seed);
  const manager = new PowerUpManager(
    1280,
    720,
    random.getStream('power-up').next,
    () => 0.5,
  );
  random.reset(seed);
  manager.reset();

  for (let tick = 1; tick <= 1500; tick += 1) {
    manager.update(tick / 60, 1000 / 60);
  }

  return manager.getPowerUps().map((powerUp) => ({
    x: powerUp.x,
    y: powerUp.y,
    driftDirection: powerUp.driftDirection,
    driftSpeed: powerUp.driftSpeed,
    driftChangeTimer: powerUp.driftChangeTimer,
  }));
}

function chainSnapshot(seed: number, width = 1280, height = 720) {
  const random = new RunRandomStreams(seed);
  const manager = new ChainDetonationManager(
    width,
    height,
    random.getStream('chain').next,
    () => 0.5,
  );

  for (let currentTime = 2000; currentTime <= 180000; currentTime += 2000) {
    manager.update(2000, currentTime);
    const chain = manager.getActiveChain();
    if (chain) {
      return {
        totalFragments: chain.totalFragments,
        fragments: chain.fragments.map(({ x, y }) => ({ x, y })),
      };
    }
  }
  return null;
}

function defenseSnapshot(seed: number) {
  const random = new RunRandomStreams(seed);
  const defense = new DefenseCore(
    { width: 400, height: 300 } as HTMLCanvasElement,
    random.getStream('defense').next,
  );
  defense.removeDefenseZone(0);
  defense.addDefenseZone({ x: 100, y: 100, radius: 100, strength: 1, type: 'deflect' });
  const meteor = {
    id: 'meteor-test', x: 100, y: 100, vx: 0, vy: 0, radius: 8,
    color: '#fff', trail: [], isSuper: false, active: true,
  };

  defense.processMeteorDefense([meteor]);
  meteor.x = 250;
  defense.processMeteorDefense([meteor]);
  meteor.x = 100;
  return defense.processMeteorDefense([meteor]).deflectedMeteors[0];
}

describe('gameplay random boundaries', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('replays power-up schedules, positions, and drift independently of visuals', () => {
    expect(powerUpSnapshot(0x10101010)).toEqual(powerUpSnapshot(0x10101010));
    expect(powerUpSnapshot(0x10101010)).not.toEqual(powerUpSnapshot(0x20202020));
  });

  it('replays chain spawn composition and fragment positions', () => {
    const first = chainSnapshot(0xabcdef01);
    expect(first).not.toBeNull();
    expect(first).toEqual(chainSnapshot(0xabcdef01));
    expect(first).not.toEqual(chainSnapshot(0xabcdef02));
  });

  it('never asks a compact canvas to collect fragments that were not placed', () => {
    const compact = chainSnapshot(0xabcdef01, 320, 320);
    expect(compact).not.toBeNull();
    expect(compact?.totalFragments).toBe(compact?.fragments.length);
    expect(compact?.totalFragments).toBeGreaterThan(0);
  });

  it('replays the defense fallback direction', () => {
    expect(defenseSnapshot(71)).toEqual(defenseSnapshot(71));
    expect(defenseSnapshot(71)).not.toEqual(defenseSnapshot(72));
  });
});
