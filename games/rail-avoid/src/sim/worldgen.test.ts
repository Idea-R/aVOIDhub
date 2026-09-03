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
    expect(a.leadIn).toEqual(b.leadIn);
  });
  it('has a connected rail spine from start to terminus and enough settlements', () => {
    const w = generateWorld(TEST_SEED);
    expect(w.tiles.length).toBe(MAP_W * MAP_H);
    expect(w.spine[0]).toEqual(w.start);
    expect(w.spine[w.spine.length - 1]).toEqual(w.terminus);
    const links = new Set(w.railLinks);
    expect(w.leadIn.at(-1)).toEqual(w.start);
    for (let i = 0; i + 1 < w.leadIn.length; i++) {
      const [a, b] = [w.leadIn[i], w.leadIn[i + 1]];
      expect(links.has(edgeKey(a[0], a[1], b[0], b[1]))).toBe(true);
      expect(neighbors(a[0], a[1]).some(n => n[0] === b[0] && n[1] === b[1])).toBe(true);
    }
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
  it('generates three connected main lines with crossovers per region', () => {
    const w = generateWorld(TEST_SEED);
    expect(w.lines.length).toBe(3);
    const links = new Set(w.railLinks);
    for (const line of w.lines) {
      expect(line.length).toBeGreaterThan(100);
      for (let i = 0; i + 1 < line.length; i++) expect(links.has(edgeKey(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]))).toBe(true);
    }
    // outer lines fork from the central line and rejoin at the terminus ring
    const centralSet = new Set(w.lines[0].map(p => p[0] + ',' + p[1]));
    expect(centralSet.has(w.lines[1][0][0] + ',' + w.lines[1][0][1])).toBe(true);
    expect(centralSet.has(w.lines[2][0][0] + ',' + w.lines[2][0][1])).toBe(true);
    const ring = new Set(w.loopTiles.map(p => p[0] + ',' + p[1]));
    expect(ring.has(w.lines[1][w.lines[1].length - 1].join(','))).toBe(true);
    expect(ring.has(w.lines[2][w.lines[2].length - 1].join(','))).toBe(true);
    // rows: northern above central above southern on average
    const avgRow = (l: Array<[number, number]>) => l.reduce((a, p) => a + p[1], 0) / l.length;
    expect(avgRow(w.lines[1])).toBeLessThan(avgRow(w.lines[0]));
    expect(avgRow(w.lines[2])).toBeGreaterThan(avgRow(w.lines[0]));
    // no casual crossovers: the lines only meet at the three crossroads hubs (one per region boundary)
    expect(Object.values(w.railLines).filter(v => v === 3).length).toBe(0);
    const hubs = w.settlements.filter(s => s.type === 'crossroads');
    expect(hubs.length).toBe(3);
    for (const h of hubs) for (const line of w.lines) expect(line.some(p => p[0] === h.col && p[1] === h.row)).toBe(true);
    // line flavour: every region has a mine on the north and a village on the south
    for (let r = 0; r < 4; r++) {
      expect(w.settlements.some(s => s.region === r && s.type === 'mine')).toBe(true);
      expect(w.settlements.some(s => s.region === r && s.type === 'village')).toBe(true);
      expect(w.settlements.some(s => s.region === r && s.type === 'yard')).toBe(true);
    }
  });
  it('varies across seeds', () => {
    const a = generateWorld(1), b = generateWorld(2);
    expect(a.spine).not.toEqual(b.spine);
  });
});
