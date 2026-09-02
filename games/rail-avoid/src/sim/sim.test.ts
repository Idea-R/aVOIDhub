import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/events';
import { createSim } from './sim';
import { TEST_SEED } from '../core/config';

function run(seed: number, seconds: number, plan = true) {
  const bus = new EventBus();
  const sim = createSim(seed, bus);
  const steps = Math.round(seconds / 0.05);
  for (let i = 0; i < steps; i++) {
    if (sim.state.phase === 'relic') sim.chooseRelic(0);
    if (sim.state.phase === 'event') { if (!sim.chooseEventOption(2)) if (!sim.chooseEventOption(1)) sim.chooseEventOption(0); }
    if (plan && i % 10 === 0) {
      const opts = sim.plannableTiles();
      if (opts.length) {
        // deterministic greedy east
        const best = opts.slice().sort((a, b) => b.col - a.col || a.row - b.row)[0];
        sim.planTile(best.col, best.row);
      }
    }
    sim.update(0.05);
  }
  return sim;
}

describe('sim', () => {
  it('is deterministic for identical inputs', () => {
    const a = run(TEST_SEED, 60), b = run(TEST_SEED, 60);
    expect(a.state.tick).toBe(b.state.tick);
    expect(JSON.stringify(a.state.route.path)).toBe(JSON.stringify(b.state.route.path));
    expect(a.state.train.resources).toEqual(b.state.train.resources);
    expect(a.state.enemies.length).toBe(b.state.enemies.length);
    expect(a.state.rngState).toEqual(b.state.rngState);
  });
  it('moves the train when a route is planned and stays alive for the tutorial window', () => {
    const sim = run(TEST_SEED, 45);
    expect(sim.state.phase).toBe('running');
    expect(sim.state.train.distanceTravelled).toBeGreaterThan(2);
    expect(sim.state.train.routeIndex).toBeGreaterThan(0);
  });
  it('serializes and restores identically', () => {
    const sim = run(TEST_SEED, 30);
    const json = sim.serialize();
    const bus = new EventBus();
    const copy = createSim(TEST_SEED, bus);
    expect(copy.restore(json)).toBe(true);
    expect(copy.state.time).toBeCloseTo(sim.state.time, 5);
    for (let i = 0; i < 100; i++) { sim.update(0.05); copy.update(0.05); }
    expect(copy.state.rngState).toEqual(sim.state.rngState);
    expect(copy.state.train.trailX[0]).toBeCloseTo(sim.state.train.trailX[0], 6);
  });
  it('reaches defeat when the locomotive is destroyed', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    let defeated = false;
    bus.on('run:defeat', () => { defeated = true; });
    sim.debug.forceDefeat('test');
    expect(sim.state.phase).toBe('defeat');
    expect(defeated).toBe(true);
  });
  it('awards victory via forceVictory', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    sim.debug.forceVictory();
    expect(sim.state.phase).toBe('victory');
    expect(sim.state.stats.score).toBeGreaterThan(1000);
  });
  it('warps between regions without breaking movement', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    sim.debug.warpToRegion(2);
    expect(sim.state.region).toBe(2);
    for (let i = 0; i < 400; i++) {
      if (sim.state.phase === 'relic') sim.chooseRelic(0);
      if (sim.state.phase === 'event') { if (!sim.chooseEventOption(2)) if (!sim.chooseEventOption(1)) sim.chooseEventOption(0); }
      if (sim.state.phase === 'expedition') { const x = sim.state.expedition!; if (x.outcome) sim.endExpedition(); else if (x.pending) sim.expeditionResolve('good'); else sim.expeditionAction('strike'); }
      if (i % 10 === 0) { const o = sim.plannableTiles(); if (o.length) sim.planTile(o[0].col, o[0].row); }
      sim.update(0.05);
    }
    expect(sim.state.phase).toBe('running');
    expect(sim.state.train.distanceTravelled).toBeGreaterThan(1);
  });
});

describe('reverse', () => {
  it('backs down the traversed track and re-anchors planning', () => {
    const sim = run(TEST_SEED, 40);
    const idxBefore = sim.state.train.routeIndex;
    expect(idxBefore).toBeGreaterThan(3);
    sim.reverse(true);
    expect(sim.isReversing()).toBe(true);
    for (let i = 0; i < 200; i++) sim.update(0.05);
    expect(sim.state.train.routeIndex).toBeLessThan(idxBefore);
    sim.reverse(false);
    expect(sim.isReversing()).toBe(false);
    expect(sim.state.train.stopped).toBe(true);
    expect(sim.state.route.path.length).toBe(sim.state.train.routeIndex + 1);
    const opts = sim.plannableTiles();
    expect(opts.length).toBeGreaterThan(0);
    expect(sim.planTile(opts[0].col, opts[0].row).ok).toBe(true);
    for (let i = 0; i < 100; i++) sim.update(0.05);
    expect(sim.state.phase).toBe('running');
  });
});

describe('upgrades and nodes', () => {
  it('upgrades cars and the locomotive at a yard and applies their effects', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    const s = sim.state;
    s.phase = 'shop';
    sim.debug.grant({ scrap: 500 });
    const gat = s.train.cars.findIndex(c => c.type === 'gatling');
    const hpBefore = s.train.cars[gat].maxHp;
    expect(sim.upgradeCost(gat)).toBeGreaterThan(0);
    expect(sim.upgradeCar(gat)).toBe(true);
    expect(s.train.cars[gat].level).toBe(2);
    expect(s.train.cars[gat].maxHp).toBeGreaterThan(hpBefore);
    const rangeBefore = sim.currentPlanRange();
    expect(sim.upgradeLoco('crew')).toBe(true);
    expect(sim.currentPlanRange()).toBe(rangeBefore + 1);
    expect(sim.upgradeLoco('frame')).toBe(true);
    expect(s.train.cars[0].maxHp).toBe(280);
    sim.debug.grant({ scrap: 500 });
    expect(sim.upgradeLoco('speed')).toBe(true);
    sim.debug.grant({ scrap: 500 });
    expect(sim.upgradeLoco('speed')).toBe(true);
    sim.debug.grant({ scrap: 500 });
    expect(sim.upgradeLoco('speed')).toBe(true);
    expect(sim.upgradeLoco('speed')).toBe(false);
    expect(sim.locoUpgradeCost('speed')).toBe(-1);
    s.phase = 'running';
    expect(sim.upgradeCar(gat)).toBe(false);
  });
  it('generates the new node types and restores old saves with defaults', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    const types = new Set(sim.state.settlements.map(x => x.type));
    for (const t of ['watchtower', 'shrine', 'wreck', 'market']) expect(types.has(t as any)).toBe(true);
    const json = JSON.parse(sim.serialize());
    delete json.state.train.locoUpgrades; for (const c of json.state.train.cars) delete c.level;
    const copy = createSim(TEST_SEED, new EventBus());
    expect(copy.restore(JSON.stringify(json))).toBe(true);
    expect(copy.state.train.locoUpgrades.speed).toBe(0);
    expect(copy.state.train.cars[0].level).toBe(1);
  });
});
