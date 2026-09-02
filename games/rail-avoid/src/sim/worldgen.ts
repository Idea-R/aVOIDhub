/** Deterministic continent generation: terrain, regions, pre-laid rail network, settlements, void front. */
import type { Tile, Terrain, Settlement, SettlementType, CrewSpecialty, SimState, ResourceBundle } from '../core/types';
import { MAP_W, MAP_H, REGION_W, REGIONS, HEX_R, TRACK_COST, VOID, LINE_THREAT } from '../core/config';
import { fbm, hash2, hexToWorld, neighbors, inBounds, edgeKey, hexDistance, tileKey } from '../core/hex';
import { Rng } from '../core/rng';

export interface WorldGen {
  tiles: Tile[];
  settlements: Settlement[];
  railLinks: string[];
  railLines: Record<string, number>;
  spine: Array<[number, number]>;
  lines: Array<Array<[number, number]>>;
  start: [number, number];
  terminus: [number, number];
  loopTiles: Array<[number, number]>;
  voidFront: number[];
}

const SYL_A = ['Ash', 'Bran', 'Cal', 'Dun', 'Eld', 'Fen', 'Gal', 'Hol', 'Kel', 'Lorn', 'Mar', 'Nor', 'Ost', 'Pell', 'Quar', 'Rud', 'Sal', 'Tor', 'Ul', 'Vale', 'Wren', 'Yar', 'Zel'];
const SYL_B = ['bridge', 'ford', 'haven', 'moor', 'stead', 'wick', 'field', 'gate', 'hollow', 'mere', 'rock', 'spur', 'yard', 'cross', 'reach', 'fall', 'dale', 'point', 'halt', 'well'];
const NAMES_A = SYL_A.filter(s => /^[A-Za-z]+$/.test(s));

function regionOf(col: number): number { return Math.min(REGIONS - 1, Math.floor(col / REGION_W)); }

function genTerrain(seed: number): Tile[] {
  const tiles: Tile[] = [];
  for (let row = 0; row < MAP_H; row++) {
    for (let col = 0; col < MAP_W; col++) {
      const e = fbm(col * 0.16, row * 0.19, seed + 11, 4);
      const m = fbm(col * 0.11 + 100, row * 0.14 + 50, seed + 29, 3);
      const h = hash2(col, row, seed + 7);
      const region = regionOf(col);
      // blend region palettes across the boundary: within 6 columns of a border, tiles increasingly
      // take the neighbouring region's terrain rules (dithered by a per-tile hash)
      let ruleRegion = region;
      const inRegion = col - region * REGION_W;            // 0..REGION_W-1
      const toNext = REGION_W - 1 - inRegion;              // columns until the next region
      const bh = hash2(col * 7 + 3, row * 5 + 1, seed + 91);
      if (region < REGIONS - 1 && toNext < 6 && bh < (6 - toNext) / 12) ruleRegion = region + 1;
      else if (region > 0 && inRegion < 6 && bh < (6 - inRegion) / 12) ruleRegion = region - 1;
      let terrain: Terrain = 'plains';
      const edge = row === 0 || row === MAP_H - 1;
      switch (ruleRegion) {
        case 0:
          terrain = e > 0.86 ? 'mountain' : e > 0.7 ? 'hills' : (e < 0.34 && m > 0.58) ? 'water' : m > 0.6 ? 'forest' : 'plains';
          break;
        case 1:
          terrain = e > 0.8 ? 'mountain' : e > 0.6 ? 'hills' : (m < 0.36 && h > 0.45) ? 'ruins' : (e < 0.3 && m > 0.66) ? 'water' : m > 0.72 ? 'forest' : 'plains';
          break;
        case 2:
          terrain = e > 0.84 ? 'mountain' : e > 0.64 ? 'hills' : (h > 0.82) ? 'ruins' : (e < 0.28 && m > 0.7) ? 'water' : 'ash';
          break;
        default:
          terrain = e > 0.8 ? 'mountain' : e > 0.66 ? 'hills' : m > 0.56 ? 'crystal' : (h > 0.9) ? 'ruins' : 'ash';
      }
      if (edge && terrain !== 'mountain' && h > 0.5) terrain = 'mountain';
      const { q, r } = { q: col, r: row - (col + (col & 1)) / 2 };
      tiles.push({
        col, row, q, r, terrain, region, elevation: e,
        threat: 0, void: false, voidAt: -1, settlementId: null,
        decor: Math.floor(h * 1000),
      });
    }
  }
  return tiles;
}

