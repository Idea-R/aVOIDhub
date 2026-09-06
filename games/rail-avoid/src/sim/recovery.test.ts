import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { TRAIN } from '../core/config';
import { CAR_DEFS } from '../core/cars';
import type { CarType, SettlementType } from '../core/types';
import type { SimContext } from './api';
import { createSim } from './sim';
import { makeCar, spawnEnemy, addResource } from './helpers';
import { addCrew, propagate } from './train';
import { updateCombat } from './combat';
import { updateFieldService } from './service';

function fixture(type: SettlementType = 'village') {
  const sim = createSim(12345, new EventBus());
  const ctx = (sim as unknown as { ctx: SimContext }).ctx;
  const s = sim.state, t = s.train;
  const stop = s.settlements.find(st => st.type === type) ?? s.settlements.find(st => st.type !== 'start')!;
  stop.type = type; stop.visited = true; stop.consumed = false;
  s.route.path = [[stop.col, stop.row]];
  t.routeIndex = 0; t.progress = 0; t.stopped = true; t.stopReason = 'settlement'; t.stopTimer = 0;
  return { sim, ctx, s, t, stop };
}

describe('shared ammo and emergency guards', () => {
  it('keeps ammo indicators current when buying, restocking, and restoring without a simulation tick', () => {
    const { sim, ctx, s, t } = fixture('yard');
    s.phase = 'shop'; t.resources.ammo = 0;
    expect(sim.buyCar('flak')).toBe(true);
    expect(t.resources.ammo).toBe(12);
    expect(t.cars.at(-1)!.derived.hasAmmoSupply).toBe(true);
    addResource(ctx, 'ammo', -12);
    expect(t.cars.at(-1)!.derived.hasAmmoSupply).toBe(false);
    addResource(ctx, 'ammo', 5);
    expect(t.cars.at(-1)!.derived.hasAmmoSupply).toBe(true);
  });
  it('recomputes an old paused ammo-supply flag before showing the train', () => {
    const { sim, s, t } = fixture();
    s.phase = 'paused'; t.cars[3].derived.hasAmmoSupply = false;
    const copy = createSim(77, new EventBus());
    expect(copy.restore(sim.serialize())).toBe(true);
    expect(copy.state.train.cars[3].derived.hasAmmoSupply).toBe(true);
  });
  it.each(['gatling', 'cannon', 'flak'] as CarType[])('%s fires without any supplier and still spends ammo', type => {
    const { ctx, s, t } = fixture();
    t.cars = [makeCar(s, type)]; t.crew = [];
    t.trailX = [1000]; t.trailY = [1000]; t.trailAngle = [0];
    s.weather.kind = 'clear'; s.weather.intensity = 0;
    const e = spawnEnemy(ctx, type === 'flak' ? 'harpy' : 'raider', 1180, 1000)!;
    e.state = 'approach'; e.revealed = true; e.stunned = 5;
    const ammo = t.resources.ammo;
    propagate(ctx);
    expect(t.cars[0].derived.hasAmmoSupply).toBe(true);
    updateCombat(ctx);
    expect(t.resources.ammo).toBeCloseTo(ammo - CAR_DEFS[type].weapon!.ammoPerShot);
    t.resources.ammo = 0; t.cars[0].cooldown = 0;
    propagate(ctx); updateCombat(ctx);
    expect(t.resources.ammo).toBe(0);
    expect(t.cars[0].cooldown).toBe(0);
    expect(t.cars[0].derived.hasAmmoSupply).toBe(false);
  });

  function guardHit(specialty?: 'medic' | 'gunner', hp = 100, enemy: 'raider' | 'harpy' | 'wisp' = 'raider', disabled = false) {
    const { ctx, s, t } = fixture();
    t.cars = [makeCar(s, 'coach')]; t.crew = []; t.resources.ammo = 0;
    t.trailX = [1000]; t.trailY = [1000]; t.trailAngle = [0];
    t.cars[0].disabled = disabled;
    if (specialty) { const c = addCrew(s, specialty); c.hp = hp; c.carIndex = 0; t.cars[0].crewId = c.id; }
    s.weather.kind = 'clear';
    const e = spawnEnemy(ctx, enemy, 1070, 1000)!;
    e.state = 'approach'; e.revealed = true; e.stunned = 5;
    const before = e.hp;
    updateCombat(ctx);
    const damage = before - e.hp;
    updateCombat(ctx);
    expect(before - e.hp).toBeCloseTo(damage); // cooldown: not every tick
    expect(t.resources.ammo).toBe(0);
    return damage;
  }
  it('gives uncrewed cars weak sidearms, any living crew a bonus, and gunners a larger bonus', () => {
    expect(guardHit()).toBeCloseTo(4);
    expect(guardHit('medic')).toBeCloseTo(7);
    expect(guardHit('gunner')).toBeCloseTo(9);
    expect(guardHit('gunner', 0)).toBeCloseTo(4);
  });
  it('can engage air, respects wisp immunity, and disables offline guards', () => {
    expect(guardHit('gunner', 100, 'harpy')).toBeGreaterThan(0);
    expect(guardHit('gunner', 100, 'wisp')).toBe(0);
    expect(guardHit('gunner', 100, 'raider', true)).toBe(0);
  });
  it('shoots boarders on its own car without becoming an adjacent barracks', () => {
    const { ctx, s, t } = fixture();
    t.cars = [makeCar(s, 'coach'), makeCar(s, 'coal_bunker')];
    t.trailX = [1000, 960]; t.trailY = [1000, 1000]; t.trailAngle = [0, 0];
    t.cars[1].disabled = true;
    const own = spawnEnemy(ctx, 'raider', 1000, 1000)!, adjacent = spawnEnemy(ctx, 'raider', 960, 1000)!;
    for (const [i, e] of [own, adjacent].entries()) { e.state = 'boarded'; e.boardedCar = i; e.revealed = true; t.cars[i].boarders = [e.id]; }
    updateCombat(ctx);
    expect(own.hp).toBeLessThan(own.maxHp);
    expect(adjacent.hp).toBe(adjacent.maxHp);
  });
  it('can survive a small rear attack with its gun car gone and no shared ammo', () => {
    const { ctx, sim, s, t } = fixture();
    t.cars[3] = makeCar(s, 'coal_bunker'); t.resources.ammo = 0;
    t.trailX = t.cars.map((_, i) => 1000 - i * 40); t.trailY = t.cars.map(() => 1000); t.trailAngle = t.cars.map(() => 0);
    const crew = addCrew(s, 'gunner'); sim.assignCrew(crew.id, 5);
    for (let i = 0; i < 3; i++) {
      const e = spawnEnemy(ctx, 'raider', 780 - i * 12, 1060)!; e.state = 'approach'; e.revealed = true;
    }
    for (let i = 0; i < 800; i++) updateCombat(ctx);
    expect(s.phase).toBe('running'); expect(t.cars[5].hp).toBeGreaterThan(0);
    expect(s.stats.kills.raider).toBeGreaterThanOrEqual(1);
    expect(t.resources.ammo).toBe(0);
  });
});

