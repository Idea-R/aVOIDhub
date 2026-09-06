/** Pure combat contracts: previewing never draws RNG or changes the encounter. */
import type { ExpeditionActor, ExpeditionFoe, ExpeditionPosition, ExpeditionState, ExpeditionTiming } from './types';
import { EXPEDITION } from './config';

export const timingMul = (t: ExpeditionTiming): number => t === 'perfect' ? 1.5 : t === 'good' ? 1 : .5;
export const guardMul = (t: ExpeditionTiming): number => t === 'perfect' ? .25 : t === 'good' ? .5 : 1;
export const strikePositionMul = (p: ExpeditionPosition): number => p === 'front' ? 1.2 : p === 'rear' ? .85 : 1;
export const rangedPositionMul = (p: ExpeditionPosition): number => p === 'rear' ? 1.2 : p === 'front' ? .85 : 1;
export const standing = (a: ExpeditionActor): boolean => !a.down && a.hp > 0;

export function expeditionTargetWeight(position: ExpeditionPosition, range: 'melee' | 'ranged'): number {
  return (range === 'melee' ? position === 'front' : position === 'rear') ? 5 : position === 'middle' ? 2 : 1;
}

export function expeditionTargets(x: ExpeditionState, foe: ExpeditionFoe) {
  const alive = x.actors.map((actor, index) => ({ actor, index })).filter(t => standing(t.actor));
  const total = alive.reduce((sum, t) => sum + expeditionTargetWeight(t.actor.position, foe.range), 0);
  return alive.map(t => ({ ...t, weight: expeditionTargetWeight(t.actor.position, foe.range), chance: expeditionTargetWeight(t.actor.position, foe.range) / total }));
}

export function expeditionIncomingDamage(foe: ExpeditionFoe, actor: ExpeditionActor, timing: ExpeditionTiming): number {
  return Math.round(foe.atk * guardMul(timing) * (actor.guard > 0 ? .5 : 1));
}

export function expeditionStrikeDamage(x: ExpeditionState, actor: ExpeditionActor, timing: ExpeditionTiming): number {
  return Math.round(EXPEDITION.strike * (x.rally > 0 ? 1.5 : 1) * strikePositionMul(actor.position) * timingMul(timing));
}

export function expeditionEnemyIntent(x: ExpeditionState, index: number) {
  const foe = x.foes[index];
  const status = foe.hp <= 0 ? 'defeated' : x.outcome || x.awaitingAdvance ? 'finished'
    : x.turn === 'enemy' && index < x.activeFoe ? 'acted' : foe.stunned > 0 ? 'stunned'
    : x.turn === 'enemy' && x.pending?.foeIndex === index ? 'attacking' : 'waiting';
  const targetIndex = status === 'attacking' && x.pending && x.pending.actorIndex >= 0 ? x.pending.actorIndex : null;
  const actor = targetIndex !== null ? x.actors[targetIndex] : null;
  const hits = ['defeated', 'finished', 'acted', 'stunned'].includes(status) ? 0
    : status === 'attacking' ? 1 + (x.foeSwingsLeft ?? 0) : Math.max(1, foe.speed);
  return {
    status, hits, damage: foe.atk, range: foe.range, targetIndex,
    favoured: foe.range === 'melee' ? 'front' : 'rear',
    targets: expeditionTargets(x, foe),
    // These are the next blow's exact reductions. Later blows may pick another target.
    nextDamage: actor ? { miss: expeditionIncomingDamage(foe, actor, 'miss'), good: expeditionIncomingDamage(foe, actor, 'good'), perfect: expeditionIncomingDamage(foe, actor, 'perfect') } : null,
  };
}

export function expeditionPositionSummary(p: ExpeditionPosition): string {
  return p === 'front' ? 'Strike +20% · ranged skills −15% · melee favoured'
    : p === 'rear' ? 'Strike −15% · ranged skills +20% · ranged favoured'
    : 'No damage modifier · lower targeting weight';
}

export function expeditionSwapOptions(x: ExpeditionState) {
  const active = x.actors[x.activeActor];
  if (!active || !standing(active) || x.turn !== 'player' || x.pending || x.outcome || x.awaitingAdvance) return [];
  return x.actors.flatMap((ally, index) => index !== x.activeActor && standing(ally) ? [{ index, ally, from: active.position, to: ally.position }] : []);
}

/** Exact per-blow targeting probabilities before/after the selected position trade. */
export function expeditionSwapRisks(x: ExpeditionState, allyIndex: number) {
  const option = expeditionSwapOptions(x).find(o => o.index === allyIndex);
  if (!option) return [];
  const after = { ...x, actors: x.actors.map((a, i) => ({ ...a, position: i === x.activeActor ? option.to : i === allyIndex ? option.from : a.position })) };
  return x.foes.flatMap((foe, i) => {
    if (!expeditionEnemyIntent(x, i).hits) return [];
    return [{ name: foe.name, range: foe.range,
      before: expeditionTargets(x, foe).find(t => t.index === x.activeActor)!.chance,
      after: expeditionTargets(after, foe).find(t => t.index === x.activeActor)!.chance,
    }];
  });
}

export function expeditionTurnOrder(x: ExpeditionState) {
  const ended = !!x.outcome || x.awaitingAdvance;
  return [
    ...x.actors.map((a, i) => ({ key: a.id, name: a.name, side: 'crew', state: !standing(a) ? 'down' : ended || x.turn === 'enemy' || i < x.activeActor ? 'done' : x.turn === 'player' && i === x.activeActor ? 'active' : 'next' })),
    ...x.foes.map((f, i) => ({ key: f.id, name: f.name, side: 'foe', state: f.hp <= 0 ? 'down' : ended || x.turn === 'enemy' && i < x.activeFoe ? 'done' : f.stunned ? 'stunned' : x.turn === 'enemy' && i === x.activeFoe ? 'active' : 'next' })),
  ];
}
