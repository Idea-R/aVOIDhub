/** Calibrates server epoch time against the fastest monotonic arrival in this room.
 * A stream of delayed callbacks must not make old authority look current. */
export class SnapshotClock {
  private fastestOffset = Infinity;
  arrivalLagMs = 0;
  private lastFreshAt: number;
  constructor(now: number, readonly staleAfterMs = 1500) { this.lastFreshAt = now; }
  accept(serverTime: number, now: number): boolean {
    if (!Number.isFinite(serverTime) || !Number.isFinite(now)) return false;
    const offset = now - serverTime;
    this.fastestOffset = Math.min(this.fastestOffset, offset);
    this.arrivalLagMs = Math.max(0, offset - this.fastestOffset);
    if (this.arrivalLagMs > this.staleAfterMs) return false;
    this.lastFreshAt = now;
    return true;
  }
  age(now: number): number { return Math.max(0, now - this.lastFreshAt); }
  stale(now: number): boolean { return this.age(now) > this.staleAfterMs; }
}