describe('staffed settlement field service', () => {
  it.each(['village', 'depot', 'crossroads', 'market', 'farm', 'clinic', 'fuel', 'mine', 'armory'] as SettlementType[])('reorders at %s, retaining crew assignments and holding departure', type => {
    const { sim, s, t } = fixture(type);
    const c = addCrew(s, 'mechanic'); sim.assignCrew(c.id, 3);
    const id = t.cars[3].id;
    expect(sim.canReorder()).toBe(true);
    expect(sim.moveCar(3, 5)).toBe(true);
    expect(t.cars[5].id).toBe(id); expect(c.carIndex).toBe(5);
    expect(t.service).toBeDefined();
    expect(sim.moveCar(0, 1)).toBe(false);
    expect(sim.buyCar('gatling')).toBe(false);
    expect(sim.upgradeCar(1)).toBe(false);
    expect(sim.repairCar(1)).toBe(false);
  });
  it.each(['wreck', 'site', 'shrine', 'mystery'] as SettlementType[])('does not offer service at an unstaffed %s', type => {
    const { sim } = fixture(type);
    expect(sim.canService()).toBe(false); expect(sim.moveCar(2, 3)).toBe(false);
    expect(sim.setFieldRepair(true)).toBe(false);
  });
  it('repairs the weakest car at a predictable rate and bills only the actual restored hull', () => {
    const { sim, ctx, t } = fixture();
    const weak = t.cars[5], other = t.cars[4];
    weak.hp = weak.maxHp * .4; other.hp = other.maxHp * .7;
    const before = weak.hp, scrap = t.resources.scrap;
    expect(sim.setFieldRepair(true)).toBe(true);
    ctx.dt = 1;
    updateFieldService(ctx); expect(weak.hp).toBe(before);
    updateFieldService(ctx);
    expect(weak.hp).toBeCloseTo(before + weak.maxHp * .04);
    expect(t.resources.scrap).toBeCloseTo(scrap - weak.maxHp * .04 / 8);
    expect(other.hp).toBeCloseTo(other.maxHp * .7);
    for (let i = 0; i < 100; i++) updateFieldService(ctx);
    expect(weak.hp).toBeCloseTo(weak.maxHp * .8);
    expect(other.hp).toBeCloseTo(other.maxHp * .8);
    expect(t.cars[0].hp).toBe(t.cars[0].maxHp); // never lower a healthier hull
    expect(t.service?.repairing).toBe(false);
    expect(t.service).toBeDefined(); // completion does not force departure
  });
  it('handles a fractional final repair and an empty purse without free HP or negative scrap', () => {
    const { sim, ctx, t } = fixture();
    const c = t.cars[0]; c.hp = c.maxHp * .8 - 1;
    t.resources.scrap = .1;
    expect(sim.setFieldRepair(true)).toBe(true);
    ctx.dt = 2; updateFieldService(ctx);
    expect(t.resources.scrap).toBeCloseTo(0);
    expect(c.hp).toBeCloseTo(c.maxHp * .8 - .2);
    expect(t.service?.repairing).toBe(false);
    expect(sim.setFieldRepair(true)).toBe(false);
    t.resources.scrap = 1; sim.setFieldRepair(true); updateFieldService(ctx);
    expect(c.hp).toBeCloseTo(c.maxHp * .8);
    expect(t.resources.scrap).toBeCloseTo(.975);
  });
  it('runs world time while holding, pauses safely, and clears service on departure', () => {
    const { sim, t, s } = fixture();
    t.cars[0].hp = 100;
    sim.setFieldRepair(true);
    const voidX = s.void.front[0];
    for (let i = 0; i < 280; i++) sim.update(.05);
    expect(s.time).toBeGreaterThan(12); expect(t.stopped).toBe(true);
    expect(s.void.front[0]).toBeGreaterThan(voidX);
    sim.pause(); const hp = t.cars[0].hp, scrap = t.resources.scrap;
    for (let i = 0; i < 80; i++) sim.update(.05);
    expect(t.cars[0].hp).toBe(hp); expect(t.resources.scrap).toBe(scrap);
    sim.resume(); sim.depart();
    expect(t.service).toBeUndefined(); expect(sim.canReorder()).toBe(false);
  });
  it('saves mid-cycle, cancels without extra work, and restores old saves without starting service', () => {
    const { sim, ctx, t } = fixture(); t.cars[0].hp = 100;
    sim.setFieldRepair(true); ctx.dt = 1; updateFieldService(ctx);
    const copy = createSim(7, new EventBus()); expect(copy.restore(sim.serialize())).toBe(true);
    expect(copy.state.train.service?.repairTimer).toBe(1);
    sim.setFieldRepair(false); const hp = t.cars[0].hp;
    updateFieldService(ctx); expect(t.cars[0].hp).toBe(hp);
    sim.setServiceHold(false); expect(t.service).toBeUndefined(); expect(t.stopTimer).toBe(0);
    expect(copy.restore(sim.serialize())).toBe(true); expect(copy.state.train.service).toBeUndefined();
  });
  it('rejects commands in dialogue, while moving, and at consumed stops; clears stale restored service', () => {
    const { sim, s, t, stop } = fixture(); t.cars[0].hp = 100; sim.setFieldRepair(true);
    s.phase = 'event'; expect(sim.setFieldRepair(false)).toBe(false); expect(sim.moveCar(2, 3)).toBe(false);
    s.phase = 'running'; t.stopped = false; expect(sim.setFieldRepair(true)).toBe(false);
    t.stopped = true; stop.consumed = true; expect(sim.canService()).toBe(false);
    const copy = createSim(7, new EventBus()); copy.restore(sim.serialize()); expect(copy.state.train.service).toBeUndefined();
  });
  it('does not resurrect destroyed hulls or start a hold when asked to stop inactive repairs', () => {
    const { sim, t } = fixture();
    expect(sim.setFieldRepair(false)).toBe(true); expect(t.service).toBeUndefined();
    t.cars[4].hp = 0;
    expect(sim.setFieldRepair(true)).toBe(false); expect(t.cars[4].hp).toBe(0);
  });
});
