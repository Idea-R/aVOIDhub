/**
 * Camera choreography for cinematics. The DOM UI draws letterbox bars and title cards; this module
 * only moves the camera, drives a few render-side effects (forced night look, line highlights, loco
 * steam) and dispatches window CustomEvent 'railavoid:cine'
 * ({ phase: 'start'|'card'|'end', name, title, subtitle }) at the right moments.
 *
 * 'opening' is the scripted ~24 s intro of a fresh run (main.ts freezes the sim while it plays), so
 * everything here is camera + render FX only. Five shots, one card each:
 *   1 Presents      tight on the start depot lanterns, the void rim glowing at the left of frame
 *   2 The line      slow dolly east along the Central line from the parked locomotive
 *   3 Three lines   wide shot, the amber / cream / teal lines fanning out, each pulsed in turn
 *   4 Crossroads    swoop to the first hub, slow orbit drift while the tower lanterns sweep
 *   5 Departure     fast dolly back to the locomotive, headlight snaps on, steam burst, follow mode
 * Reduced motion shortens it to three cards with short eased moves and no orbit. Skipping jumps to the
 * end state (zoom 1.1, follow on, bounds / night look / highlights restored) in one frame.
 */
import Phaser from 'phaser';
import type { SimState } from '../core/types';
import { ISO_Y, MAP_H } from '../core/config';
import { hexToWorld, tileKey } from '../core/hex';
import { clamp, smoothstep, lerp, hexCenterP, type Pt } from './util';
import { safeParseKey } from './terrain';
import type { FxLayer } from './fxLayer';

export type CineName = 'opening' | 'run_intro' | 'region_enter' | 'boss_intro' | 'victory' | 'defeat';
export interface CineData { title?: string; subtitle?: string; x?: number; y?: number; }

interface Card { at: number; title?: string; subtitle?: string; sent: boolean; }

/** Everything the opening needs, captured once at play() (projected world coords). */
interface OpeningPlan {
  presentsAt: Pt;                 // shot 1 camera centre
  dolly: Pt[];                    // shot 2 polyline: presentsAt → depot → east along the Central line
  dollyCum: number[];             // cumulative lengths of `dolly`
  wide: Pt;                       // shot 3 centre (~14 columns east of the depot)
  lineHexes: Array<[number, number] | null>; // hexes to pulse: [Northern, Central, Southern]
  hub: Pt;                        // first crossroads hub (lowest column)
  loco: Pt; chimney: Pt; headlight: Pt; locoA: number;
  locoCam: Pt;                    // where follow mode will rest at gameplay zoom (bounds-clamped) — shot 5 lands here
  steamAcc: number;
  snapDone: boolean;
  highlight: number;              // line hex index currently forced (-1 none)
}

interface Shot {
  name: CineName;
  data: CineData;
  duration: number;
  cards: Card[];
  t: number;
  resolve: () => void;
  // captured at start (projected world coords)
  fromX: number; fromY: number; fromZoom: number;
  toX: number; toY: number;
  shakeDone: boolean;
  opening: OpeningPlan | null;
  forState: SimState | null;      // the sim state this cinematic was built for
}

export interface CineHost {
  scene: Phaser.Scene;
  state(): SimState | null;
  fx(): FxLayer | null;
  locoProjected(): { x: number; y: number } | null;
  voidFrontProjected(): { x: number; y: number } | null;
  reducedMotion(): boolean;
  shake(power: number): void;
  setFollowing(on: boolean): void;
  /** Snap the follow camera onto the locomotive (clean end state after a skip). */
  snapToLoco(): void;
  /** Disable (false) / restore (true) the camera world bounds — the opening frames the map edge. */
  setCameraBounds(on: boolean): void;
  /** Force the night look (depot lanterns, tower sweeps, headlight) 0..1 while a cinematic plays. */
  setNightBoost(v: number): void;
  /** Force the line hover highlight on a hex (null clears). */
  setLineHighlight(hex: [number, number] | null): void;
  /** Camera centre that "centre on (x, y) at zoom" settles to once the world bounds clamp it. */
  restCenter(x: number, y: number, zoom: number): { x: number; y: number };
}

