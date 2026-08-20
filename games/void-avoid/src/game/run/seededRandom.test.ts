import { describe, expect, it } from 'vitest';
import {
  deriveStreamSeed,
  formatRunSeed,
  normalizeRunSeed,
  RunRandomStreams,
  SeededRandom,
} from './seededRandom';

describe('SeededRandom', () => {
  it('replays the same sequence after reset', () => {
    const random = new SeededRandom(0x12345678);
    const first = Array.from({ length: 6 }, () => random.next());
    expect(first).toEqual([
      0.10615200875326991,
      0.941276284167543,
      0.9398706152569503,
      0.2338848018553108,
      0.9045877147000283,
      0.778330324916169,
    ]);

    random.reset(0x12345678);

    expect(Array.from({ length: 6 }, () => random.next())).toEqual(first);
    expect(random.getDrawCount()).toBe(6);
  });

  it('keeps named streams independent', () => {
    const firstRun = new RunRandomStreams(42);
    const secondRun = new RunRandomStreams(42);

    firstRun.getStream('world').next();
    firstRun.getStream('world').next();

    expect(firstRun.getStream('score').next()).toBe(secondRun.getStream('score').next());
    expect(firstRun.getDrawCounts()).toMatchObject({ world: 2, score: 1 });
  });

  it('normalizes shareable seeds without ambiguity', () => {
    expect(normalizeRunSeed('00ABCDEF')).toBe(0x00abcdef);
    expect(normalizeRunSeed('0xABCDEF')).toBe(0x00abcdef);
    expect(formatRunSeed(0x00abcdef)).toBe('00ABCDEF');
    expect(normalizeRunSeed('meteor-night')).toBe(normalizeRunSeed('meteor-night'));
    expect(deriveStreamSeed(7, 'world')).not.toBe(deriveStreamSeed(7, 'score'));
  });
});
