import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { activeEventDef, eventStepKey, KEEPER_HELPED } from '../core/conversations';
import { unmetEventRequirement } from '../core/eventRequirements';
import { createSim } from './sim';
import { onArrive } from './settlements';
import { Rng } from '../core/rng';
import { expeditionVoidCost } from './expedition';
import { VOID } from '../core/config';
import { createAutopilot } from '../debug/autopilot';
import type { AppContext } from '../app';

function fixture(id = 'node_crossroads') {
  const sim = createSim(12345, new EventBus());
  sim.debug.triggerEvent(id);
  return sim;
}
function copyOf(sim: ReturnType<typeof createSim>) {
  const copy = createSim(1, new EventBus());
  expect(copy.restore(sim.serialize())).toBe(true);
  return copy;
}
function options(sim: ReturnType<typeof createSim>) { return activeEventDef(sim.state)!.options; }
function finishFight(sim: ReturnType<typeof createSim>) {
  for (let i = 0; i < 300 && !sim.state.expedition!.outcome; i++) {
    const x = sim.state.expedition!;
    if (x.awaitingAdvance) sim.advanceExpedition(true);
    else if (x.pending) sim.expeditionResolve('perfect');
    else if (x.turn === 'player') sim.expeditionAction('strike');
  }
  expect(sim.state.expedition!.outcome).toBe('won');
}

