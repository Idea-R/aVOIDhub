import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { createSim } from './sim';
import { EXPEDITION_FOES } from './expedition';
import { expeditionEnemyIntent, expeditionIncomingDamage, expeditionStrikeDamage, expeditionSwapOptions, expeditionSwapRisks, expeditionTargets, expeditionTurnOrder } from '../core/expeditionRules';
import type { ExpeditionPosition, ExpeditionTiming } from '../core/types';

function fixture(kind = 'hound') {
  const sim = createSim(12345, new EventBus());
  sim.state.train.crew.push({ id: 'nils', name: 'Nils', specialty: 'gunner', hp: 100, carIndex: -1 }, { id: 'ines', name: 'Ines', specialty: 'medic', hp: 100, carIndex: -1 });
  sim.startExpedition(sim.state.train.crew.map(c => c.id));
  const x = sim.state.expedition!;
  const f = EXPEDITION_FOES[kind];
  x.foes = [{ ...f, id: 'test-foe', kind, hp: 500, maxHp: 500, stunned: 0 }];
  return { sim, x };
}
function stateOf(sim: ReturnType<typeof createSim>) { return JSON.parse(sim.serialize()).state; }
function enemyTurn(sim: ReturnType<typeof createSim>) {
  while (sim.state.expedition!.turn === 'player') { sim.expeditionAction('guard'); sim.expeditionResolve('good'); }
}

