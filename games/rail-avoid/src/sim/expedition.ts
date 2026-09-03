/**
 * Expeditions: deterministic, staged, timed-hit crew battles at Expedition Sites.
 * The sim owns combat numbers, formation rules and rewards; the UI owns animation/timing.
 */
import type {
  SimState, ExpeditionState, ExpeditionActor, ExpeditionFoe, CrewSpecialty,
  ExpeditionTiming, ExpeditionActionKind, ExpeditionPosition, ExpeditionStageKey,
} from '../core/types';
import type { SimContext } from './api';
import { EXPEDITION, VOID } from '../core/config';
import { addResource, log, nextId } from './helpers';
import { addMarks, offerRelics } from './loot';
import { addCrew } from './train';

const FOES: Record<string, { name: string; hp: number; atk: number; speed: number; desc: string; range: 'melee' | 'ranged' }> = {
  thug: { name: 'Rail Thug', hp: 26, atk: 6, speed: 1, range: 'melee', desc: 'Melee · hunts the front. Guard when the rail-club rises.' },
  hound: { name: 'Void Hound', hp: 18, atk: 4, speed: 2, range: 'melee', desc: 'Melee · bites twice. Fast, fragile, front-hunting.' },
  shade: { name: 'Void Shade', hp: 34, atk: 8, speed: 1, range: 'ranged', desc: 'Ranged · reaches for the rear. Hates fire and light.' },
  brute: { name: 'Scrap Brute', hp: 48, atk: 10, speed: 1, range: 'melee', desc: 'Melee · slow, armoured, and drawn to the front.' },
};

const STAGE_KEYS: ExpeditionStageKey[] = ['ruin_approach', 'buried_concourse', 'void_sanctum'];
const POSITIONS: ExpeditionPosition[] = ['front', 'middle', 'rear'];

export const SPECIALS: Record<CrewSpecialty, { name: string; desc: string }> = {
  conductor: { name: 'Whistle', desc: 'Rally: the whole crew deals +50% damage this round.' },
  engineer: { name: 'Overcharge', desc: 'A heavy strike (×2.2). Costs 4 of your own HP.' },
  gunner: { name: 'Volley', desc: 'Hit every foe. Strongest from the rear line.' },
  medic: { name: 'Patch', desc: 'Heal the most wounded ally by 14.' },
  surveyor: { name: 'Flare', desc: 'Stun a foe. Strongest from the rear line.' },
  mechanic: { name: 'Wrench', desc: 'Strike and gain a guard that halves the next hit.' },
  quartermaster: { name: 'Bribe', desc: '50%: a foe leaves. Costs 6 scrap.' },
};

function timingMul(t: ExpeditionTiming): number { return t === 'perfect' ? 1.5 : t === 'good' ? 1 : 0.5; }
function guardMul(t: ExpeditionTiming): number { return t === 'perfect' ? 0.25 : t === 'good' ? 0.5 : 1; }
function strikePositionMul(p: ExpeditionPosition): number { return p === 'front' ? 1.2 : p === 'rear' ? 0.85 : 1; }
function rangedPositionMul(p: ExpeditionPosition): number { return p === 'rear' ? 1.2 : p === 'front' ? 0.85 : 1; }

/** Explicit combat rule, exported so balancing tests can lock the formation contract. */
export function expeditionTargetWeight(position: ExpeditionPosition, range: 'melee' | 'ranged'): number {
  if (range === 'melee') return position === 'front' ? 5 : position === 'middle' ? 2 : 1;
  return position === 'rear' ? 5 : position === 'middle' ? 2 : 1;
}

function stageRoster(region: number, stage: number): string[] {
  const rosters: string[][][] = [
    [['thug'], ['hound']],
    [['thug', 'hound'], ['thug', 'thug']],
    [['thug', 'hound'], ['shade', 'hound'], ['brute', 'thug']],
    [['shade', 'hound'], ['brute', 'thug'], ['brute', 'shade']],
  ];
  const byRegion = rosters[Math.max(0, Math.min(rosters.length - 1, region))];
  return byRegion[Math.max(0, Math.min(byRegion.length - 1, stage - 1))];
}