describe('keeper conversation and expedition handoff', () => {
  it('lets the title/demo autopilot complete party preparation without a UI', () => {
    const sim = fixture('node_site');
    const pilot = createAutopilot({ sim } as AppContext);
    pilot.setEnabled(true);
    pilot.update(.6);
    expect(sim.state.activeEvent?.preparingExpedition).toBe(true);
    pilot.update(.6);
    expect(sim.state.phase).toBe('expedition');
  });
  it('previews the same minimum Void cost that immediate retreat actually charges', () => {
    const sim = fixture();
    sim.chooseEventOption(0); sim.chooseEventOption(0);
    sim.startExpedition([sim.state.train.crew[0].id]);
    const front = sim.state.void.front[0];
    sim.expeditionAction('flee');
    expect(sim.state.void.front[0] - front).toBeCloseTo(VOID.baseSpeed * expeditionVoidCost(0));
    expect(expeditionVoidCost(0)).toBe(expeditionVoidCost(1));
    expect(expeditionVoidCost(2)).toBe(2 * expeditionVoidCost(1));
  });
  it('natural arrival carries the location and boarding receipt and never replays a visited stop', () => {
    const sim = createSim(12345, new EventBus());
    const stop = sim.state.settlements.find(x => x.type === 'crossroads')!;
    stop.passengers = 3; stop.crew = 'mechanic';
    const ctx = { state: sim.state, bus: sim.bus, dt: .05, invulnerable: false, rng: { world: new Rng(1), waves: new Rng(2), combat: new Rng(3), events: new Rng(4) } };
    onArrive(ctx, stop); sim.bus.flush();
    expect(stop.visited).toBe(true);
    expect(sim.state.activeEvent?.locationId).toBe(stop.id);
    expect(sim.state.activeEvent?.arrival?.passengers).toBe(3);
    expect(sim.state.activeEvent?.arrival?.crewName).toBeTruthy();
    expect(sim.startExpedition([sim.state.train.crew[0].id])).toBe(false);
    sim.chooseEventOption(1); sim.chooseEventOption(1); sim.chooseEventOption(0);
    const marks = sim.state.train.marks;
    onArrive(ctx, stop); sim.bus.flush();
    expect(sim.state.activeEvent).toBeNull();
    expect(sim.state.train.marks).toBe(marks);
    expect(sim.state.stats.eventsResolved).toBe(1);
  });
  it('uses the same eligibility rules for copy and commit; always has a free exit', () => {
    const sim = fixture();
    const snapshot = sim.serialize();
    expect(options(sim).map(o => !!unmetEventRequirement(sim.state, o))).toEqual([false, true, true]);
    expect(sim.chooseEventOption(1)).toBe(false);
    expect(sim.chooseEventOption(2)).toBe(false);
    expect(JSON.parse(sim.serialize()).state).toEqual(JSON.parse(snapshot).state);
    expect(sim.chooseEventOption(0)).toBe(true);
    sim.state.train.resources.scrap = 0;
    sim.state.train.crew.forEach(c => c.hp = 20);
    expect(options(sim).map(o => !!unmetEventRequirement(sim.state, o))).toEqual([true, true, false]);
    expect(sim.chooseEventOption(2)).toBe(true);
    expect(sim.chooseEventOption(0)).toBe(true);
    expect(sim.state.phase).toBe('running');
    expect(sim.state.storyFlags).toBeUndefined();
  });

  it('recognizes a named Mechanic, revalidates health and charges the displayed cost once', () => {
    const sim = fixture();
    const mechanic = { id: 'test-mechanic', name: 'Vey', specialty: 'mechanic' as const, hp: 100, carIndex: -1 };
    sim.state.train.crew.push(mechanic);
    expect(options(sim)[1].label).toContain('Vey');
    expect(sim.chooseEventOption(1)).toBe(true);
    expect(options(sim)[1].requires?.amount).toBe(8);
    mechanic.hp = 20;
    expect(sim.chooseEventOption(1)).toBe(false);
    mechanic.hp = 21;
    const { scrap } = sim.state.train.resources;
    const marks = sim.state.train.marks;
    expect(sim.chooseEventOption(1)).toBe(true);
    expect(sim.state.train.resources.scrap).toBe(scrap - 8);
    expect(sim.state.train.marks).toBe(marks + 3);
    expect(sim.state.storyFlags).toEqual([KEEPER_HELPED]);
    expect(sim.chooseEventOption(1)).toBe(false);
    const copy = copyOf(sim);
    expect(copy.chooseEventOption(1)).toBe(false);
    expect(copy.chooseEventOption(0)).toBe(true);
    expect(copy.state.train.marks).toBe(marks + 3);
    expect(copy.state.stats.eventsResolved).toBe(1);
  });

  it('keeps the relic, persists goodwill, and shows the later keeper discount', () => {
    const sim = fixture();
    sim.state.train.relics.push('tinkers_kit');
    expect(sim.chooseEventOption(2)).toBe(true);
    const scrap = sim.state.train.resources.scrap;
    sim.state.train.relics = [];
    expect(sim.chooseEventOption(1)).toBe(false);
    sim.state.train.relics.push('tinkers_kit');
    expect(sim.chooseEventOption(1)).toBe(true);
    expect(sim.state.train.resources.scrap).toBe(scrap - 3);
    expect(sim.state.train.relics).toContain('tinkers_kit');
    const copy = copyOf(sim);
    copy.chooseEventOption(0);
    copy.debug.triggerEvent('node_crossroads');
    copy.chooseEventOption(0);
    expect(options(copy)[1].requires?.amount).toBe(20);
  });

  it('rejects a stale click from the preceding dialogue step without spending or preparing', () => {
    const sim = fixture();
    const token = eventStepKey(sim.state);
    expect(sim.chooseEventOption(0, token)).toBe(true);
    expect(sim.chooseEventOption(0, token)).toBe(false);
    expect(sim.state.activeEvent?.preparingExpedition).toBeFalsy();
  });

  it.each(['node_crossroads', 'node_site', 'mystery_away'])('%s keeps the choice on cancel and on preparation reload', id => {
    const sim = fixture(id);
    if (id === 'node_crossroads') sim.chooseEventOption(0);
    const before = { ...sim.state.train.resources };
    const route = JSON.stringify(sim.state.route.path);
    expect(sim.chooseEventOption(0)).toBe(true);
    expect(sim.state.phase).toBe('event');
    expect(sim.state.activeEvent?.preparingExpedition).toBe(true);
    expect(sim.chooseEventOption(0)).toBe(false);
    const copy = copyOf(sim);
    expect(copy.state.activeEvent?.preparingExpedition).toBe(false);
    expect(copy.state.activeEvent?.defId).toBe(id);
    expect(sim.cancelExpeditionPreparation()).toBe(true);
    expect(sim.state.activeEvent?.defId).toBe(id);
    expect(sim.state.train.resources).toEqual(before);
    expect(JSON.stringify(sim.state.route.path)).toBe(route);
    expect(sim.state.stats.eventsResolved).toBe(0);
  });

  it('restores a pending attack exactly without changing RNG, then returns wounded crew after retreat', () => {
    const sim = fixture();
    sim.chooseEventOption(0); sim.chooseEventOption(0);
    sim.startExpedition([sim.state.train.crew[0].id]);
    sim.expeditionAction('strike');
    const copy = copyOf(sim);
    expect(copy.state.phase).toBe('expedition');
    expect(copy.state.expedition).toEqual(sim.state.expedition);
    sim.expeditionResolve('good'); copy.expeditionResolve('good');
    expect(copy.state.expedition).toEqual(sim.state.expedition);
    for (let i = 0; copy.state.expedition!.pending && i < 20; i++) copy.expeditionResolve('good');
    copy.state.expedition!.actors[0].hp = 37;
    expect(copy.expeditionAction('flee')).toBe(true);
    expect(copy.endExpedition()).toBe(true);
    expect(copy.state.phase).toBe('event');
    expect(copy.state.activeEvent?.dialogue?.step).toBe('briefing');
    expect(copy.state.train.crew[0].hp).toBe(37);
    expect(copy.state.train.marks).toBe(0);
    expect(copy.state.storyFlags).toEqual([]);
    copy.chooseEventOption(0);
    expect(copy.startExpedition([copy.state.train.crew[0].id])).toBe(true);
    expect(copy.state.expedition!.stage).toBe(1);
    expect(copy.state.expedition!.actors[0].hp).toBe(37);
  });

  it('restores victory and relic selection with one reward, then shows the keeper receipt', () => {
    const sim = fixture();
    sim.chooseEventOption(0); sim.chooseEventOption(0);
    sim.startExpedition([sim.state.train.crew[0].id]);
    finishFight(sim);
    const marks = sim.state.train.marks;
    const front = [...sim.state.void.front];
    const result = copyOf(sim);
    expect(result.state.phase).toBe('expedition');
    expect(result.state.expedition!.summary).toContain('Ruin cleared');
    expect(result.expeditionResolve('perfect')).toBe(false);
    expect(result.endExpedition()).toBe(true);
    expect(result.endExpedition()).toBe(false);
    expect(result.state.phase).toBe('relic');
    const reward = copyOf(result);
    expect(reward.state.phase).toBe('relic');
    expect(reward.chooseRelic(0)).toBe(true);
    expect(reward.chooseRelic(0)).toBe(false);
    expect(reward.state.phase).toBe('event');
    expect(reward.state.activeEvent?.dialogue?.step).toBe('receipt');
    expect(reward.state.train.marks).toBe(marks);
    expect(reward.state.void.front).toEqual(front);
    expect(reward.state.storyFlags).toEqual([KEEPER_HELPED]);
    expect(reward.chooseEventOption(0)).toBe(true);
    expect(reward.state.phase).toBe('running');
    expect(reward.state.stats.eventsResolved).toBe(1);
    expect(reward.state.stats.expeditionsWon).toBe(1);
  });

  it('reads old active crossroads saves without requiring new fields', () => {
    const sim = fixture();
    const data = JSON.parse(sim.serialize());
    delete data.state.storyFlags;
    data.state.activeEvent = { defId: 'node_crossroads', startedAt: 0 };
    expect(sim.restore(JSON.stringify(data))).toBe(true);
    expect(options(sim)).toHaveLength(3);
    expect(sim.chooseEventOption(0)).toBe(true);
    const before = JSON.parse(sim.serialize()).state.rngState;
    for (let i = 0; i < 20; i++) { options(sim).forEach(o => unmetEventRequirement(sim.state, o)); }
    expect(JSON.parse(sim.serialize()).state.rngState).toEqual(before);
  });
});
