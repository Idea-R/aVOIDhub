import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/events';
import { createSim } from './sim';
import { TEST_SEED } from '../core/config';
import { CAR_DEFS } from '../core/cars';
import { edgeKey, hexToWorld } from '../core/hex';

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function expectConsistOnRoute(sim: ReturnType<typeof createSim>): void {
  const s = sim.state;
  const traversedEnd = Math.min(s.route.path.length - 1, s.train.routeIndex + (s.train.progress > 0 ? 1 : 0));
  const segments = s.route.path.slice(0, traversedEnd + 1).slice(1).map((b, i) => {
    const a = s.route.path[i];
    expect(new Set([...s.route.railLinks, ...s.route.builtLinks]).has(edgeKey(a[0], a[1], b[0], b[1]))).toBe(true);
    return [hexToWorld(a[0], a[1]), hexToWorld(b[0], b[1])] as const;
  });
  for (let i = 0; i < s.train.cars.length; i++) {
    const distance = Math.min(...segments.map(([a, b]) => distanceToSegment(s.train.trailX[i], s.train.trailY[i], a.x, a.y, b.x, b.y)));
    expect(distance, `car ${i} left the route`).toBeLessThan(0.01);
  }
}

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
  it('keeps the caboose as rear guard when a new car is bought', () => {
    const sim = createSim(TEST_SEED, new EventBus());
    const s = sim.state;
    s.phase = 'shop';
    sim.debug.grant({ scrap: 200 });
    expect(sim.buyCar('caboose')).toBe(true);
    expect(s.train.cars.at(-1)?.type).toBe('caboose');
    expect(sim.buyCar('cannon')).toBe(true);
    expect(s.train.cars.at(-1)?.type).toBe('caboose');
    expect(s.train.cars.at(-2)?.type).toBe('cannon');
  });
  it('keeps every car on real rail while the opening branch is selected', () => {
    const opening = createSim(TEST_SEED, new EventBus());
    const startIndex = opening.state.train.routeIndex;
    expect(startIndex).toBeGreaterThan(0);
    expectConsistOnRoute(opening);

    const firstChoices = opening.plannableTiles();
    expect(firstChoices.length).toBeGreaterThan(1);
    for (let branch = 0; branch < firstChoices.length; branch++) {
      const sim = createSim(TEST_SEED, new EventBus());
      const choice = sim.plannableTiles()[branch];
      expect(sim.planTile(choice.col, choice.row).ok).toBe(true);
      for (let i = 0; i < 300; i++) {
        sim.update(0.05);
        expectConsistOnRoute(sim);
      }
    }
  });
  it('repairs missing opening rail history in existing saves', () => {
    const original = createSim(TEST_SEED, new EventBus());
    const saved = JSON.parse(original.serialize());
    const oldStartIndex = saved.state.train.routeIndex;
    saved.state.route.path = saved.state.route.path.slice(oldStartIndex);
    saved.state.train.routeIndex = 0;

    const restored = createSim(TEST_SEED, new EventBus());
    expect(restored.restore(JSON.stringify(saved))).toBe(true);
    expect(restored.state.train.routeIndex).toBe(oldStartIndex);
    expectConsistOnRoute(restored);
  });
  it('commissions purchased ballistic weapons with shared ammo stock', () => {
    const sim = createSim(TEST_SEED, new EventBus());
    const s = sim.state;
    s.phase = 'shop';
    sim.debug.grant({ scrap: 200 });
    s.train.resources.ammo = 0;
    expect(sim.buyCar('flak')).toBe(true);
    expect(s.train.resources.ammo).toBe(12);
  });
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
    for (const t of ['watchtower', 'shrine', 'wreck', 'market', 'mystery']) expect(types.has(t as any)).toBe(true);
    for (let region = 0; region < 4; region++) {
      const mysteries = sim.state.settlements.filter(x => x.type === 'mystery' && x.region === region);
      expect(mysteries.length).toBeGreaterThan(0);
      for (const node of mysteries) {
        const key = `${node.col},${node.row}`;
        expect(sim.state.route.railLinks.some(link => link.startsWith(key + '|') || link.endsWith('|' + key))).toBe(true);
        expect(node.name).toBe('Unknown Signal');
      }
    }
    const json = JSON.parse(sim.serialize());
    delete json.state.train.locoUpgrades; for (const c of json.state.train.cars) delete c.level;
    const copy = createSim(TEST_SEED, new EventBus());
    expect(copy.restore(JSON.stringify(json))).toBe(true);
    expect(copy.state.train.locoUpgrades.speed).toBe(0);
    expect(copy.state.train.cars[0].level).toBe(1);
  });
});