function tileAt(tiles: Tile[], col: number, row: number): Tile | null {
  if (!inBounds(col, row, MAP_W, MAP_H)) return null;
  return tiles[row * MAP_W + col];
}

/** A* over hexes with terrain cost and per-run noise so spines wander. */
function findPath(tiles: Tile[], from: [number, number], to: [number, number], seed: number, noiseW = 2.5, avoid?: Set<string>): Array<[number, number]> | null {
  const open: Array<{ k: string; f: number }> = [];
  const g = new Map<string, number>();
  const came = new Map<string, string>();
  const startK = tileKey(from[0], from[1]);
  const goalK = tileKey(to[0], to[1]);
  g.set(startK, 0);
  open.push({ k: startK, f: 0 });
  const closed = new Set<string>();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.k === goalK) {
      const path: Array<[number, number]> = [];
      let k: string | undefined = goalK;
      while (k) {
        const [c, r] = k.split(',').map(Number);
        path.push([c, r]);
        k = came.get(k);
      }
      return path.reverse();
    }
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    const [cc, cr] = cur.k.split(',').map(Number);
    for (const [nc, nr] of neighbors(cc, cr)) {
      const t = tileAt(tiles, nc, nr);
      if (!t || t.terrain === 'mountain') continue;
      const nk = tileKey(nc, nr);
      if (avoid && avoid.has(nk) && nk !== goalK) continue;
      const step = TRACK_COST[t.terrain] + hash2(nc, nr, seed) * noiseW + (t.terrain === 'water' ? 3 : 0);
      const ng = (g.get(cur.k) ?? 0) + step;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, cur.k);
        const hcost = hexDistance(nc, nr, to[0], to[1]);
        open.push({ k: nk, f: ng + hcost });
      }
    }
  }
  return null;
}

