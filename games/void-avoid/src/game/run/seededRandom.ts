export const RUN_RANDOM_ALGORITHM = 'mulberry32-v1' as const;

export type RunRandomStreamName = 'world' | 'power-up' | 'chain' | 'score' | 'defense';

const STREAM_NAMES: RunRandomStreamName[] = ['world', 'power-up', 'chain', 'score', 'defense'];

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function normalizeRunSeed(value: number | string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Run seed must be a finite number.');
    return Math.trunc(value) >>> 0;
  }

  const trimmed = value.trim();
  if (!trimmed) throw new Error('Run seed cannot be empty.');
  if (/^(?:0x)?[0-9a-f]{1,8}$/i.test(trimmed)) {
    return Number.parseInt(trimmed.replace(/^0x/i, ''), 16) >>> 0;
  }
  return fnv1a32(trimmed);
}

export function deriveStreamSeed(runSeed: number, stream: RunRandomStreamName): number {
  return fnv1a32(`${runSeed >>> 0}:${stream}`);
}

export function formatRunSeed(runSeed: number): string {
  return (runSeed >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export function createRunSeed(): number {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    return cryptoObject.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }

  // The seed itself does not prove trust; it only makes a local run reproducible.
  return (Date.now() ^ Math.trunc(globalThis.performance?.now?.() ?? 0)) >>> 0;
}

export class SeededRandom {
  private state = 0;
  private draws = 0;

  constructor(seed: number) {
    this.reset(seed);
  }

  reset(seed: number): void {
    this.state = seed >>> 0;
    this.draws = 0;
  }

  next = (): number => {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    this.draws += 1;
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };

  getDrawCount(): number {
    return this.draws;
  }
}

export class RunRandomStreams {
  private runSeed = 0;
  private readonly streams = new Map<RunRandomStreamName, SeededRandom>();

  constructor(seed = 0) {
    for (const name of STREAM_NAMES) {
      this.streams.set(name, new SeededRandom(deriveStreamSeed(seed, name)));
    }
    this.runSeed = seed >>> 0;
  }

  reset(seed: number): void {
    this.runSeed = seed >>> 0;
    for (const name of STREAM_NAMES) {
      this.getStream(name).reset(deriveStreamSeed(this.runSeed, name));
    }
  }

  getSeed(): number {
    return this.runSeed;
  }

  getStream(name: RunRandomStreamName): SeededRandom {
    const stream = this.streams.get(name);
    if (!stream) throw new Error(`Unknown run random stream: ${name}`);
    return stream;
  }

  getDrawCounts(): Record<RunRandomStreamName, number> {
    return Object.fromEntries(
      STREAM_NAMES.map((name) => [name, this.getStream(name).getDrawCount()]),
    ) as Record<RunRandomStreamName, number>;
  }
}
