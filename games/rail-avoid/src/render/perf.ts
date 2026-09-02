/** Frame-time statistics for ViewApi.perf() and the auto quality stepper. */
export class PerfMonitor {
  public frameMs = 16.7;
  public worstFrameMs = 16.7;
  private samples: Array<{ t: number; ms: number }> = [];
  private lowSince = -1;
  private highSince = -1;

  update(deltaMs: number, nowMs: number): void {
    const d = Math.max(0, Math.min(250, deltaMs));
    this.frameMs += (d - this.frameMs) * 0.08;
    this.samples.push({ t: nowMs, ms: d });
    while (this.samples.length && nowMs - this.samples[0].t > 2000) this.samples.shift();
    let worst = 0;
    for (const s of this.samples) if (s.ms > worst) worst = s.ms;
    this.worstFrameMs = worst;
  }

  /**
   * Auto-quality decision: returns -1 to step down (fps < 45 for 3 s), +1 to step up (fps > 58 for 10 s), 0 otherwise.
   */
  autoStep(fps: number, nowMs: number): -1 | 0 | 1 {
    if (fps < 45) {
      if (this.lowSince < 0) this.lowSince = nowMs;
      this.highSince = -1;
      if (nowMs - this.lowSince > 3000) { this.lowSince = -1; return -1; }
    } else if (fps > 58) {
      if (this.highSince < 0) this.highSince = nowMs;
      this.lowSince = -1;
      if (nowMs - this.highSince > 10000) { this.highSince = -1; return 1; }
    } else {
      this.lowSince = -1; this.highSince = -1;
    }
    return 0;
  }

  reset(): void { this.lowSince = -1; this.highSince = -1; }
}
