export interface FrameSample {
  averageMs: number;
  maxMs: number;
  p95Ms: number;
  samples: number;
  longFrames: number;
}

export class FrameMonitor {
  private readonly intervals: number[] = [];
  private previousTime: number | null = null;

  constructor(private readonly sampleLimit = 300) {}

  observe(currentTime: number): void {
    if (this.previousTime !== null) {
      this.intervals.push(currentTime - this.previousTime);
      if (this.intervals.length > this.sampleLimit) this.intervals.shift();
    }
    this.previousTime = currentTime;
  }

  reset(): void {
    this.intervals.length = 0;
    this.previousTime = null;
  }

  sample(): FrameSample {
    if (this.intervals.length === 0) {
      return {
        averageMs: 0,
        maxMs: 0,
        p95Ms: 0,
        samples: 0,
        longFrames: 0,
      };
    }

    const sorted = [...this.intervals].sort((left, right) => left - right);
    const p95Index = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * 0.95),
    );
    return {
      averageMs:
        this.intervals.reduce((total, interval) => total + interval, 0) /
        this.intervals.length,
      maxMs: sorted[sorted.length - 1],
      p95Ms: sorted[p95Index],
      samples: this.intervals.length,
      longFrames: this.intervals.filter((interval) => interval >= 50).length,
    };
  }
}
