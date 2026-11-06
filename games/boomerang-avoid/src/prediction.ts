import { NEUTRAL, TICK_RATE, step, type Input, type MatchState } from '@avoid/boomerangavoid-sim';
import type { InputCommand, Snapshot } from '@avoid/boomerangavoid-protocol';

export const MAX_PREDICTION_TICKS = 6;
export const MAX_PENDING_BATCHES = 30;

/** Packet frequency is not simulation frequency: a 30 Hz sample covers two 60 Hz ticks. */
export function elapsedTicks(receivedAt: number, now: number): number {
  if (!Number.isFinite(receivedAt) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.min(MAX_PREDICTION_TICKS, Math.floor((now - receivedAt) * TICK_RATE / 1000 + 1e-7)));
}

export function unacknowledged(
  batches: readonly (readonly InputCommand[])[], ack: Readonly<Record<string, number>>,
  round: number, ownedIds: readonly string[],
): InputCommand[][] {
  const owned = new Set(ownedIds);
  return batches.slice(-MAX_PENDING_BATCHES)
    .map(batch => batch.filter(c => owned.has(c.seatId) && c.round === round &&
      c.sequence > (Object.hasOwn(ack, c.seatId) ? ack[c.seatId]! : -1)))
    .filter(batch => batch.length > 0);
}

/** Clone and replay the same tick-based sample/hold contract as server InputBuffer.
 * Only locomotion is copied back. Combat, objectives, weapons and results remain authoritative. */
export function predictMovement(
  authority: MatchState, batches: readonly (readonly InputCommand[])[], ownedIds: readonly string[], ticks: number,
): MatchState {
  const view = structuredClone(authority);
  const count = Math.max(0, Math.min(MAX_PREDICTION_TICKS, Math.floor(ticks)));
  if (!count || authority.phase !== 'playing') return view;
  const predicted = structuredClone(authority);
  const owned = new Set(ownedIds);
  const queues = new Map<string, InputCommand[]>();
  const held = new Map<string, Input>();
  for (const id of owned) {
    const commands = batches.flat().filter(c => c.seatId === id && c.round === authority.round)
      .sort((a, b) => a.sequence - b.sequence);
    // The server consumes at most one queued command per seat per tick, then holds it.
    queues.set(id, commands.filter((c, i) => !i || c.sequence !== commands[i - 1]!.sequence));
    held.set(id, { ...(authority.internal?.controls[id]?.previous ?? NEUTRAL) });
  }
  for (let n = 0; n < count; n++) {
    const entries: [string, Input][] = [];
    for (const id of owned) {
      const queue = queues.get(id)!;
      const next = queue[0];
      if (next && next.tick <= predicted.tick) {
        queue.shift();
        held.set(id, { mx: next.mx, my: next.my, ax: next.ax, ay: next.ay,
          dash: next.dash, slash: next.slash, throw: next.throw });
      }
      // Weapon/action state comes only from snapshots; dash is the sole predicted action.
      entries.push([id, { ...held.get(id)!, slash: false, throw: false }]);
    }
    step(predicted, Object.fromEntries(entries));
    if (predicted.round !== authority.round || predicted.phase !== 'playing') break;
  }
  for (const player of view.players) {
    if (!owned.has(player.id) || !player.alive) continue;
    const source = predicted.players.find(p => p.id === player.id);
    if (!source) continue;
    for (const key of ['x', 'y', 'vx', 'vy', 'fx', 'fy'] as const) player[key] = source[key];
    // The presentation still uses the authoritative tick for combat/HUD timers.
    player.dashUntil = view.tick + Math.max(0, source.dashUntil - predicted.tick);
  }
  return view;
}

export function snapshotIsOrdered(previous: Snapshot | null, incoming: Snapshot): boolean {
  if (!previous) return true;
  if (incoming.serverTime < previous.serverTime) return false;
  return !previous.state || !incoming.state || incoming.state.round !== previous.state.round ||
    incoming.state.tick >= previous.state.tick;
}

/** Delayed remote presentation only interpolates consecutive, live authority in the same round. */
export function interpolateRemote(
  current: MatchState, previous: MatchState | null, ownedIds: readonly string[],
  previousAt: number, receivedAt: number, now: number,
): MatchState {
  const view = structuredClone(current);
  const interval = receivedAt - previousAt;
  if (!previous || previous.round !== current.round || previous.phase !== current.phase ||
    previous.tick >= current.tick || interval <= 0 || interval > 250 || now < receivedAt || now - receivedAt > 250)
    return view;
  const alpha = Math.max(0, Math.min(1, (now - receivedAt) / interval));
  const owned = new Set(ownedIds);
  for (const p of view.players) {
    if (owned.has(p.id)) continue;
    const old = previous.players.find(q => q.id === p.id);
    if (!old || !p.alive || !old.alive || Math.hypot(p.x - old.x, p.y - old.y) > 3) continue;
    p.x = old.x + (p.x - old.x) * alpha;
    p.y = old.y + (p.y - old.y) * alpha;
  }
  return view;
}