describe('junctions', () => {
  it('reports line-tagged branch options at a junction and lets the player pick one', () => {
    const sim = run(TEST_SEED, 20, false);
    // drive along pre-laid rail until a junction stop
    let guard = 0;
    while (guard++ < 20000) {
      const s = sim.state;
      if (s.phase === 'relic') sim.chooseRelic(0);
      if (s.phase === 'event') { if (!sim.chooseEventOption(2)) { if (!sim.chooseEventOption(1)) sim.chooseEventOption(0); } }
      if (s.phase === 'shop') sim.closeShop();
      if (s.train.stopped && s.train.stopReason === 'junction') break;
      if (s.train.stopped && s.train.stopReason === 'no_route') { const o = sim.plannableTiles().filter(t => t.free)[0] ?? sim.plannableTiles()[0]; if (o) sim.planTile(o.col, o.row); }
      if (s.train.stopped && s.train.stopReason === 'settlement' && s.train.stopTimer > 1) sim.depart();
      sim.update(0.05);
      if (s.phase === 'defeat') break;
    }
    expect(sim.state.train.stopReason).toBe('junction');
    const opts = sim.junctionOptions();
    expect(opts.length).toBeGreaterThanOrEqual(2);
    for (const o of opts) expect(typeof o.lineName).toBe('string');
    expect(sim.planTile(opts[0].col, opts[0].row).ok).toBe(true);
    expect(sim.state.train.stopped).toBe(false);
  });
});

describe('player-legibility safeguards', () => {
  it('keeps an ammo-free short-range defense on the locomotive', () => {
    const weapon = CAR_DEFS.locomotive.weapon;
    expect(weapon).not.toBeNull();
    expect(weapon?.ammoPerShot).toBe(0);
    expect(weapon?.range).toBeLessThanOrEqual(120);
    expect(weapon?.damage).toBeGreaterThan(0);
  });

  it('can plan toward a settlement instead of requiring adjacent hex clicks', () => {
    const sim = createSim(TEST_SEED, new EventBus());
    const end = sim.state.route.path.at(-1)!;
    const target = sim.state.settlements
      .filter(s => !s.visited && !s.consumed && s.col > end[0])
      .sort((a, b) => Math.hypot(a.col - end[0], a.row - end[1]) - Math.hypot(b.col - end[0], b.row - end[1]))[0];
    expect(target).toBeTruthy();
    const before = sim.state.route.path.length;
    expect(sim.planPathTo(target.col, target.row).ok).toBe(true);
    expect(sim.state.route.path.length).toBeGreaterThan(before);
  });
  it('resolves concealed weapon-car and survivor encounters as authored rewards', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    sim.debug.grant({ scrap: 100, food: 20 });
    const carsBefore = sim.state.train.cars.length;
    sim.debug.triggerEvent('mystery_weapon');
    expect(sim.chooseEventOption(0)).toBe(true);
    expect(sim.state.train.cars.length).toBe(carsBefore + 1);
    expect(sim.state.train.cars.at(-1)?.type).toBe('gatling');
    const crewBefore = sim.state.train.crew.length;
    sim.debug.triggerEvent('mystery_survivor');
    expect(sim.chooseEventOption(0)).toBe(true);
    expect(sim.state.train.crew.length).toBe(crewBefore + 1);
    expect(sim.state.train.crew.at(-1)?.name).toBe('Nils');
  });
});