// opening shot boundaries (seconds)
const OP = { presents: 3.5, line: 9, lines: 14.5, hub: 19.5, end: 24.5, finalCard: 21.3, flight: 2.0 };
const OP_RM = { presents: 2.6, lines: 5.2, end: 7.8, move: 0.45 };
const ZOOM_TIGHT = 2.2, ZOOM_DOLLY = 1.35, ZOOM_WIDE = 0.55, ZOOM_HUB = 1.5, ZOOM_PLAY = 1.1;
// shot 3 line pulses (seconds into the shot): north → central → south, ~0.8 s each
const PULSES: Array<[number, number]> = [[1.7, 2.5], [2.5, 3.3], [3.3, 4.1]];

const easeInOutSine = (u: number): number => -(Math.cos(Math.PI * clamp(u, 0, 1)) - 1) / 2;
const easeInOutCubic = (u: number): number => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };

export class CinematicController {
  private shot: Shot | null = null;

  constructor(private host: CineHost) {}

  isPlaying(): boolean { return this.shot !== null; }
  /** Name of the running cinematic, or null. */
  current(): CineName | null { return this.shot ? this.shot.name : null; }
  /** Seconds into the running cinematic (0 when idle) — verification harnesses key screenshots off this. */
  elapsed(): number { return this.shot ? this.shot.t : 0; }
  /** True when the running cinematic was built for this sim state (a fresh run's opening survives the static rebuild). */
  isForState(st: SimState | null): boolean { return !!this.shot && !!st && this.shot.forState === st; }
  /** The scene rebuilt its static layers / camera bounds for the same state: re-apply what the opening borrowed. */
  onWorldRebuilt(): void {
    if (this.shot?.opening) { try { this.host.setCameraBounds(false); } catch { /* ignore */ } }
  }

  play(name: CineName, data: CineData = {}): Promise<void> {
    // a new cinematic replaces the running one (which ends immediately)
    if (this.shot) this.finish();
    const rm = this.host.reducedMotion();
    const cam = this.host.scene.cameras.main;
    const loco = this.host.locoProjected() ?? { x: cam.midPoint.x, y: cam.midPoint.y };
    const durations: Record<CineName, number> = { opening: OP.end, run_intro: 7, region_enter: 4, boss_intro: 4, victory: 5, defeat: 3 };
    const cardAt: Record<CineName, number> = { opening: 0, run_intro: 2, region_enter: 0.5, boss_intro: 1.4, victory: 1, defeat: 0.8 };
    const mul = rm ? 0.55 : 1;
    let fromX = cam.midPoint.x, fromY = cam.midPoint.y, fromZoom = cam.zoom;
    let toX = loco.x, toY = loco.y;
    if (name === 'run_intro') {
      const vf = this.host.voidFrontProjected();
      fromX = vf ? vf.x - 80 : loco.x - 500; fromY = loco.y; fromZoom = 0.55;
      // land where follow mode will rest (the depot sits near the west bounds) so the hand-over does not jump
      const rest = this.safeRest(loco.x, loco.y, ZOOM_PLAY);
      toX = rest.x; toY = rest.y;
    } else if (name === 'boss_intro') {
      if (Number.isFinite(data.x) && Number.isFinite(data.y)) { toX = data.x as number; toY = (data.y as number) * ISO_Y; }
      fromX = loco.x; fromY = loco.y;
    } else {
      fromX = loco.x; fromY = loco.y;
    }
    let resolve: () => void = () => {};
    const p = new Promise<void>(r => { resolve = r; });
    let duration = durations[name] * mul;
    let cards: Card[] = [{ at: cardAt[name] * mul, title: data.title, subtitle: data.subtitle, sent: false }];
    let opening: OpeningPlan | null = null;
    if (name === 'opening') {
      opening = this.buildOpening();
      duration = rm ? OP_RM.end : OP.end;
      cards = rm
        ? [
          { at: 0, title: 'aVOID Games', subtitle: 'presents', sent: false },
          { at: OP_RM.presents, title: 'Three lines. One train.', subtitle: 'Northern · Central · Southern', sent: false },
          { at: OP_RM.lines, title: 'RAILaVOID', subtitle: 'Lay track. Keep moving. Outrun the void.', sent: false },
        ]
        : [
          { at: 0, title: 'aVOID Games', subtitle: 'presents', sent: false },
          { at: OP.presents, title: 'The continent is falling into the void.', subtitle: 'Lastlight Depot · the last train', sent: false },
          { at: OP.line, title: 'Three lines. One train.', subtitle: 'Northern · Central · Southern', sent: false },
          { at: OP.lines, title: 'Every line meets at the Crossroads.', subtitle: 'fight through · pay the toll · bribe the tower', sent: false },
          { at: OP.finalCard, title: 'RAILaVOID', subtitle: 'Lay track. Keep moving. Outrun the void.', sent: false },
        ];
    }
    this.shot = {
      name, data, duration, cards, t: 0, resolve,
      fromX, fromY, fromZoom, toX, toY, shakeDone: false, opening, forState: this.host.state(),
    };
    this.host.setFollowing(false);
    if (opening) { this.host.setCameraBounds(false); this.host.setNightBoost(1); }
    this.dispatch('start');
    this.sendDueCards();
    this.apply(0, 0);
    return p;
  }

