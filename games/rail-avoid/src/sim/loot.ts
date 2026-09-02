/** Salvage drops, elites, relic choices and Void Marks. */
import type { SimState, Enemy, LootDrop } from '../core/types';
import type { SimContext } from './api';
import { RELICS } from '../core/relics';
import { LOOT } from '../core/config';
import { addResource, carPos, nextId, log } from './helpers';

export function hasRelic(state: SimState, id: string): boolean {
  return state.train.relics?.includes(id) ?? false;
}

export function addMarks(ctx: SimContext, n: number, why: string): void {
  const t = ctx.state.train;
  t.marks = Math.max(0, (t.marks ?? 0) + n);
  ctx.bus.defer('marks:change', { delta: n, total: t.marks, why });
}

/** Offer a 1-of-3 relic choice (pauses the run in phase 'relic'). */
export function offerRelics(ctx: SimContext, source: string): boolean {
  const { state } = ctx;
  const owned = new Set(state.train.relics ?? []);
  const pool = RELICS.filter(r => !owned.has(r.id));
  if (pool.length === 0) { addMarks(ctx, 4, 'no relics left'); return false; }
  const weights = pool.map(r => (r.rarity === 'common' ? 5 : r.rarity === 'rare' ? 2.5 : 1));
  const picks: string[] = [];
  const cand = pool.slice(); const w = weights.slice();
  while (picks.length < 3 && cand.length) {
    const p = ctx.rng.events.weighted(cand, w);
    const i = cand.indexOf(p);
    cand.splice(i, 1); w.splice(i, 1);
    picks.push(p.id);
  }
  state.pendingRelicChoice = { options: picks, source };
  state.phaseBeforeRelic = state.phase === 'relic' ? 'running' : state.phase;
  state.phase = 'relic';
  ctx.bus.defer('phase:change', { phase: 'relic' });
  ctx.bus.defer('relic:offer', { options: picks, source });
  return true;
}

export function chooseRelic(ctx: SimContext, index: number): boolean {
  const { state } = ctx;
  const pc = state.pendingRelicChoice;
  if (state.phase !== 'relic' || !pc) return false;
  const id = pc.options[index];
  if (!id) return false;
  if (!state.train.relics) state.train.relics = [];
  state.train.relics.push(id);
  state.stats.relicsTaken = (state.stats.relicsTaken ?? 0) + 1;
  state.pendingRelicChoice = null;
  state.phase = state.phaseBeforeRelic && state.phaseBeforeRelic !== 'relic' ? state.phaseBeforeRelic : 'running';
  state.phaseBeforeRelic = null;
  const def = RELICS.find(r => r.id === id);
  log(state, `Relic: ${def?.name ?? id}`, 'good');
  ctx.bus.defer('relic:taken', { id });
  ctx.bus.defer('phase:change', { phase: state.phase });
  return true;
}

/** Roll a salvage drop for a dead regular enemy; elites always drop a relic offer + marks. */
export function dropLoot(ctx: SimContext, e: Enemy): void {
  const { state } = ctx;
  const rng = ctx.rng.combat;
  const elite = (e.extra?.elite ?? 0) > 0;
  if (elite) {
    addMarks(ctx, rng.int(LOOT.eliteMarks[0], LOOT.eliteMarks[1]), 'elite');
    pushDrop(ctx, e.x, e.y, 'scrap', rng.int(6, 10));
    state.pendingEliteRelic = (state.pendingEliteRelic ?? 0) + 1;
    return;
  }
  let chance = LOOT.dropChance;
  if (hasRelic(state, 'salvage_hooks')) chance *= 2;
  if (!rng.chance(chance)) return;
  const roll = rng.next();
  if (roll < 0.55) pushDrop(ctx, e.x, e.y, 'scrap', rng.int(2, 5));
  else if (roll < 0.9) pushDrop(ctx, e.x, e.y, 'ammo', rng.int(5, 9));
  else pushDrop(ctx, e.x, e.y, 'rails', rng.int(1, 2));
}

function pushDrop(ctx: SimContext, x: number, y: number, kind: LootDrop['kind'], amount: number): void {
  const { state } = ctx;
  if (!state.loot) state.loot = [];
  if (state.loot.length >= LOOT.maxDrops) state.loot.shift();
  const d: LootDrop = { id: nextId(state, 'loot'), x, y, kind, amount, ttl: LOOT.ttl };
  state.loot.push(d);
  ctx.bus.defer('loot:drop', { id: d.id, kind, amount, x, y });
}

/** Age drops, collect those near any car, and hand out pending elite relic offers when safe. */
export function updateLoot(ctx: SimContext): void {
  const { state, dt } = ctx;
  if (!state.loot) state.loot = [];
  const radius = LOOT.pickupRadius * (hasRelic(state, 'cargo_nets') ? 2 : 1);
  const cars = state.train.cars.length;
  for (let i = state.loot.length - 1; i >= 0; i--) {
    const d = state.loot[i];
    d.ttl -= dt;
    if (d.ttl <= 0) { state.loot.splice(i, 1); ctx.bus.defer('loot:expire', { id: d.id }); continue; }
    let picked = false;
    for (let c = 0; c < cars; c++) {
      const p = carPos(state, c);
      if (Math.hypot(p.x - d.x, p.y - d.y) <= radius) { picked = true; break; }
    }
    if (!picked) continue;
    if (d.kind === 'marks') addMarks(ctx, d.amount, 'salvage');
    else addResource(ctx, d.kind, d.amount, d.x, d.y);
    state.stats.lootCollected = (state.stats.lootCollected ?? 0) + 1;
    state.loot.splice(i, 1);
    ctx.bus.defer('loot:pickup', { id: d.id, kind: d.kind, amount: d.amount, x: d.x, y: d.y });
  }
  // elite relic offers are queued so they never interrupt mid-tick; hand one out now
  if ((state.pendingEliteRelic ?? 0) > 0 && state.phase === 'running') {
    state.pendingEliteRelic!--;
    offerRelics(ctx, 'elite');
  }
}
