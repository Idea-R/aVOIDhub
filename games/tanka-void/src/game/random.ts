const FALLBACK_SEED = 0x6d2b79f5;

export function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? FALLBACK_SEED : normalized;
}

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = normalizeSeed(seed);
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  range(minimum: number, maximum: number): number {
    return minimum + (maximum - minimum) * this.next();
  }
}

export function createRunSeed(): number {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    return normalizeSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
  }
  return normalizeSeed(Date.now() ^ Math.floor(performance.now() * 1000));
}