  skip(): void {
    if (!this.shot) return;
    this.finish();
  }

  private finish(): void {
    const s = this.shot;
    if (!s) return;
    this.shot = null;
    const cam = this.host.scene.cameras.main;
    try { cam.setRotation(0); } catch { /* ignore */ }
    // leave the camera at a sensible resting zoom and resume follow
    if (s.name === 'run_intro' || s.name === 'opening') cam.setZoom(ZOOM_PLAY);
    else if (s.name === 'region_enter' || s.name === 'boss_intro') cam.setZoom(s.fromZoom);
    else if (s.name === 'defeat') cam.setZoom(Math.max(cam.zoom, 1.4));
    if (s.opening) {
      // restore everything the opening borrowed, in one frame
      try { this.host.setLineHighlight(null); } catch { /* ignore */ }
      try { this.host.setNightBoost(0); } catch { /* ignore */ }
      try { this.host.setCameraBounds(true); } catch { /* ignore */ }
    }
    this.host.setFollowing(true);
    try { this.host.snapToLoco(); } catch { /* ignore */ }
    // the closing card always goes out (so the UI can show its final state even on a skip)
    const last = s.cards[s.cards.length - 1];
    if (last && !last.sent) { last.sent = true; this.dispatch('card', s, last); }
    this.dispatch('end', s);
    try { s.resolve(); } catch { /* ignore */ }
  }

  private dispatch(phase: 'start' | 'card' | 'end', s: Shot | null = this.shot, card: Card | null = null): void {
    if (!s) return;
    try {
      window.dispatchEvent(new CustomEvent('railavoid:cine', {
        detail: { phase, name: s.name, title: card ? card.title : s.data.title, subtitle: card ? card.subtitle : s.data.subtitle },
      }));
    } catch { /* ignore */ }
  }

  private sendDueCards(): void {
    const s = this.shot;
    if (!s) return;
    for (const c of s.cards) {
      if (!c.sent && s.t >= c.at) { c.sent = true; this.dispatch('card', s, c); }
    }
  }

  update(dt: number): void {
    const s = this.shot;
    if (!s) return;
    s.t += dt;
    this.sendDueCards();
    if (s.t >= s.duration) { this.finish(); return; }
    this.apply(s.t / s.duration, dt);
  }