describe('shared expedition previews and deliberate swaps', () => {
  it('does not mutate the encounter or advance RNG when inspected repeatedly', () => {
    const { sim, x } = fixture(); const before = stateOf(sim);
    for (let i = 0; i < 100; i++) { expeditionEnemyIntent(x, 0); expeditionSwapRisks(x, 2); expeditionTurnOrder(x); expeditionStrikeDamage(x, x.actors[0], 'good'); }
    expect(stateOf(sim)).toEqual(before);
  });
  it.each(Object.keys(EXPEDITION_FOES))('%s: previewed weights and attack count match resolution', kind => {
    const { sim, x } = fixture(kind);
    const preview = expeditionEnemyIntent(x, 0);
    expect(preview.hits).toBe(EXPEDITION_FOES[kind].speed);
    const targets = expeditionTargets(x, x.foes[0]);
    const rng = new Rng(stateOf(sim).rngState.events);
    const chosen = rng.weighted(targets, targets.map(t => t.weight));
    enemyTurn(sim);
    expect(x.pending!.actorIndex).toBe(chosen.index);
    let swings = 0;
    while (x.turn === 'enemy') {
      const intent = expeditionEnemyIntent(x, 0);
      expect(intent.hits).toBe(preview.hits - swings);
      const victim = x.actors[x.pending!.actorIndex]; const hp = victim.hp;
      expect(intent.targetIndex).toBe(x.pending!.actorIndex);
      sim.expeditionResolve('good'); swings++;
      expect(hp - victim.hp).toBe(intent.nextDamage!.good);
    }
    expect(swings).toBe(preview.hits);
  });
  it.each(['front', 'middle', 'rear'] as ExpeditionPosition[])('%s strikes match the preview at every timing and rally state', position => {
    for (const timing of ['miss', 'good', 'perfect'] as ExpeditionTiming[]) for (const rally of [0, 1]) {
      const { sim, x } = fixture(); x.actors[0].position = position; x.rally = rally;
      const amount = expeditionStrikeDamage(x, x.actors[0], timing), hp = x.foes[0].hp;
      sim.expeditionAction('strike', 0); sim.expeditionResolve(timing);
      expect(hp - x.foes[0].hp).toBe(amount);
    }
  });
  it('guard reduces exactly one hit and each second blow picks a living target', () => {
    const { sim, x } = fixture(); enemyTurn(sim);
    const first = x.actors[x.pending!.actorIndex]; first.hp = 1;
    expect(expeditionIncomingDamage(x.foes[0], first, 'miss')).toBe(2);
    sim.expeditionResolve('miss');
    expect(first.down).toBe(true); expect(first.guard).toBe(0);
    const second = x.actors[x.pending!.actorIndex]; expect(second.id).not.toBe(first.id);
    expect(expeditionEnemyIntent(x, 0).targets.every(t => !t.actor.down)).toBe(true);
    sim.expeditionResolve('perfect'); expect(x.turn).toBe('player');
  });
  it('shows zero attacks for stun, then resumes normal intent next round', () => {
    const { sim, x } = fixture(); x.foes[0].stunned = 1;
    expect(expeditionEnemyIntent(x, 0).hits).toBe(0);
    enemyTurn(sim); expect(x.pending!.actorIndex).toBe(-1);
    const hp = x.actors.map(a => a.hp); sim.expeditionResolve('miss');
    expect(x.actors.map(a => a.hp)).toEqual(hp);
    expect(expeditionEnemyIntent(x, 0).hits).toBe(2);
  });
  it('requires the exact living partner and previewing/cancelling changes no turn', () => {
    const { sim, x } = fixture(); const before = stateOf(sim);
    expect(expeditionSwapOptions(x).map(o => o.index)).toEqual([1, 2]);
    expect(expeditionSwapRisks(x, 2)[0].after).toBeLessThan(expeditionSwapRisks(x, 2)[0].before);
    for (const invalid of [undefined, -1, 0, 3, NaN, 1.5]) expect(sim.expeditionAction('swap', undefined, invalid)).toBe(false);
    expect(stateOf(sim)).toEqual(before);
    expect(sim.expeditionAction('swap', undefined, 2)).toBe(true);
    expect(sim.expeditionAction('swap', undefined, 1)).toBe(false);
    sim.expeditionResolve('good');
    expect(x.actors.map(a => a.position)).toEqual(['rear', 'middle', 'front']);
    expect(x.activeActor).toBe(1); // Formation does not grant or reorder turns.
    expect(sim.expeditionResolve('good')).toBe(false);
  });
  it('rejects a downed or stale partner without spending a turn', () => {
    const { sim, x } = fixture(); x.actors[1].hp = 0; x.actors[1].down = true;
    expect(expeditionSwapOptions(x).map(o => o.index)).toEqual([2]);
    expect(sim.expeditionAction('swap', undefined, 1)).toBe(false);
    sim.expeditionAction('swap', undefined, 2); x.actors[2].hp = 0; x.actors[2].down = true;
    expect(sim.expeditionResolve('good')).toBe(false);
    expect(x.activeActor).toBe(0); expect(x.pending).toBeNull();
    expect(x.actors[0].position).toBe('front');
  });
  it('preserves an explicit pending swap across reload and migrates old pending swaps once', () => {
    const { sim } = fixture(); sim.expeditionAction('swap', undefined, 2);
    const save = sim.serialize(); const copy = createSim(1, new EventBus());
    expect(copy.restore(save)).toBe(true); copy.expeditionResolve('good');
    expect(copy.state.expedition!.actors.map(a => a.position)).toEqual(['rear', 'middle', 'front']);
    const legacy = JSON.parse(save); delete legacy.state.expedition.pending.swapActorIndex;
    expect(copy.restore(JSON.stringify(legacy))).toBe(true);
    expect(copy.state.expedition!.pending!.swapActorIndex).toBe(1);
    copy.expeditionResolve('good');
    expect(copy.state.expedition!.actors.map(a => a.position)).toEqual(['middle', 'front', 'rear']);
  });
  it('rejects a committed swap if the active turn changed before resolution', () => {
    const { sim, x } = fixture(); sim.expeditionAction('swap', undefined, 2);
    x.activeActor = 1;
    expect(sim.expeditionResolve('good')).toBe(false);
    expect(x.activeActor).toBe(1); expect(x.pending).toBeNull();
    expect(x.actors.map(a => a.position)).toEqual(['front', 'middle', 'rear']);
  });
  it('all guard timing reductions match the next blow with and without a brace', () => {
    for (const timing of ['miss', 'good', 'perfect'] as ExpeditionTiming[]) for (const guard of [0, 1]) {
      const { sim, x } = fixture('fusilier'); enemyTurn(sim);
      const actor = x.actors[x.pending!.actorIndex]; actor.guard = guard;
      const hp = actor.hp, intent = expeditionEnemyIntent(x, 0);
      expect(intent.nextDamage![timing]).toBe(expeditionIncomingDamage(x.foes[0], actor, timing));
      sim.expeditionResolve(timing);
      expect(hp - actor.hp).toBe(intent.nextDamage![timing]); expect(actor.guard).toBe(0);
    }
  });
  it('skips a stunned foe without duplicating the following multi-hit turn', () => {
    const { sim, x } = fixture('fusilier'); x.foes[0].stunned = 1;
    x.foes.push({ ...EXPEDITION_FOES.hound, id: 'second', kind: 'hound', hp: 100, maxHp: 100, stunned: 0 });
    enemyTurn(sim);
    expect(x.activeFoe).toBe(1); expect(expeditionEnemyIntent(x, 0).hits).toBe(0);
    expect(expeditionEnemyIntent(x, 1).hits).toBe(2);
    sim.expeditionResolve('good'); expect(expeditionEnemyIntent(x, 1).hits).toBe(1);
    sim.expeditionResolve('good'); expect(x.turn).toBe('player'); expect(x.round).toBe(2);
  });
  it('round order retains IDs and marks spent, stunned and downed actors honestly', () => {
    const { x } = fixture(); const ids = expeditionTurnOrder(x).map(a => a.key);
    x.activeActor = 1; x.actors[2].down = true; x.foes[0].stunned = 1;
    expect(expeditionTurnOrder(x).map(a => a.state)).toEqual(['done', 'active', 'down', 'stunned']);
    [x.actors[0].position, x.actors[1].position] = [x.actors[1].position, x.actors[0].position];
    expect(expeditionTurnOrder(x).map(a => a.key)).toEqual(ids);
  });
});