function makeStageFoes(ctx: SimContext, stage: number): ExpeditionFoe[] {
  const region = ctx.state.region;
  const scale = 1 + region * 0.16 + (stage - 1) * 0.07;
  return stageRoster(region, stage).map(key => {
    const f = FOES[key];
    const hp = Math.round(f.hp * scale);
    return { id: nextId(ctx.state, 'foe'), kind: key, name: f.name, hp, maxHp: hp, atk: Math.round(f.atk * scale), speed: f.speed, stunned: 0, desc: f.desc, range: f.range };
  });
}

export function canExpedition(state: SimState): boolean {
  return (state.train.crew ?? []).some(c => c.hp > 20);
}

export function startExpedition(ctx: SimContext, crewIds: string[], siteId: string): boolean {
  const { state } = ctx;
  if (state.phase !== 'event' && state.phase !== 'running') return false;
  const chosen = state.train.crew.filter(c => crewIds.includes(c.id) && c.hp > 20).slice(0, EXPEDITION.maxCrew);
  if (chosen.length === 0) return false;
  const stageCount = state.region >= 2 ? 3 : 2;
  const actors: ExpeditionActor[] = chosen.map((c, i) => ({
    id: c.id, name: c.name, specialty: c.specialty, hp: c.hp, maxHp: 100,
    guard: 0, down: false, position: POSITIONS[i] ?? 'rear',
  }));
  const foes = makeStageFoes(ctx, 1);
  state.expedition = {
    siteId, round: 1, rounds: 0, stage: 1, stageCount, stageKey: STAGE_KEYS[0], awaitingAdvance: false,
    turn: 'player', activeActor: 0, activeFoe: 0, actors, foes, rally: 0,
    pending: null, log: [`The crew reaches the outer works of ${siteId}.`], outcome: null, rewardRelic: false,
  };
  state.phaseBeforeExpedition = 'running';
  state.phase = 'expedition';
  state.activeEvent = null;
  ctx.bus.defer('phase:change', { phase: 'expedition' });
  ctx.bus.defer('expedition:start', { siteId, crew: actors.map(a => a.name), foes: foes.map(f => f.name) });
  ctx.bus.defer('expedition:stage', { stage: 1, stageCount, stageKey: STAGE_KEYS[0], foes: foes.map(f => f.name) });
  log(state, 'An expedition sets out', 'info');
  return true;
}

function nextActor(x: ExpeditionState, from: number): number {
  for (let k = 1; k <= x.actors.length; k++) { const i = (from + k) % x.actors.length; if (!x.actors[i].down) return i; }
  return -1;
}
function firstFoe(x: ExpeditionState): number { return x.foes.findIndex(f => f.hp > 0); }

/** Player declares an action. The UI animates it and calls expeditionResolve. */
export function expeditionAction(ctx: SimContext, kind: ExpeditionActionKind, targetFoe?: number): boolean {
  const x = ctx.state.expedition;
  if (!x || ctx.state.phase !== 'expedition' || x.turn !== 'player' || x.pending || x.outcome || x.awaitingAdvance) return false;
  const actor = x.actors[x.activeActor];
  if (!actor || actor.down) return false;
  if (kind === 'flee') {
    x.outcome = 'fled';
    x.log.push('The crew falls back to the train.');
    finish(ctx);
    return true;
  }
  let tf = targetFoe ?? firstFoe(x);
  if (tf < 0 || !x.foes[tf] || x.foes[tf].hp <= 0) tf = firstFoe(x);
  if (tf < 0) return false;
  if (kind === 'swap' && x.actors.filter(a => !a.down).length < 2) return false;
  x.pending = { kind, actorIndex: x.activeActor, foeIndex: tf };
  ctx.bus.defer('expedition:pending', { kind, actor: actor.name, foe: x.foes[tf].name, turn: 'player' });
  return true;
}