function addPathLinks(path: Array<[number, number]>, links: Set<string>): void {
  for (let i = 0; i + 1 < path.length; i++) links.add(edgeKey(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
}

function nameFor(rng: Rng, used: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const n = rng.pick(NAMES_A) + rng.pick(SYL_B);
    if (!used.has(n)) { used.add(n); return n; }
  }
  return 'Halt ' + used.size;
}

function offersFor(type: SettlementType, rng: Rng, region: number): ResourceBundle {
  const m = 1 + region * 0.25;
  switch (type) {
    case 'depot': return { rails: Math.round(rng.range(14, 22) * m) };
    case 'mine': return { scrap: Math.round(rng.range(24, 40) * m) };
    case 'farm': return { food: Math.round(rng.range(18, 30) * m) };
    case 'fuel': return { coal: Math.round(rng.range(30, 46) * m) };
    case 'armory': return { ammo: Math.round(rng.range(40, 60) * m) };
    case 'clinic': return { food: 6 };
    case 'village': return { rails: rng.int(3, 6), food: rng.int(2, 6) };
    case 'yard': return { scrap: Math.round(rng.range(10, 16) * m) };
    case 'watchtower': return { ammo: Math.round(rng.range(8, 14) * m) };
    case 'wreck': return { scrap: Math.round(rng.range(18, 34) * m) };
    case 'market': return {};
    case 'shrine': return {};
    case 'site': return {};
    case 'crossroads': return { ammo: Math.round(rng.range(10, 16) * m) };
    default: return {};
  }
}

function crewFor(type: SettlementType, rng: Rng): CrewSpecialty | null {
  switch (type) {
    case 'clinic': return 'medic';
    case 'yard': return rng.chance(0.55) ? 'mechanic' : null;
    case 'depot': return rng.chance(0.35) ? 'surveyor' : null;
    case 'armory': return rng.chance(0.45) ? 'gunner' : null;
    case 'fuel': return rng.chance(0.35) ? 'engineer' : null;
    case 'mine': return rng.chance(0.3) ? 'quartermaster' : null;
    case 'watchtower': return rng.chance(0.4) ? 'surveyor' : null;
    case 'wreck': return rng.chance(0.35) ? 'mechanic' : null;
    case 'village': return rng.chance(0.3) ? rng.pick(['gunner', 'engineer', 'surveyor', 'mechanic', 'quartermaster'] as CrewSpecialty[]) : null;
    default: return null;
  }
}

const REGION_SETTLEMENTS: SettlementType[][] = [
  ['village', 'depot', 'farm', 'fuel', 'yard', 'mine', 'armory', 'clinic', 'village', 'depot', 'fuel', 'village', 'watchtower', 'shrine', 'wreck', 'market', 'site', 'site'],
  ['village', 'depot', 'mine', 'mine', 'fuel', 'yard', 'armory', 'farm', 'depot', 'village', 'fuel', 'clinic', 'watchtower', 'wreck', 'market', 'shrine', 'site', 'site'],
  ['village', 'depot', 'mine', 'fuel', 'yard', 'clinic', 'armory', 'farm', 'village', 'depot', 'fuel', 'mine', 'shrine', 'watchtower', 'wreck', 'market', 'site', 'site'],
  ['village', 'depot', 'mine', 'fuel', 'yard', 'armory', 'farm', 'clinic', 'village', 'depot', 'fuel', 'armory', 'shrine', 'wreck', 'watchtower', 'market', 'site', 'site'],
];

export function generateWorld(seed: number): WorldGen {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const tiles = genTerrain(seed);
  const midRow = Math.floor(MAP_H / 2);
  const start: [number, number] = [6, midRow + rng.int(-2, 2)];
  const terminus: [number, number] = [MAP_W - 2, midRow + rng.int(-3, 3)];
  // make sure start/terminus and their surroundings are passable
  for (const [c, r] of [start, terminus]) {
    const t = tileAt(tiles, c, r)!;
    t.terrain = t.region >= 2 ? 'ash' : 'plains';
    for (const [nc, nr] of neighbors(c, r)) {
      const n = tileAt(tiles, nc, nr);
      if (n && (n.terrain === 'mountain' || n.terrain === 'water')) n.terrain = n.region >= 2 ? 'ash' : 'plains';
    }
  }

  // ---- three main lines: Central, Northern, Southern (+ crossovers between neighbours)
  const links = new Set<string>();
  const lineOf: Record<string, number> = {};
  const railTiles = new Set<string>();
  const lineTiles: Array<Set<string>> = [new Set(), new Set(), new Set(), new Set()];
  const addLine = (path: Array<[number, number]>, id: number): void => {
    for (let i = 0; i + 1 < path.length; i++) {
      const k = edgeKey(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
      links.add(k);
      if (lineOf[k] === undefined) lineOf[k] = id;
    }
    for (const pt of path) { railTiles.add(tileKey(pt[0], pt[1])); lineTiles[id].add(tileKey(pt[0], pt[1])); }
  };
  const clampRow = (row: number) => Math.max(2, Math.min(MAP_H - 3, row));
  const passableAt = (col: number, row: number): [number, number] => {
    let r = clampRow(row);
    let t = tileAt(tiles, col, r)!;
    for (let k = 1; k < 20 && t.terrain === 'mountain'; k++) { r = clampRow(row + (k % 2 ? k : -k)); t = tileAt(tiles, col, r)!; }
    if (t.terrain === 'mountain') t.terrain = 'hills';
    return [col, r];
  };
  const buildLine = (from: [number, number], via: Array<[number, number]>, to: [number, number], salt: number): Array<[number, number]> => {
    const pts = [from, ...via, to];
    const out: Array<[number, number]> = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const seg = findPath(tiles, pts[i], pts[i + 1], seed + salt + i * 17, 3) ?? [pts[i], pts[i + 1]];
      if (out.length) seg.shift();
      out.push(...seg);
    }
    return out;
  };
  // Lead-in: a short straight of old rail west of the depot so the train spawns fully on track
  const leadIn: Array<[number, number]> = [];
  for (let c = 1; c <= start[0]; c++) {
    const t = tileAt(tiles, c, start[1])!;
    if (t.terrain === 'mountain' || t.terrain === 'water') t.terrain = 'plains';
    leadIn.push([c, start[1]]);
  }
  // Crossroads hubs at each region boundary: the only places where all three lines meet
  const hubs: Array<[number, number]> = [];
  for (let reg = 0; reg < REGIONS - 1; reg++) hubs.push(passableAt((reg + 1) * REGION_W - 2, midRow + rng.int(-3, 3)));
  const ringPts = neighbors(terminus[0], terminus[1]).filter(([c, r]) => inBounds(c, r, MAP_W, MAP_H));
  const ringNorth = ringPts.slice().sort((a, b) => a[1] - b[1])[0];
  const ringSouth = ringPts.slice().sort((a, b) => b[1] - a[1])[0];
  const northBand = [4, 10];
  const southBand = [MAP_H - 11, MAP_H - 5];
  const central: Array<[number, number]> = [];
  const northern: Array<[number, number]> = [];
  const southern: Array<[number, number]> = [];
  const append = (line: Array<[number, number]>, seg: Array<[number, number]>) => { if (line.length && seg.length) seg = seg.slice(1); line.push(...seg); };
  for (let reg = 0; reg < REGIONS; reg++) {
    const from: [number, number] = reg === 0 ? start : hubs[reg - 1];
    const last = reg === REGIONS - 1;
    const c0 = reg * REGION_W;
    const via = (band: number[] | null): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      for (const frac of [0.3, 0.7]) {
        const col = c0 + Math.floor(REGION_W * frac) + rng.int(-2, 2);
        out.push(passableAt(col, band ? rng.int(band[0], band[1]) : midRow + rng.int(-4, 4)));
      }
      return out;
    };
    append(central, buildLine(from, via(null), last ? terminus : hubs[reg], reg * 10));
    append(northern, buildLine(from, via(northBand), last ? ringNorth : hubs[reg], 1000 + reg * 10));
    append(southern, buildLine(from, via(southBand), last ? ringSouth : hubs[reg], 2000 + reg * 10));
  }
  addLine(leadIn, 0);
  addLine(central, 0);
  addLine(northern, 1);
  addLine(southern, 2);
  const spine = central;
  const linePaths = [central, northern, southern];
  const crossovers: Array<[number, number]> = hubs.slice();

  // ---- settlements, flavoured by line
  const settlements: Settlement[] = [];
  const usedNames = new Set<string>();
  const occupied = new Set<string>();
  const place = (type: SettlementType, col: number, row: number, region: number, minDist = 3): Settlement | null => {
    const t = tileAt(tiles, col, row);
    if (!t || t.terrain === 'mountain' || t.terrain === 'water' || t.settlementId) return null;
    for (const s of settlements) if (hexDistance(s.col, s.row, col, row) < minDist) return null;
    const id = 's' + settlements.length;
    const s: Settlement = {
      id, name: type === 'start' ? 'Lastlight Depot' : type === 'terminus' ? 'The Last Gate' : type === 'crossroads' ? nameFor(rng, usedNames) + ' Crossroads' : nameFor(rng, usedNames),
      type, col, row, region, offers: offersFor(type, rng, region),
      passengers: type === 'village' ? rng.int(6, 14) : type === 'clinic' ? rng.int(2, 5) : type === 'farm' ? rng.int(0, 4) : 0,
      crew: crewFor(type, rng), deadline: 0, visited: type === 'start', consumed: false, rescued: false,
    };
    t.settlementId = id;
    settlements.push(s);
    occupied.add(tileKey(col, row));
    return s;
  };
  place('start', start[0], start[1], 0);
  place('terminus', terminus[0], terminus[1], REGIONS - 1);
  for (let i = 0; i < hubs.length; i++) place('crossroads', hubs[i][0], hubs[i][1], i);

  const LINE_TYPES: SettlementType[][] = [
    ['yard', 'fuel', 'shrine', 'wreck', 'fuel', 'depot'],                 // central: balanced
    ['mine', 'armory', 'depot', 'site', 'watchtower', 'mine'],            // northern: rich, dangerous
    ['village', 'farm', 'clinic', 'market', 'village', 'site'],           // southern: passengers, calm
  ];
  const OFF_LINE: Set<SettlementType> = new Set(['site', 'farm', 'wreck']);
  for (let reg = 0; reg < REGIONS; reg++) {
    const c0 = reg * REGION_W, c1 = c0 + REGION_W - 1;
    for (let li = 0; li < 3; li++) {
      const path = linePaths[li];
      const onLine = path.filter(pt => pt[0] > c0 + 1 && pt[0] < c1 - 1 && regionOf(pt[0]) === reg);
      const list = rng.shuffle([...LINE_TYPES[li]]);
      for (const type of list) {
        if (OFF_LINE.has(type)) {
          let ok = false;
          for (let tries = 0; tries < 40 && !ok; tries++) {
            const anchor = onLine.length ? rng.pick(onLine) : passableAt(rng.int(c0 + 2, c1 - 2), midRow);
            const col = Math.max(c0 + 1, Math.min(c1 - 1, anchor[0] + rng.int(-2, 2)));
            const row = clampRow(anchor[1] + rng.int(2, 3) * (rng.chance(0.5) ? 1 : -1));
            let dMin = 99;
            for (const k of railTiles) { const [rc, rr] = k.split(',').map(Number); if (Math.abs(rc - col) > 4) continue; dMin = Math.min(dMin, hexDistance(rc, rr, col, row)); }
            if (dMin < 2 || dMin > 3) continue;
            ok = !!place(type, col, row, reg);
          }
          if (!ok) for (const pt of rng.shuffle([...onLine])) { if (place(type, pt[0], pt[1], reg)) break; }
        } else {
          let ok = false;
          for (const pt of rng.shuffle([...onLine])) { if (place(type, pt[0], pt[1], reg)) { ok = true; break; } }
          if (!ok) for (const pt of rng.shuffle([...onLine])) { if (place(type, pt[0], pt[1], reg, 2)) { ok = true; break; } }
        }
      }
    }
    // guarantee a yard per region (repair stop)
    if (!settlements.some(s => s.region === reg && s.type === 'yard')) {
      let ok = false;
      for (const pt of rng.shuffle(central.filter(q => regionOf(q[0]) === reg))) { if (place('yard', pt[0], pt[1], reg, 2)) { ok = true; break; } }
      for (let tries = 0; tries < 300 && !ok; tries++) {
        const col = rng.int(c0 + 1, c1 - 1), row = rng.int(1, MAP_H - 2);
        ok = !!place('yard', col, row, reg, 1);
      }
    }
  }
  void crossovers;

  // ---- Void Maw loop: ring of rail around the terminus
  const ring = neighbors(terminus[0], terminus[1]).filter(([c, r]) => inBounds(c, r, MAP_W, MAP_H));
  for (const [c, r] of ring) { const t = tileAt(tiles, c, r)!; if (t.terrain === 'mountain' || t.terrain === 'water') t.terrain = 'ash'; }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (hexDistance(a[0], a[1], b[0], b[1]) === 1) links.add(edgeKey(a[0], a[1], b[0], b[1]));
    links.add(edgeKey(a[0], a[1], terminus[0], terminus[1]));
  }

  // ---- threat map
  for (const t of tiles) {
    const base = [0.1, 0.24, 0.34, 0.42][t.region];
    let th = base + fbm(t.col * 0.3, t.row * 0.3, seed + 77, 2) * 0.25;
    if (t.terrain === 'ruins') th += 0.15;
    if (t.terrain === 'forest') th += 0.06;
    for (const s of settlements) {
      const d = hexDistance(s.col, s.row, t.col, t.row);
      if (d <= 3 && (s.type === 'mine' || s.type === 'armory' || s.type === 'depot')) th += (4 - d) * 0.08;
      if (d <= 2 && (s.type === 'yard' || s.type === 'start')) th -= 0.1;
    }
    // line flavour: highlands are richer and rougher, lowlands calmer
    let lineAdj = 0, lineD = 99;
    for (let li = 0; li < 3; li++) {
      for (const [nc, nr] of neighbors(t.col, t.row)) if (lineTiles[li].has(tileKey(nc, nr)) && 1 < lineD) { lineD = 1; lineAdj = LINE_THREAT[li]; }
      if (lineTiles[li].has(tileKey(t.col, t.row))) { lineD = 0; lineAdj = LINE_THREAT[li]; }
    }
    th += lineAdj;
    for (const h of hubs) if (hexDistance(h[0], h[1], t.col, t.row) <= 3) th += 0.2;
    t.threat = Math.max(0, Math.min(1, th));
  }

  // ---- void front: starts a few hexes west of the map edge
  const voidFront: number[] = [];
  const x0 = hexToWorld(0, 0).x - HEX_R * 10;
  for (let row = 0; row < MAP_H; row++) voidFront.push(x0 + (fbm(row * 0.4, 0, seed + 5, 2) - 0.5) * VOID.noiseAmp);

  // deadlines (estimates; refreshed live by the void module)
  for (const s of settlements) {
    const w = hexToWorld(s.col, s.row);
    s.deadline = Math.max(0, (w.x - voidFront[s.row]) / VOID.baseSpeed);
  }

  return { tiles, settlements, railLinks: [...links].sort(), railLines: lineOf, spine, lines: linePaths, start, terminus, loopTiles: ring, voidFront };
}

export function worldToState(state: SimState, w: WorldGen): void {
  state.tiles = w.tiles;
  state.settlements = w.settlements;
  state.route.railLinks = w.railLinks;
  state.route.railLines = w.railLines;
  state.route.path = [w.start];
  state.void.front = w.voidFront;
  state.boss.loopTiles = w.loopTiles;
}
