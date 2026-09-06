/** Opt-in encounter lifecycle; no world-generation frequency is enabled here. */
import type { SimContext } from './api';
import type { TrackEncounter, ExpeditionState } from '../core/types';
import { edgeKey, hexDistance } from '../core/hex';
import { nearbyTrackEncounter, TRACK_AMBUSH_EVENT } from '../core/trackEncounters';
import { nextId, tileAt } from './helpers';

export function placeTrackAmbush(ctx: SimContext, from: [number, number], to: [number, number]): TrackEncounter | null {
  const s = ctx.state;
  if (s.phase !== 'running' || s.train.reversing || hexDistance(...from, ...to) !== 1) return null;
  if ([...from, ...to].some(n => !Number.isInteger(n))) return null;
  if ([from, to].some(p => { const t = tileAt(s, ...p); return !t || t.void || t.terrain === 'mountain'; })) return null;
  const edge = edgeKey(...from, ...to);
  if (!s.route.railLinks.includes(edge) && !s.route.builtLinks.includes(edge)) return null;
  if (s.route.encounters?.some(e => e.edge === edge)) return null;
  // Never materialize a blockage behind or underneath any part of the consist.
  const lastOccupied = s.train.routeIndex + (s.train.progress > 0 ? 1 : 0);
  for (let i = 1; i <= lastOccupied; i++) {
    if (edgeKey(...s.route.path[i - 1], ...s.route.path[i]) === edge) return null;
  }
  const e: TrackEncounter = { id: nextId(s, 'barricade'), edge, from: [...from], to: [...to], status: 'blocked', attempts: 0, settledAttempt: 0 };
  (s.route.encounters ??= []).push(e);
  return e;
}

export function inspectTrackEncounter(ctx: SimContext): boolean {
  const s = ctx.state;
  if (s.phase !== 'running' && s.phase !== 'paused') return false;
  const encounter = nearbyTrackEncounter(s);
  if (!encounter || encounter.attempts !== encounter.settledAttempt) return false;
  s.train.stopped = true; s.train.stopReason = 'no_route'; s.train.speed = 0;
  s.activeEvent = { defId: TRACK_AMBUSH_EVENT, startedAt: s.time, trackEncounterId: encounter.id };
  s.phase = 'event';
  ctx.bus.defer('phase:change', { phase: 'event' });
  ctx.bus.defer('event:show', { defId: TRACK_AMBUSH_EVENT });
  return true;
}

export function beginTrackAttempt(ctx: SimContext): ExpeditionState['trackAttempt'] | null {
  const s = ctx.state;
  const e = nearbyTrackEncounter(s);
  if (!e || s.activeEvent?.trackEncounterId !== e.id || !s.activeEvent.preparingExpedition || e.attempts !== e.settledAttempt) return null;
  e.attempts++;
  return { encounterId: e.id, attempt: e.attempts };
}

/** Commit once before rewards/wounds/Void. Reloading a settled result cannot pay twice. */
export function settleTrackAttempt(ctx: SimContext, x: ExpeditionState): boolean {
  const ticket = x.trackAttempt;
  if (ctx.state.phase !== 'expedition' || ctx.state.expedition !== x || !ticket || !x.outcome) return false;
  if (x.outcome === 'won' && (x.stage !== x.stageCount || x.foes.some(f => f.hp > 0))) return false;
  const e = ctx.state.route.encounters?.find(e => e.id === ticket.encounterId);
  if (!e || e.status !== 'blocked' || e.attempts !== ticket.attempt || e.settledAttempt >= ticket.attempt) return false;
  e.settledAttempt = ticket.attempt;
  e.lastOutcome = x.outcome;
  if (x.outcome === 'won') e.status = 'cleared';
  return true;
}
