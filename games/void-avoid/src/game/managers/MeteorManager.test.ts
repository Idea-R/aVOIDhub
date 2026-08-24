import { describe, expect, it } from 'vitest';
import { RunRandomStreams } from '../run/seededRandom';
import { createMeteorSpawnSpec } from './MeteorManager';

function createSequence(seed: number) {
  const random = new RunRandomStreams(seed).getStream('world');
  return Array.from({ length: 8 }, (_, index) => createMeteorSpawnSpec(
    1280,
    720,
    { x: 640 + index * 3, y: 360 - index * 2 },
    index * 15,
    random.next,
  ));
}

describe('meteor world generation', () => {
  it('replays identical spawn order and physics from the same seed', () => {
    expect(createSequence(0xcafef00d)).toEqual(createSequence(0xcafef00d));
  });

  it('changes the generated field when the seed changes', () => {
    expect(createSequence(1)).not.toEqual(createSequence(2));
  });

  it('keeps all generated values finite and starts on a field edge', () => {
    for (const meteor of createSequence(99)) {
      expect(Object.values(meteor).every((value) => typeof value === 'boolean' || Number.isFinite(value))).toBe(true);
      expect(meteor.x === -20 || meteor.x === 1300 || meteor.y === -20 || meteor.y === 740).toBe(true);
      expect(meteor.radius).toBeGreaterThan(0);
    }
  });
});
