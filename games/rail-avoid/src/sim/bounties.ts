/** Bounties posted by settlements: kill / deliver / reach. Max two active. */
import type { SimState, Settlement, Bounty, EnemyType } from '../core/types';
import type { SimContext } from './api';
import { BOUNTY } from '../core/config';
import { REGION_WEIGHTS, ENEMY_DEFS } from '../core/enemies';
import { addResource, nextId, log } from './helpers';
import { addMarks, hasRelic } from './loot';

const KILL_TYPES: EnemyType[] = ['raider', 'hound', 'crawler', 'harpy', 'sapper', 'wisp'];

export function activeBounties(state: SimState): Bounty[] {
  return (state.bounties ?? []).filter(b => b.status === 'active');
}

/** Called on settlement arrival; may post a new bounty. */
export function maybePostBounty(ctx: SimContext, s: Settlement): void {
  const { state } = ctx;
  if (!state.bounties) state.bounties = [];
  if (s.type === 'start' || s.type === 'terminus') return;
  if (activeBounties(state).length >= BOUNTY.maxActive) return;
  const rng = ctx.rng.events;
  if (!rng.chance(BOUNTY.postChance)) return;
  const region = s.region;
  const kinds: Bounty['kind'][] = ['kill', 'reach'];
  if (state.train.passengerCap > 0) kinds.push('deliver');
  const kind = rng.pick(kinds);
  const mult = hasRelic(state, 'bounty_board') ? 1.5 : 1;
  let b: Bounty | null = null;
  if (kind === 'kill') {
    const pool = KILL_TYPES.filter(t => REGION_WEIGHTS[t][region] > 0);
    const type = rng.pick(pool);
    const count = rng.int(BOUNTY.killCount[0], BOUNTY.killCount[1]);
    b = {
      id: nextId(state, 'b'), kind, fromId: s.id, fromName: s.name, status: 'active',
      target: type, targetName: ENEMY_DEFS[type].name, count, progress: 0,
      expiresAt: state.time + BOUNTY.killSeconds,
      reward: { marks: Math.round(rng.int(3, 5) * mult), rails: Math.round(rng.int(4, 8) * mult), scrap: 0 },
      title: `Cull ${count} ${ENEMY_DEFS[type].name}s`,
      desc: `${s.name} will pay for ${count} ${ENEMY_DEFS[type].name.toLowerCase()} kills within ${Math.round(BOUNTY.killSeconds / 60)} minutes.`,
    };
  } else if (kind === 'reach') {
    const cands = state.settlements.filter(x => !x.visited && !x.consumed && x.col > s.col && x.col <= s.col + 14 && x.type !== 'terminus');
    if (!cands.length) return;
    const target = rng.pick(cands);
    b = {
      id: nextId(state, 'b'), kind, fromId: s.id, fromName: s.name, status: 'active',
      target: target.id, targetName: target.name, count: 1, progress: 0,
      expiresAt: Math.min(target.deadline, state.time + BOUNTY.reachSeconds),
      reward: { marks: Math.round(rng.int(2, 4) * mult), rails: 0, scrap: Math.round(rng.int(10, 18) * mult) },
      title: `Reach ${target.name}`,
      desc: `A courier needs the line to ${target.name} before the void takes it.`,
    };
  } else {
    const count = rng.int(BOUNTY.deliverCount[0], BOUNTY.deliverCount[1]);
    b = {
      id: nextId(state, 'b'), kind, fromId: s.id, fromName: s.name, status: 'active',
      target: 'yard', targetName: 'the next repair yard', count, progress: 0,
      expiresAt: state.time + BOUNTY.deliverSeconds,
      reward: { marks: Math.round(rng.int(3, 6) * mult), rails: Math.round(rng.int(6, 10) * mult), scrap: 0 },
      title: `Deliver ${count} passengers`,
      desc: `Bring at least ${count} passengers safely to the next repair yard.`,
    };
  }
  state.bounties.push(b);
  log(state, `Bounty from ${s.name}: ${b.title}`, 'info');
  ctx.bus.defer('bounty:new', { id: b.id, title: b.title });
}

function complete(ctx: SimContext, b: Bounty): void {
  const { state } = ctx;
  b.status = 'done';
  if (b.reward.marks) addMarks(ctx, b.reward.marks, 'bounty');
  if (b.reward.rails) addResource(ctx, 'rails', b.reward.rails);
  if (b.reward.scrap) addResource(ctx, 'scrap', b.reward.scrap);
  state.stats.bountiesDone = (state.stats.bountiesDone ?? 0) + 1;
  state.stats.score += 150;
  log(state, `Bounty complete: ${b.title}`, 'good');
  ctx.bus.defer('bounty:done', { id: b.id, title: b.title, reward: b.reward });
}

export function onEnemyKilledForBounty(ctx: SimContext, type: EnemyType): void {
  for (const b of activeBounties(ctx.state)) {
    if (b.kind !== 'kill' || b.target !== type) continue;
    b.progress++;
    ctx.bus.defer('bounty:progress', { id: b.id, progress: b.progress, count: b.count });
    if (b.progress >= b.count) complete(ctx, b);
  }
}

export function onSettlementForBounty(ctx: SimContext, s: Settlement, deliveredPassengers: number): void {
  for (const b of activeBounties(ctx.state)) {
    if (b.kind === 'reach' && b.target === s.id) { b.progress = 1; complete(ctx, b); }
    if (b.kind === 'deliver' && s.type === 'yard') {
      b.progress = deliveredPassengers;
      if (deliveredPassengers >= b.count) complete(ctx, b);
      else { b.status = 'failed'; ctx.bus.defer('bounty:failed', { id: b.id, title: b.title }); }
    }
  }
}

export function updateBounties(ctx: SimContext): void {
  const { state } = ctx;
  if (!state.bounties) return;
  for (const b of state.bounties) {
    if (b.status !== 'active') continue;
    if (state.time >= b.expiresAt) { b.status = 'failed'; log(state, `Bounty failed: ${b.title}`, 'warn'); ctx.bus.defer('bounty:failed', { id: b.id, title: b.title }); }
    if (b.kind === 'reach') {
      const t = state.settlements.find(x => x.id === b.target);
      if (t && t.consumed) { b.status = 'failed'; ctx.bus.defer('bounty:failed', { id: b.id, title: b.title }); }
    }
  }
  if (state.bounties.length > 12) state.bounties = state.bounties.filter(b => b.status === 'active').concat(state.bounties.filter(b => b.status !== 'active').slice(-6));
}