function completePlayerTurn(ctx: SimContext): void {
  const x = ctx.state.expedition!;
  const next = nextActor(x, x.activeActor);
  if (next > x.activeActor) { x.activeActor = next; return; }
  x.turn = 'enemy';
  x.activeFoe = firstFoe(x);
  queueEnemyAttack(ctx);
}

function onStageCleared(ctx: SimContext): void {
  const x = ctx.state.expedition!;
  if (x.stage >= x.stageCount) {
    x.outcome = 'won';
    finish(ctx);
    return;
  }
  x.awaitingAdvance = true;
  x.turn = 'player';
  x.pending = null;
  x.log.push(`Stage ${x.stage} cleared. The passage continues below.`);
  ctx.bus.defer('expedition:stageCleared', { stage: x.stage, stageCount: x.stageCount });
}

/** Continue into the next chamber, or bank survival and withdraw without final rewards. */
export function advanceExpedition(ctx: SimContext, continueDeeper: boolean): boolean {
  const x = ctx.state.expedition;
  if (!x || ctx.state.phase !== 'expedition' || !x.awaitingAdvance || x.outcome) return false;
  if (!continueDeeper) {
    x.outcome = 'fled';
    x.log.push(`The crew withdraws after clearing ${x.stage} stage${x.stage === 1 ? '' : 's'}.`);
    finish(ctx);
    return true;
  }
  x.stage++;
  x.stageKey = STAGE_KEYS[Math.min(STAGE_KEYS.length - 1, x.stage - 1)];
  x.round = 1;
  x.foes = makeStageFoes(ctx, x.stage);
  x.activeFoe = 0;
  x.activeActor = nextActor(x, -1);
  x.awaitingAdvance = false;
  x.pending = null;
  x.rally = 0;
  x.log.push(`Stage ${x.stage}: ${x.stageKey === 'buried_concourse' ? 'the buried concourse' : 'the void sanctum'}.`);
  ctx.bus.defer('expedition:stage', { stage: x.stage, stageCount: x.stageCount, stageKey: x.stageKey, foes: x.foes.map(f => f.name) });
  return true;
}

