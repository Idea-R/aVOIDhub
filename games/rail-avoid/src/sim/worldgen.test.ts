import { describe, it, expect } from 'vitest';
import { generateWorld } from './worldgen';
import { MAP_W, MAP_H, TEST_SEED } from '../core/config';
import { neighbors, edgeKey } from '../core/hex';

describe('worldgen', () => {
  it('is deterministic for a seed', () => {
    const a = generateWorld(TEST_SEED);
    const b = generateWorld(TEST_SEED);
    expect(a.settlements.map(s => s.name + s.col + s.row)).toEqual(b.settlements.map(s => s.name + s.col + s.row));
    expect(a.railLinks).toEqual(b.railLinks);
    expect(a.spine).toEqual(b.spine);
  });
  it('has a connected rail spine from start to terminus and enough settlements', () => {
    const w = generateWorld(TEST_SEED);
    expect(w.tiles.length).toBe(MAP_W * MAP_H);
    expect(w.spine[0]).toEqual(w.start);
    expect(w.spine[w.spine.length - 1]).toEqual(w.terminus);
    const links = new Set(w.railLinks);
    for (let i = 0; i + 1 < w.spine.length; i++) {
      const [a, b] = [w.spine[i], w.spine[i + 1]];
      expect(links.has(edgeKey(a[0], a[1], b[0], b[1]))).toBe(true);
      expect(neighbors(a[0], a[1]).some(n => n[0] === b[0] && n[1] === b[1])).toBe(true);
    }
    const types = w.settlements.map(s => s.type);
    expect(types.filter(t => t === 'yard').length).toBeGreaterThanOrEqual(4);
    expect(types.filter(t => t === 'village').length).toBeGreaterThanOrEqual(4);
    expect(w.settlements.length).toBeGreaterThanOrEqual(30);
    expect(w.loopTiles.length).toBe(6);
    for (const s of w.settlements) {
      const t = w.tiles[s.row * MAP_W + s.col];
      expect(t.settlementId).toBe(s.id);
      expect(t.terrain).not.toBe('mountain');
    }
  });
  it('varies across seeds', () => {
    const a = generateWorld(1), b = generateWorld(2);
    expect(a.spine).not.toEqual(b.spine);
  });
});