  private apply(u: number, dt: number): void {
    const s = this.shot;
    if (!s) return;
    if (s.opening) { this.applyOpening(s, s.opening, dt); return; }
    const cam = this.host.scene.cameras.main;
    const rm = this.host.reducedMotion();
    const loco = this.host.locoProjected() ?? { x: s.fromX, y: s.fromY };
    let x = loco.x, y = loco.y, zoom = cam.zoom, rot = 0;
    switch (s.name) {
      case 'run_intro': {
        // dolly east from the void front to the locomotive (its bounds-clamped rest frame) while zooming in
        const k = smoothstep(clamp(u * 1.15, 0, 1));
        x = lerp(s.fromX, s.toX, k); y = lerp(s.fromY, s.toY, k);
        zoom = lerp(0.55, 1.1, smoothstep(clamp((u - 0.1) / 0.85, 0, 1)));
        break;
      }
      case 'region_enter': {
        // gentle zoom-out pulse and back
        const pulse = Math.sin(u * Math.PI);
        zoom = s.fromZoom * (1 - 0.28 * smoothstep(pulse));
        x = loco.x; y = loco.y;
        break;
      }
      case 'boss_intro': {
        const a = 0.3, b = 0.7; // pan out | hold | pan back
        if (u < a) { const k = smoothstep(u / a); x = lerp(s.fromX, s.toX, k); y = lerp(s.fromY, s.toY, k); zoom = lerp(s.fromZoom, 1.3, k); }
        else if (u < b) {
          const k = (u - a) / (b - a);
          x = s.toX; y = s.toY; zoom = lerp(1.3, 1.65, smoothstep(k));
          if (!s.shakeDone && k > 0.15) { s.shakeDone = true; this.host.shake(0.7); }
        } else { const k = smoothstep((u - b) / (1 - b)); x = lerp(s.toX, loco.x, k); y = lerp(s.toY, loco.y, k); zoom = lerp(1.65, s.fromZoom, k); }
        break;
      }
      case 'victory': {
        const k = smoothstep(u);
        zoom = lerp(s.fromZoom, Math.min(s.fromZoom, 0.7), k);
        x = loco.x + (rm ? 0 : 90 * u); y = loco.y - (rm ? 0 : 30 * u);
        break;
      }
      case 'defeat': {
        const k = smoothstep(clamp(u / 0.8, 0, 1));
        zoom = lerp(s.fromZoom, Math.max(s.fromZoom, 1.9), k);
        x = loco.x; y = loco.y;
        rot = rm ? 0 : 0.03 * Math.sin(u * Math.PI);
        if (!s.shakeDone && u > 0.15) { s.shakeDone = true; this.host.shake(rm ? 0 : 0.6); }
        break;
      }
      case 'opening':
        break;
    }
    cam.setZoom(clamp(zoom, 0.3, 2.5));
    try { cam.setRotation(rot); } catch { /* ignore */ }
    cam.centerOn(x, y);
  }

  // ------------------------------------------------------------------------------- opening
  private buildOpening(): OpeningPlan {
    const st = this.host.state();
    const cam = this.host.scene.cameras.main;
    // the start depot (Lastlight)
    const start = st?.settlements?.find(s => s.type === 'start');
    const p0 = st?.route?.path?.[0];
    const depotHex: [number, number] = start ? [start.col, start.row] : p0 ? [p0[0], p0[1]] : [1, MAP_H >> 1];
    const depot = hexCenterP(depotHex[0], depotHex[1]);
    // shot 1 framing: depot lanterns right of centre with the void rim glowing at the left edge of frame
    // (the depot always stays in frame; the rim is pulled in only when it would fall off the left)
    const fr = st?.void?.front?.[depotHex[1]];
    const voidX = Number.isFinite(fr) ? (fr as number) : depot.x - 400;
    const halfW = cam.width / 2 / ZOOM_TIGHT;
    let cx = depot.x - halfW * 0.28;
    if (voidX < cx - halfW * 0.9) cx = voidX + halfW * 0.9;
    if (depot.x > cx + halfW * 0.85) cx = depot.x - halfW * 0.85;
    const presentsAt = { x: cx, y: depot.y - 10 };
    // shot 2 dolly: east along the Central line for ~11 hexes
    const dolly: Pt[] = [presentsAt, depot, ...this.centralLine(st, depotHex, 11)];
    const dollyCum = [0];
    for (let i = 1; i < dolly.length; i++) dollyCum.push(dollyCum[i - 1] + Math.hypot(dolly[i].x - dolly[i - 1].x, dolly[i].y - dolly[i - 1].y));
    // shot 3: wide, ~14 columns east; the three lines fan out around it
    const targetCol = depotHex[0] + 14;
    const lineHexes = [1, 0, 2].map(id => this.lineHexNear(st, id, targetCol));
    const ys = lineHexes.filter((h): h is [number, number] => !!h).map(h => hexCenterP(h[0], h[1]).y);
    const wide = { x: hexToWorld(targetCol, depotHex[1]).x, y: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : depot.y };
    // shot 4: the first crossroads hub (lowest column)
    const hubs = (st?.settlements ?? []).filter(s => s.type === 'crossroads').sort((a, b) => a.col - b.col);
    const hub = hubs.length ? hexCenterP(hubs[0].col, hubs[0].row) : hexCenterP(depotHex[0] + 37, depotHex[1]);
    // the locomotive (parked at the depot)
    const lp = this.host.locoProjected() ?? depot;
    const ta = st?.train?.trailAngle?.[0];
    const a = Number.isFinite(ta) ? (ta as number) : 0;
    const ca = Math.cos(a), sa = Math.sin(a);
    return {
      presentsAt, dolly, dollyCum, wide, lineHexes, hub,
      loco: { x: lp.x, y: lp.y }, locoA: a, locoCam: this.safeRest(lp.x, lp.y, ZOOM_PLAY),
      chimney: { x: lp.x + 10 * ca, y: lp.y + 10 * sa * ISO_Y - 14 },
      headlight: { x: lp.x + 17 * ca, y: lp.y + 17 * sa * ISO_Y - 6 },
      steamAcc: 0, snapDone: false, highlight: -1,
    };
  }

