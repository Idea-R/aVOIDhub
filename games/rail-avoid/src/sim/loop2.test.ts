import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/events';
import { createSim } from './sim';
import { TEST_SEED } from '../core/config';
import { expeditionStageRoster, expeditionTargetWeight } from './expedition';

function autoPhases(sim: ReturnType<typeof createSim>): void {
  const s = sim.state;
  if (s.phase === 'relic') sim.chooseRelic(0);
  else if (s.phase === 'event') { if (!sim.chooseEventOption(2)) { if (!sim.chooseEventOption(1)) sim.chooseEventOption(0); } }
  else if (s.phase === 'shop') sim.closeShop();
  else if (s.phase === 'expedition') {
    const x = s.expedition!;
    if (x.outcome) sim.endExpedition();
    else if (x.awaitingAdvance) sim.advanceExpedition(true);
    else if (x.pending) sim.expeditionResolve('good');
    else sim.expeditionAction('strike');
  }
}

describe('loot, relics, bounties, expeditions', () => {
  it('makes formation readable: melee pressures front and ranged pressures rear', () => {
    expect(expeditionTargetWeight('front', 'melee')).toBeGreaterThan(expeditionTargetWeight('rear', 'melee'));
    expect(expeditionTargetWeight('rear', 'ranged')).toBeGreaterThan(expeditionTargetWeight('front', 'ranged'));
  });

  it('escalates from human threats to distinct deep-ruin monsters', () => {
    expect(expeditionStageRoster(0, 1)).toEqual(['thug']);
    expect(expeditionStageRoster(1, 2)).toContain('fusilier');
    expect(expeditionStageRoster(2, 2)).toEqual(['wraith', 'fusilier']);
    expect(expeditionStageRoster(3, 3)).toEqual(['sentinel', 'wraith']);
  });

  it('swaps two living crew positions as a full turn action', () => {
    const sim = createSim(TEST_SEED, new EventBus());
    sim.state.train.crew.push({ id: 'crew-test', name: 'Pim', specialty: 'mechanic', carIndex: -1, hp: 100 });
    sim.debug.startExpedition();
    const x = sim.state.expedition!;
    expect(x.actors.map(a => a.position)).toEqual(['front', 'middle']);
    expect(sim.expeditionAction('swap')).toBe(true);
    expect(sim.expeditionResolve('good')).toBe(true);
    expect(x.actors.map(a => a.position)).toEqual(['middle', 'front']);
  });

  it('offers a risk decision between cleared stages and pays no final reward early', () => {
    const sim = createSim(TEST_SEED, new EventBus());
    const marks = sim.state.train.marks;
    sim.debug.startExpedition();
    let guard = 0;
    while (!sim.state.expedition!.awaitingAdvance && guard++ < 40) {
      const x = sim.state.expedition!;
      if (x.pending) sim.expeditionResolve('perfect');
      else sim.expeditionAction('strike');
    }
    expect(sim.state.expedition!.stage).toBe(1);
    expect(sim.state.expedition!.awaitingAdvance).toBe(true);
    expect(sim.state.expedition!.outcome).toBeNull();
    expect(sim.state.train.marks).toBe(marks);
    expect(sim.advanceExpedition(false)).toBe(true);
    expect(sim.state.expedition!.outcome).toBe('fled');
    expect(sim.state.train.marks).toBe(marks);
  });

  it('offers and applies relics', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    let offered: string[] = [];
    bus.on('relic:offer', p => { offered = p.options; });
    sim.debug.offerRelics();
    expect(sim.state.phase).toBe('relic');
    expect(offered.length).toBe(3);
    expect(sim.chooseRelic(1)).toBe(true);
    expect(sim.state.train.relics).toEqual([offered[1]]);
    expect(sim.state.phase).toBe('running');
  });

  it('elite kills drop marks and a relic offer; salvage is collected by the train', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    sim.debug.godTrain();
    sim.debug.invulnerable(true);
    sim.debug.warpToRegion(2);
    let pickups = 0; bus.on('loot:pickup', () => pickups++);
    let elites = 0; bus.on('enemy:elite', () => elites++);
    for (let w = 0; w < 6; w++) {
      if (sim.state.phase === 'running') sim.debug.spawnWave(['raider', 'raider', 'hound', 'hound', 'crawler']);
      for (let i = 0; i < 300; i++) {
        autoPhases(sim);
        if (i % 10 === 0 && sim.state.phase === 'running') { const o = sim.plannableTiles(); if (o.length) sim.planTile(o[0].col, o[0].row); }
        sim.update(0.05);
      }
    }
    expect(elites).toBeGreaterThan(0);
    expect(sim.state.train.marks).toBeGreaterThan(0);
    expect(sim.state.train.relics.length).toBeGreaterThan(0);
    expect(pickups).toBeGreaterThan(0);
  });

  it('runs a full expedition with perfect inputs and pays out on a win', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    expect(sim.state.train.crew.some(c => c.specialty === 'conductor')).toBe(true);
    sim.debug.startExpedition();
    expect(sim.state.phase).toBe('expedition');
    let guard = 0;
    while (!sim.state.expedition!.outcome && guard++ < 200) {
      const x = sim.state.expedition!;
      if (x.awaitingAdvance) sim.advanceExpedition(true);
      else if (x.pending) sim.expeditionResolve('perfect');
      else if (x.turn === 'player') sim.expeditionAction('strike');
    }
    expect(sim.state.expedition!.outcome).toBe('won');
    expect(sim.state.train.marks).toBeGreaterThan(0);
    expect(sim.endExpedition()).toBe(true);
    expect(sim.state.phase).toBe('relic');
    expect(sim.chooseRelic(0)).toBe(true);
    expect(sim.state.phase).toBe('running');
  });

  it('a lone conductor who misses every input loses or withdraws', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    sim.debug.warpToRegion(3);
    sim.debug.startExpedition();
    let guard = 0;
    while (sim.state.expedition && !sim.state.expedition.outcome && guard++ < 400) {
      const x = sim.state.expedition;
      if (x.awaitingAdvance) sim.advanceExpedition(true);
      else if (x.pending) sim.expeditionResolve('miss');
      else if (x.turn === 'player') sim.expeditionAction('guard');
    }
    expect(['lost', 'fled']).toContain(sim.state.expedition!.outcome);
    sim.endExpedition();
    expect(sim.state.phase).toBe('running');
  });

  it('settlements post bounties during a run', () => {
    const bus = new EventBus();
    const sim = createSim(TEST_SEED, bus);
    let posted = 0; bus.on('bounty:new', () => posted++);
    for (let i = 0; i < 20 * 240; i++) {
      const s = sim.state;
      autoPhases(sim);
      if (i % 10 === 0 && s.phase === 'running') {
        if (s.route.path.length - 1 - s.train.routeIndex < 4) {
          const end = s.route.path[s.route.path.length - 1];
          const target = s.settlements.filter(st => !st.visited && !st.consumed && st.col > end[0]).sort((a, b) => (a.col - end[0]) + Math.abs(a.row - end[1]) * 0.5 - ((b.col - end[0]) + Math.abs(b.row - end[1]) * 0.5))[0];
          if (!target || !sim.planPathTo(target.col, target.row).ok) { const o = sim.plannableTiles().sort((a, b) => b.col - a.col)[0]; if (o) sim.planTile(o.col, o.row); }
        }
        if (s.train.stopped && s.train.stopReason === 'settlement' && s.train.stopTimer > 2) sim.depart();
      }
      sim.update(0.05);
      if (s.phase === 'defeat') break;
    }
    expect(posted).toBeGreaterThan(0);
    expect(sim.state.bounties.length).toBeGreaterThan(0);
  });
});