/** Resolve the pending timed action or incoming blow. */
export function expeditionResolve(ctx: SimContext, timing: ExpeditionTiming): boolean {
  const { state } = ctx;
  const x = state.expedition;
  if (!x || state.phase !== 'expedition' || !x.pending || x.outcome) return false;
  const rng = ctx.rng.events;
  const p = x.pending;
  x.pending = null;
  if (x.turn === 'player') {
    const actor = x.actors[p.actorIndex];
    const foe = x.foes[p.foeIndex];
    if (!actor || !foe) return false;
    const rally = x.rally > 0 ? 1.5 : 1;
    const base = EXPEDITION.strike * rally;
    const hit = (f: ExpeditionFoe, dmg: number) => {
      const amount = Math.round(dmg);
      f.hp = Math.max(0, f.hp - amount);
      x.log.push(`${actor.name} hits ${f.name} for ${amount}.`);
      ctx.bus.defer('expedition:hit', { target: 'foe', name: f.name, amount, timing });
    };
    switch (p.kind) {
      case 'strike': hit(foe, base * strikePositionMul(actor.position) * timingMul(timing)); break;
      case 'special': {
        const ranged = rangedPositionMul(actor.position);
        switch (actor.specialty) {
          case 'conductor': x.rally = 1; x.log.push(`${actor.name} blows the whistle. The crew rallies!`); break;
          case 'engineer': hit(foe, base * 2.2 * strikePositionMul(actor.position) * (timing === 'miss' ? 0.5 : 1)); actor.hp = Math.max(1, actor.hp - 4); break;
          case 'gunner': for (const f of x.foes) if (f.hp > 0) hit(f, base * 0.6 * ranged * timingMul(timing)); break;
          case 'medic': { const w = x.actors.filter(a => !a.down).sort((a, b) => a.hp - b.hp)[0]; if (w) { const heal = timing === 'perfect' ? 20 : 14; w.hp = Math.min(w.maxHp, w.hp + heal); x.log.push(`${actor.name} patches ${w.name}.`); ctx.bus.defer('expedition:hit', { target: 'heal', name: w.name, amount: heal, timing }); } break; }
          case 'surveyor': foe.stunned = 1; x.log.push(`${actor.name} fires a flare. ${foe.name} is dazzled.`); hit(foe, base * 0.4 * ranged); break;
          case 'mechanic': hit(foe, base * strikePositionMul(actor.position) * timingMul(timing)); actor.guard = 1; break;
          case 'quartermaster': if (state.train.resources.scrap >= 6) { addResource(ctx, 'scrap', -6); if (rng.chance(timing === 'perfect' ? 0.75 : 0.5)) { foe.hp = 0; x.log.push(`${foe.name} takes the scrap and leaves.`); } else x.log.push(`${foe.name} pockets the scrap and stays.`); } else hit(foe, base * timingMul(timing)); break;
        }
        break;
      }
      case 'guard': actor.guard = 1; x.log.push(`${actor.name} braces in the ${actor.position} line.`); break;
      case 'swap': {
        const otherIndex = nextActor(x, x.activeActor);
        const other = x.actors[otherIndex];
        if (other && otherIndex !== x.activeActor) {
          [actor.position, other.position] = [other.position, actor.position];
          x.log.push(`${actor.name} swaps to ${actor.position}; ${other.name} takes ${other.position}.`);
        }
        break;
      }
      case 'flee': break;
    }
    if (x.foes.every(f => f.hp <= 0)) { onStageCleared(ctx); return true; }
    completePlayerTurn(ctx);
    return true;
  }

  const foe = x.foes[p.foeIndex];
  const actor = x.actors[p.actorIndex];
  if (foe && actor && !actor.down && foe.hp > 0) {
    let dmg = foe.atk * guardMul(timing);
    if (actor.guard > 0) { dmg *= 0.5; actor.guard = 0; }
    dmg = Math.round(dmg);
    actor.hp = Math.max(0, actor.hp - dmg);
    x.log.push(`${foe.name} hits ${actor.name} in the ${actor.position} for ${dmg}.`);
    ctx.bus.defer('expedition:hit', { target: 'actor', name: actor.name, amount: dmg, timing });
    if (actor.hp <= 0) { actor.down = true; actor.hp = 0; x.log.push(`${actor.name} goes down!`); }
  }
  if (x.actors.every(a => a.down)) { x.outcome = 'lost'; finish(ctx); return true; }
  const swings = x.foeSwingsLeft ?? 0;
  if (swings > 0) { x.foeSwingsLeft = swings - 1; queueEnemyAttack(ctx, p.foeIndex); return true; }
  const nextFoe = x.foes.findIndex((f, i) => i > p.foeIndex && f.hp > 0);
  if (nextFoe >= 0) { x.activeFoe = nextFoe; queueEnemyAttack(ctx); return true; }
  for (const f of x.foes) if (f.stunned > 0) f.stunned--;
  x.rally = 0;
  x.round++;
  x.rounds++;
  x.turn = 'player';
  x.activeActor = nextActor(x, -1);
  ctx.bus.defer('expedition:round', { round: x.round });
  if (x.round > EXPEDITION.maxRounds) { x.outcome = 'fled'; x.log.push('The chamber shifts as the void closes in. The crew runs for the train.'); finish(ctx); }
  return true;
}