  private safeRest(x: number, y: number, zoom: number): Pt {
    try {
      const r = this.host.restCenter(x, y, zoom);
      if (r && Number.isFinite(r.x) && Number.isFinite(r.y)) return r;
    } catch { /* ignore */ }
    return { x, y };
  }

  /** Projected centres of the next `n` hexes east of `from` along the Central line (rail graph walk, line id 0). */
  private centralLine(st: SimState | null, from: [number, number], n: number): Pt[] {
    const out: Pt[] = [];
    const rail = st?.route?.railLinks;
    const lines = st?.route?.railLines && typeof st.route.railLines === 'object' ? st.route.railLines : {};
    if (Array.isArray(rail) && rail.length) {
      const adj = new Map<string, Array<{ k: string; line: number }>>();
      for (const k of rail) {
        const i = k.indexOf('|');
        if (i < 0) continue;
        const a = k.slice(0, i), b = k.slice(i + 1);
        const line = typeof lines[k] === 'number' ? lines[k] : 0;
        (adj.get(a) ?? adj.set(a, []).get(a)!).push({ k: b, line });
        (adj.get(b) ?? adj.set(b, []).get(b)!).push({ k: a, line });
      }
      const xOf = (k: string): number => { const p = safeParseKey(k); return p ? hexToWorld(p[0], p[1]).x : -Infinity; };
      const seen = new Set<string>();
      let cur = tileKey(from[0], from[1]);
      seen.add(cur);
      for (let i = 0; i < n; i++) {
        const opts = (adj.get(cur) ?? []).filter(o => !seen.has(o.k));
        if (!opts.length) break;
        // prefer the Central line, then the most eastward branch
        opts.sort((p, q) => ((p.line === 0 ? 0 : 1) - (q.line === 0 ? 0 : 1)) || (xOf(q.k) - xOf(p.k)));
        cur = opts[0].k;
        seen.add(cur);
        const p = safeParseKey(cur);
        if (!p) break;
        out.push(hexCenterP(p[0], p[1]));
      }
    }
    if (!out.length) for (let i = 1; i <= n; i++) out.push(hexCenterP(from[0] + i, from[1]));
    return out;
  }

  /** A rail hex on line `id` whose column is closest to `col`, or null. */
  private lineHexNear(st: SimState | null, id: number, col: number): [number, number] | null {
    const rail = st?.route?.railLinks;
    const lines = st?.route?.railLines && typeof st.route.railLines === 'object' ? st.route.railLines : {};
    if (!Array.isArray(rail)) return null;
    let best: [number, number] | null = null, bd = Infinity;
    for (const k of rail) {
      const line = typeof lines[k] === 'number' ? lines[k] : 0;
      if (line !== id) continue;
      const i = k.indexOf('|');
      const a = safeParseKey(k.slice(0, i));
      if (!a) continue;
      const d = Math.abs(a[0] - col);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  private alongDolly(p: OpeningPlan, frac: number): Pt {
    const total = p.dollyCum[p.dollyCum.length - 1] || 0;
    const d = clamp(frac, 0, 1) * total;
    for (let i = 1; i < p.dolly.length; i++) {
      if (d <= p.dollyCum[i]) {
        const seg = p.dollyCum[i] - p.dollyCum[i - 1];
        const t = seg > 0 ? (d - p.dollyCum[i - 1]) / seg : 1;
        return { x: lerp(p.dolly[i - 1].x, p.dolly[i].x, t), y: lerp(p.dolly[i - 1].y, p.dolly[i].y, t) };
      }
    }
    return p.dolly[p.dolly.length - 1];
  }
  private dollyEnd(p: OpeningPlan): Pt { return p.dolly[p.dolly.length - 1]; }

  /** Parked-loco steam wisps and the odd chimney spark (shots 1-2). */
  private parkedSteam(p: OpeningPlan, dt: number): void {
    const fx = this.host.fx();
    if (!fx) return;
    p.steamAcc += dt * 4;
    while (p.steamAcc >= 1) {
      p.steamAcc -= 1;
      fx.steamP(p.chimney.x + (Math.random() - 0.5) * 3, p.chimney.y, 1, false);
      if (Math.random() < 0.35) fx.sparksP(p.chimney.x, p.chimney.y - 2, 1, 0xffb060);
    }
  }

  /** Headlight snap + steam burst + brake sparks at the start of the departure hold. */
  private departureBurst(p: OpeningPlan): void {
    this.host.setNightBoost(1);
    const fx = this.host.fx();
    if (!fx) return;
    const ca = Math.cos(p.locoA), sa = Math.sin(p.locoA);
    fx.lightP(p.headlight.x + ca * 22, p.headlight.y + sa * 22 * ISO_Y, 0xfff0c0, 64, 460);
    fx.steamP(p.chimney.x, p.chimney.y, 14, true);
    fx.steamP(p.chimney.x + ca * 4, p.chimney.y - 2, 8, false);
    for (const side of [-8, 8]) {
      for (let i = 0; i < 3; i++) {
        const u = (i - 1) * 9;
        fx.sparksP(p.loco.x + u * ca - side * sa, p.loco.y + (u * sa + side * ca) * ISO_Y, 4, 0xffd080);
      }
    }
    this.host.shake(0.25);
  }
  private brakeSparks(p: OpeningPlan, dt: number): void {
    const fx = this.host.fx();
    if (!fx || Math.random() >= dt * 26) return;
    const ca = Math.cos(p.locoA), sa = Math.sin(p.locoA);
    const side = Math.random() < 0.5 ? -8 : 8;
    const u = (Math.random() - 0.5) * 20;
    fx.sparksP(p.loco.x + u * ca - side * sa, p.loco.y + (u * sa + side * ca) * ISO_Y, 2, 0xffd080);
  }

  private setHighlight(p: OpeningPlan, idx: number): void {
    if (idx === p.highlight) return;
    p.highlight = idx;
    this.host.setLineHighlight(idx >= 0 ? p.lineHexes[idx] ?? null : null);
  }

  private applyOpening(s: Shot, p: OpeningPlan, dt: number): void {
    const cam = this.host.scene.cameras.main;
    const t = s.t;
    const rm = this.host.reducedMotion();
    let x: number, y: number, zoom: number;
    if (rm) {
      // three cards, short eased moves between them, no orbit
      const wideAt = OP_RM.presents, locoAt = OP_RM.lines, mv = OP_RM.move;
      if (t < wideAt) {
        x = p.presentsAt.x; y = p.presentsAt.y; zoom = ZOOM_TIGHT;
        this.parkedSteam(p, dt);
      } else if (t < locoAt) {
        const k = smoothstep((t - wideAt) / mv);
        x = lerp(p.presentsAt.x, p.wide.x, k); y = lerp(p.presentsAt.y, p.wide.y, k); zoom = lerp(ZOOM_TIGHT, ZOOM_WIDE, k);
        this.host.setNightBoost(0.4);
        this.setHighlight(p, 1);
      } else {
        const k = smoothstep((t - locoAt) / mv);
        x = lerp(p.wide.x, p.locoCam.x, k); y = lerp(p.wide.y, p.locoCam.y, k); zoom = lerp(ZOOM_WIDE, ZOOM_PLAY, k);
        this.setHighlight(p, -1);
        if (!p.snapDone) { p.snapDone = true; this.departureBurst(p); }
      }
    } else if (t < OP.presents) {
      // 1 Presents: parked tight on the depot, a barely perceptible push-out
      const k = smoothstep(t / OP.presents);
      x = p.presentsAt.x + 6 * k; y = p.presentsAt.y; zoom = ZOOM_TIGHT - 0.05 * k;
      this.host.setNightBoost(1);
      this.parkedSteam(p, dt);
    } else if (t < OP.line) {
      // 2 The line: dolly east along the Central line, easing out of the tight frame
      const u = (t - OP.presents) / (OP.line - OP.presents);
      const pos = this.alongDolly(p, easeInOutSine(u));
      x = pos.x; y = pos.y;
      zoom = lerp(ZOOM_TIGHT - 0.05, ZOOM_DOLLY, smoothstep(u / 0.42));
      this.host.setNightBoost(lerp(1, 0.4, smoothstep(u / 0.5)));
      if (u < 0.45) this.parkedSteam(p, dt);
    } else if (t < OP.lines) {
      // 3 Three lines: ease out wide, then pulse each line in turn
      const u = (t - OP.line) / (OP.lines - OP.line);
      const k = smoothstep(u / 0.42);
      const from = this.dollyEnd(p);
      x = lerp(from.x, p.wide.x, k); y = lerp(from.y, p.wide.y, k);
      zoom = lerp(ZOOM_DOLLY, ZOOM_WIDE, k);
      const local = t - OP.line;
      let idx = -1;
      for (let i = 0; i < PULSES.length; i++) if (local >= PULSES[i][0] && local < PULSES[i][1]) idx = i;
      this.setHighlight(p, idx);
      this.host.setNightBoost(0.4);
    } else if (t < OP.hub) {
      // 4 Crossroads: swoop to the first hub, then a slow orbit drift while the tower lanterns sweep
      const u = (t - OP.lines) / (OP.hub - OP.lines);
      const k = easeInOutCubic(u / 0.4);
      this.setHighlight(p, -1);
      const d = smoothstep((u - 0.32) / 0.4);
      const ang = (t - OP.lines) * 0.55;
      x = lerp(p.wide.x, p.hub.x, k) + Math.sin(ang) * 26 * d;
      y = lerp(p.wide.y, p.hub.y, k) + Math.cos(ang) * 11 * d;
      zoom = lerp(ZOOM_WIDE, ZOOM_HUB, k) + 0.08 * smoothstep((u - 0.4) / 0.6);
      this.host.setNightBoost(lerp(0.4, 1, smoothstep(u / 0.35)));
    } else {
      // 5 Departure: fast dolly back west to the locomotive; headlight snaps on with a steam burst, then hold
      const local = t - OP.hub;
      const k = easeInOutCubic(local / OP.flight);
      const orbitEnd = (OP.hub - OP.lines) * 0.55;
      const fx0 = p.hub.x + Math.sin(orbitEnd) * 26, fy0 = p.hub.y + Math.cos(orbitEnd) * 11;
      x = lerp(fx0, p.locoCam.x, k); y = lerp(fy0, p.locoCam.y, k);
      zoom = lerp(ZOOM_HUB + 0.08, ZOOM_PLAY, k) - 0.42 * Math.sin(k * Math.PI);
      if (local < OP.flight) {
        // lights out on the way down so the headlight can snap on when we arrive
        this.host.setNightBoost(lerp(1, 0, smoothstep(local / 0.6)));
      } else {
        if (!p.snapDone) { p.snapDone = true; this.departureBurst(p); }
        if (local < OP.flight + 0.75) this.brakeSparks(p, dt);
      }
    }
    cam.setZoom(clamp(zoom, 0.3, 2.5));
    try { cam.setRotation(0); } catch { /* ignore */ }
    cam.centerOn(x, y);
  }
}