function queueEnemyAttack(ctx: SimContext, foeIndex?: number): void {
  const x = ctx.state.expedition!;
  const fi = foeIndex ?? x.activeFoe;
  const foe = x.foes[fi];
  if (!foe || foe.hp <= 0) { x.pending = null; return; }
  if (foe.stunned > 0) {
    x.log.push(`${foe.name} is stunned.`);
    const nextFoe = x.foes.findIndex((f, i) => i > fi && f.hp > 0);
    if (nextFoe >= 0) { x.activeFoe = nextFoe; queueEnemyAttack(ctx); return; }
    x.foeSwingsLeft = 0;
    x.pending = { kind: 'strike', actorIndex: -1, foeIndex: fi };
    ctx.bus.defer('expedition:pending', { kind: 'skip', actor: '', foe: foe.name, turn: 'enemy' });
    return;
  }
  if (foeIndex === undefined) x.foeSwingsLeft = Math.max(0, foe.speed - 1);
  const alive = x.actors.map((a, i) => ({ a, i })).filter(t => !t.a.down);
  const target = ctx.rng.events.weighted(alive, alive.map(t => expeditionTargetWeight(t.a.position, foe.range)));
  x.pending = { kind: 'strike', actorIndex: target.i, foeIndex: fi };
  ctx.bus.defer('expedition:pending', { kind: 'attack', actor: target.a.name, foe: foe.name, turn: 'enemy' });
}

function finish(ctx: SimContext): void {
  const { state } = ctx;
  const x = state.expedition!;
  const rng = ctx.rng.events;
  for (const a of x.actors) {
    const c = state.train.crew.find(cr => cr.id === a.id);
    if (c) c.hp = a.down ? 15 : Math.max(15, a.hp);
  }
  const creep = VOID.baseSpeed * EXPEDITION.voidSecondsPerRound * Math.max(1, x.rounds);
  for (let r = 0; r < state.void.front.length; r++) state.void.front[r] += creep;
  let summary = '';
  if (x.outcome === 'won') {
    const marks = rng.int(EXPEDITION.marks[0], EXPEDITION.marks[1]) + Math.max(0, x.stageCount - 2);
    addMarks(ctx, marks, 'expedition');
    const scrap = rng.int(10, 18) + x.stageCount * 2;
    addResource(ctx, 'scrap', scrap);
    summary = `Ruin cleared through ${x.stageCount} stages. +${marks} marks, +${scrap} scrap.`;
    if (rng.chance(EXPEDITION.rescueChance) && state.train.crew.length < 8) {
      const spec = rng.pick(['gunner', 'medic', 'mechanic', 'surveyor', 'engineer'] as CrewSpecialty[]);
      const c = addCrew(state, spec);
      ctx.bus.defer('crew:joined', { specialty: spec, name: c.name });
      summary += ` ${c.name} the ${spec} was found alive and joins.`;
    }
    x.rewardRelic = true;
    state.stats.expeditionsWon = (state.stats.expeditionsWon ?? 0) + 1;
    state.stats.score += 300 + x.stageCount * 75;
  } else if (x.outcome === 'lost') {
    summary = 'The crew is carried back to the train, beaten.';
    state.train.morale = Math.max(0, state.train.morale - 10);
  } else {
    summary = `The crew withdrew after stage ${x.stage}.`;
  }
  x.log.push(summary);
  log(state, `Expedition: ${summary}`, x.outcome === 'won' ? 'good' : 'warn');
  ctx.bus.defer('expedition:end', { outcome: x.outcome!, summary, rounds: x.rounds });
}

/** UI dismisses the result screen; the run resumes (and a relic offer follows a win). */
export function endExpedition(ctx: SimContext): boolean {
  const { state } = ctx;
  const x = state.expedition;
  if (!x || state.phase !== 'expedition' || !x.outcome) return false;
  const relic = x.rewardRelic;
  state.expedition = null;
  state.phase = 'running';
  ctx.bus.defer('phase:change', { phase: 'running' });
  if (relic) offerRelics(ctx, 'expedition');
  return true;
}
