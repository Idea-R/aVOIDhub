/**
 * Settlements: a miniature cluster of 2-5 tiny iso buildings with a type-specific landmark,
 * a ground shadow, warm flickering window lights at night and occasional chimney smoke —
 * with the transit-diagram station marker (white ring, colored core, glyph, small-caps label,
 * deadline countdown arc) drawn on top.
 *
 * Hover (set by GameScene): the marker ring brightens and scales up with a soft glow, the label
 * brightens, a dotted guide line runs from the locomotive to the marker with an in-world
 * hex-distance chip, and the pre-laid rail branch leading to the settlement is highlighted.
 *
 * Level of detail: below zoom 0.7 only labels that matter (visited, unvisited with passengers,
 * yards, hovered) are shown; labels that would overlap an already-drawn label are skipped
 * (greedy, re-evaluated every 250 ms).
 *
 * Crossroads hubs (where the three lines meet) are fortified junction stations: a barricaded
 * platform, two stone watchtowers whose lanterns sweep a slow beam over the ground at night, a
 * striped toll gate and a signal gantry straddling the track. They are not havens — no militia glow.
 */
import Phaser from 'phaser';
import type { SimState, Settlement, SettlementType } from '../core/types';
import { ISO_Y } from '../core/config';
import { hexToWorld, neighbors, tileKey, worldToHex, hexDistance } from '../core/hex';
import { hexCenterP, dist, rgb, hashInt, clamp, expFactor } from './util';
import { settlementColor, FONT, CROSSROADS_LANTERN } from './palette';
import { TEX_SCALE } from './textures';
import { safeParseKey } from './terrain';
import type { FxLayer } from './fxLayer';
import type { RenderSettings } from './settings';

interface Building {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  light: Phaser.GameObjects.Image | null;
  beam: Phaser.GameObjects.Image | null;   // hub watchtower sweep beam (night only)
  flame: FlameKind | null;   // always-lit light (shrine flame, tower lantern, brazier)
  chimney: { x: number; y: number } | null;
  flicker: number;
}
type FlameKind = 'shrine' | 'lantern' | 'fire' | 'doorway' | 'sweep';
interface SView {
  id: string;
  type: SettlementType;
  col: number; row: number;
  x: number; y: number;
  color: number;
  ring: Phaser.GameObjects.Image;
  core: Phaser.GameObjects.Image;
  glyph: Phaser.GameObjects.Image;
  check: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  arc: Phaser.GameObjects.Graphics;
  buildings: Building[];
  gateGlow: Phaser.GameObjects.Image | null;
  status: string;
  seed: number;
  hoverT: number;        // 0..1 smoothed hover factor
  labelOk: boolean;      // passed the overlap test this cycle
  labelW: number; labelH: number;
}

const DEADLINE_WINDOW = 300;
const LABEL_LOD_ZOOM = 0.7;
const LABEL_OVERLAP_MS = 250;
const HOVER_RADIUS = 20;   // world px around the marker centre (ring is r=15)

/** Building sets per settlement type: [landmark, ...fillers]. Unknown types use the village look. */
const CLUSTERS: Record<SettlementType, string[]> = {
  start: ['b_depot', 'b_warehouse', 'b_house', 'b_railstack', 'b_house2'],
  village: ['b_chapel', 'b_house', 'b_house2', 'b_house', 'b_house2'],
  depot: ['b_warehouse', 'b_railstack', 'b_railstack', 'b_house2', 'b_shed'],
  mine: ['b_headframe', 'b_spoil', 'b_house2', 'b_spoil', 'b_railstack'],
  farm: ['b_silo', 'b_field', 'b_field', 'b_house', 'b_field'],
  fuel: ['b_tank', 'b_pump', 'b_pump', 'b_house2', 'b_tank'],
  clinic: ['b_clinic', 'b_house', 'b_house2', 'b_house'],
  armory: ['b_bunker', 'b_sandbags', 'b_sandbags', 'b_house2', 'b_bunker'],
  yard: ['b_crane', 'b_shed', 'b_railstack', 'b_warehouse', 'b_railstack'],
  terminus: ['b_gate', 'b_house2', 'b_house', 'b_house2'],
  watchtower: ['b_tower', 'b_palisade', 'b_brazier', 'b_house2', 'b_palisade'],
  shrine: ['b_shrine', 'b_stones', 'b_lantern_post', 'b_stones', 'b_lantern_post'],
  wreck: ['b_wreck_loco', 'b_wreck_car', 'b_scrap', 'b_scrap', 'b_wreck_car'],
  market: ['b_stall', 'b_stall2', 'b_crates', 'b_house2', 'b_crates'],
  // expedition site: a ruined bunker / temple front with a green-lit doorway among broken walls and columns
  site: ['b_site_gate', 'b_ruin_wall', 'b_ruin_pillar', 'b_ruin_wall', 'b_ruin_pillar'],
  // crossroads hub: fortified junction station (always the full set — two towers flank the platform,
  // gate and gantry straddle the track)
  crossroads: ['b_xr_platform', 'b_xr_tower', 'b_xr_gate', 'b_xr_gantry', 'b_xr_tower'],
};
const HAS_CHIMNEY = new Set(['b_house', 'b_house2', 'b_warehouse', 'b_shed', 'b_depot', 'b_headframe']);
const HAS_WINDOW = new Set(['b_house', 'b_house2', 'b_chapel', 'b_warehouse', 'b_clinic', 'b_shed', 'b_depot', 'b_silo', 'b_headframe', 'b_stall', 'b_stall2', 'b_xr_platform']);
/** Buildings placed on a rail direction (across the track) instead of a free slot beside it. */
const ON_TRACK = new Set(['b_xr_gate', 'b_xr_gantry']);

const normAngle = (a: number): number => { while (a <= -Math.PI) a += Math.PI * 2; while (a > Math.PI) a -= Math.PI * 2; return a; };
const angDist = (a: number, b: number): number => Math.abs(normAngle(a - b));

/**
 * Angular slots for a hub cluster. Hubs have 3-6 rail directions, which starves the generic 12-slot
 * picker, so the platform and the two towers are placed in the widest gaps between the rails:
 * the platform in the clearest upper gap (never over the label below the marker), the towers as far
 * from the platform and from each other as the gaps allow.
 */
function hubSlots(rail: number[]): { platform: number; towers: [number, number] } {
  const dirs = rail.map(normAngle).sort((a, b) => a - b);
  let cands: Array<{ a: number; clear: number }> = [];
  if (dirs.length === 0) cands = [{ a: -Math.PI / 2, clear: Math.PI }, { a: Math.PI * 5 / 6, clear: Math.PI }, { a: Math.PI / 6, clear: Math.PI }];
  for (let i = 0; i < dirs.length; i++) {
    const a0 = dirs[i], a1 = i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + Math.PI * 2;
    const gap = a1 - a0;
    const n = Math.max(1, Math.floor(gap / (Math.PI / 4)));   // one candidate per ~45° of gap
    for (let k = 1; k <= n; k++) {
      const off = gap * k / (n + 1);
      cands.push({ a: normAngle(a0 + off), clear: Math.min(off, gap - off) });
    }
  }
  const clear = cands.filter(c => c.clear >= 0.4);
  if (clear.length >= 3) cands = clear;
  const label = Math.PI / 2;
  const score = (c: { a: number; clear: number }) => c.clear * 0.5 - Math.sin(c.a) - (angDist(c.a, label) < 0.8 ? 5 : 0);
  cands.sort((p, q) => score(q) - score(p));
  const platform = cands[0].a;
  const rest = cands.slice(1);
  const pick = (from: number[]): number => {
    let best = -1, bs = -Infinity;
    for (let i = 0; i < rest.length; i++) {
      let s = rest[i].clear * 0.5 - (angDist(rest[i].a, label) < 0.8 ? 5 : 0);   // tall towers stay off the label too
      for (const f of from) s += Math.min(angDist(rest[i].a, f), 1.6);
      if (s > bs) { bs = s; best = i; }
    }
    if (best < 0) return normAngle(platform + (from.length > 1 ? -2.1 : 2.1));
    return rest.splice(best, 1)[0].a;
  };
  const t1 = pick([platform]);
  const t2 = pick([platform, t1]);
  return { platform, towers: [t1, t2] };
}
/** Buildings whose light is always lit (with a flicker), not only at night. */
const FLAMES: Record<string, { kind: FlameKind; tint: number; dy: number; scale: number }> = {
  b_shrine: { kind: 'shrine', tint: 0xc9a0ff, dy: -14, scale: 1.7 },
  b_tower: { kind: 'lantern', tint: 0xffe08a, dy: -34, scale: 1.4 },
  b_brazier: { kind: 'fire', tint: 0xff9a3a, dy: -9, scale: 1.3 },
  b_lantern_post: { kind: 'lantern', tint: 0xffd080, dy: -12, scale: 1.1 },
  b_site_gate: { kind: 'doorway', tint: 0x6fe0a0, dy: -12, scale: 3.2 },
  b_xr_tower: { kind: 'sweep', tint: CROSSROADS_LANTERN, dy: -36.4, scale: 1.5 },
};

export class SettlementsLayer {
  private views = new Map<string, SView>();
  private arcCursor = 0;
  private settings: RenderSettings;
  private railDirs = new Map<string, number[]>();
  private railAdj = new Map<string, string[]>();
  // hover
  private hoverId: string | null = null;
  private hoverBranch: Array<[number, number, number, number]> = [];
  private hoverGfx: Phaser.GameObjects.Graphics;
  private hoverGlow: Phaser.GameObjects.Image;
  private hoverChip: Phaser.GameObjects.Text;
  private lastOverlapAt = -1;
  private overlapDirty = true;
  /** Cinematics (the opening): hide the deadline countdown arcs; restored when cleared. */
  public hideArcs = false;
  private arcsHidden = false;

  constructor(private scene: Phaser.Scene, private layer: Phaser.GameObjects.Layer, private fx: FxLayer, settings: RenderSettings) {
    this.settings = settings;
    this.hoverGfx = scene.add.graphics();
    this.hoverGlow = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setAlpha(0);
    this.hoverChip = scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: '#ffffff', resolution: 2,
      backgroundColor: 'rgba(11,14,26,0.88)', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0.5).setVisible(false);
    this.hoverChip.setLetterSpacing(0.5);
    for (const o of [this.hoverGfx, this.hoverGlow, this.hoverChip]) { layer.add(o); o.setDepth(1e5); }
    this.hoverGlow.setDepth(1e5 - 1);
  }

  setSettings(s: RenderSettings): void { this.settings = s; }

  destroy(): void {
    for (const v of this.views.values()) this.destroyView(v);
    this.views.clear();
    this.hoverId = null; this.hoverBranch = [];
  }
  private destroyView(v: SView): void {
    v.ring.destroy(); v.core.destroy(); v.glyph.destroy(); v.check.destroy(); v.label.destroy(); v.arc.destroy();
    for (const b of v.buildings) { b.img.destroy(); b.shadow.destroy(); b.light?.destroy(); b.beam?.destroy(); }
    v.gateGlow?.destroy();
  }

  rebuild(state: SimState): void {
    this.destroy();
    // directions of rail links through each settlement tile (buildings avoid the track) + rail adjacency
    this.railDirs.clear();
    this.railAdj.clear();
    try {
      const links = state.route?.railLinks ?? [];
      for (const k of links) {
        const [a, b] = k.split('|');
        if (!a || !b) continue;
        (this.railAdj.get(a) ?? this.railAdj.set(a, []).get(a)!).push(b);
        (this.railAdj.get(b) ?? this.railAdj.set(b, []).get(b)!).push(a);
      }
      const linkSet = new Set(links);
      for (const s of state.settlements ?? []) {
        const dirs: number[] = [];
        const c = hexToWorld(s.col, s.row);
        for (const [nc, nr] of neighbors(s.col, s.row)) {
          const a = tileKey(s.col, s.row), b = tileKey(nc, nr);
          const k = a < b ? a + '|' + b : b + '|' + a;
          if (!linkSet.has(k)) continue;
          const n = hexToWorld(nc, nr);
          dirs.push(Math.atan2(n.y - c.y, n.x - c.x));
        }
        this.railDirs.set(s.id, dirs);
      }
    } catch { /* ignore */ }
    const list = Array.isArray(state.settlements) ? state.settlements : [];
    for (const s of list) {
      if (!s || typeof s.id !== 'string') continue;
      try { this.views.set(s.id, this.createView(s)); } catch (e) { console.warn('[render] settlement view failed', e); }
    }
    this.arcCursor = 0;
    this.overlapDirty = true;
    if (this.hoverId) this.computeBranch();
  }

  private createView(s: Settlement): SView {
    const c = hexCenterP(s.col, s.row);
    const x = c.x, y = c.y - 2;
    const type: SettlementType = CLUSTERS[s.type] ? s.type : 'village';
    const color = settlementColor(type);
    const [r, g, b] = rgb(color);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const seed = hashInt(s.col * 977 + s.row * 131 + 7);

    // ---- buildings ----
    const buildings: Building[] = [];
    const keys = CLUSTERS[type];
    const hub = type === 'crossroads';
    const count = hub ? keys.length : Math.min(keys.length, 2 + Math.floor(hashInt(seed * 1000 + 1) * 4)); // 2..5 (hubs: the full set)
    const rail = this.railDirs.get(s.id) ?? [];
    // rail directions a gate / gantry can straddle, steepest (most visibly "across") first
    const trackSlots = rail.slice().sort((p, q) => Math.abs(Math.sin(q)) - Math.abs(Math.sin(p)));
    const hubSl = hub ? hubSlots(rail) : null;
    let towers = 0;
    const slots: number[] = [];
    for (let i = 0; i < 12; i++) slots.push(-Math.PI + (i / 12) * Math.PI * 2);
    const ok = (a: number) => {
      // keep clear of the track and of the label below the marker
      for (const d of rail) { let dd = Math.abs(a - d); while (dd > Math.PI) dd = Math.abs(dd - Math.PI * 2); if (dd < 0.6) return false; }
      let dl = Math.abs(a - Math.PI / 2); while (dl > Math.PI) dl = Math.abs(dl - Math.PI * 2);
      return dl > 0.75;
    };
    const free = slots.filter(ok);
    // landmark prefers the north slot (a wreck lies beside the track instead: prefer a slot next to a rail direction)
    if (type === 'wreck' && rail.length) {
      const rd = rail[0];
      free.sort((p, q) => { let a = Math.abs(p - rd), b2 = Math.abs(q - rd); while (a > Math.PI) a = Math.abs(a - Math.PI * 2); while (b2 > Math.PI) b2 = Math.abs(b2 - Math.PI * 2); return a - b2; });
    } else {
      free.sort((p, q) => Math.abs(p + Math.PI / 2) - Math.abs(q + Math.PI / 2));
    }
    let placed = 0;
    for (let i = 0; i < keys.length && placed < count; i++) {
      const key = keys[i];
      if (!this.scene.textures.exists(key)) continue;
      let slot: number, rad: number;
      const onTrack = ON_TRACK.has(key) && trackSlots.length > 0;
      if (onTrack) {
        // toll gate / signal gantry stand across the track just outside the marker ring
        slot = trackSlots.shift()!;
        rad = key === 'b_xr_gate' ? 34 : 40;
      } else if (hubSl && key === 'b_xr_platform') {
        slot = hubSl.platform; rad = 23;
      } else if (hubSl && key === 'b_xr_tower') {
        // the two watchtowers sit in the widest remaining gaps between the rails
        slot = hubSl.towers[towers++ % 2]; rad = 30;
      } else {
        slot = free.length ? free[(i * 5 + Math.floor(hashInt(seed + i) * 3)) % free.length] : -Math.PI / 2;
        // spread used slots
        const idx = free.indexOf(slot); if (idx >= 0) free.splice(idx, 1);
        rad = (i === 0 ? 20 : 22 + hashInt(seed + i * 3) * 8);
      }
      const bx = x + Math.cos(slot) * rad, by = y + Math.sin(slot) * rad * ISO_Y + (onTrack ? 2 : 6);
      const scale = TEX_SCALE * (hub || i === 0 ? 1 : 0.8 + hashInt(seed + i * 7) * 0.25);
      const shadow = this.scene.add.image(bx + 2, by, 'b_shadow').setScale(scale * 1.05, scale).setAlpha(onTrack ? 0.3 : 0.45);
      const img = this.scene.add.image(bx, by, key).setOrigin(0.5, 1).setScale(scale);
      let light: Phaser.GameObjects.Image | null = null;
      let beam: Phaser.GameObjects.Image | null = null;
      let flame: FlameKind | null = null;
      const fl = FLAMES[key];
      if (fl) {
        flame = fl.kind;
        light = this.scene.add.image(bx, by + fl.dy * scale / TEX_SCALE, 'lantern').setBlendMode(Phaser.BlendModes.ADD).setScale(TEX_SCALE * fl.scale).setAlpha(0).setTint(fl.tint);
        if (fl.kind === 'sweep' && this.scene.textures.exists('xr_beam')) {
          // wedge with its apex on the lantern; rotated slowly back and forth at night
          beam = this.scene.add.image(light.x, light.y, 'xr_beam').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD)
            .setScale(TEX_SCALE * 1.9).setAlpha(0).setVisible(false).setTint(fl.tint);
        }
      } else if (HAS_WINDOW.has(key)) {
        light = this.scene.add.image(bx + (hashInt(seed + i * 11) - 0.5) * 6, by - 4 * scale / TEX_SCALE, 'lantern').setBlendMode(Phaser.BlendModes.ADD).setScale(TEX_SCALE * 1.6).setAlpha(0).setTint(0xffc870);
      }
      const chimney = HAS_CHIMNEY.has(key) ? { x: bx + 5 * scale / TEX_SCALE, y: by - 14 * scale / TEX_SCALE } : null;
      const depth = y - 30 + (by - y);
      this.layer.add(shadow); this.layer.add(img); shadow.setDepth(depth - 0.1); img.setDepth(depth);
      if (light) { this.layer.add(light); light.setDepth(depth + 0.05); }
      if (beam) { this.layer.add(beam); beam.setDepth(depth + 0.04); }
      buildings.push({ img, shadow, light, beam, flame, chimney, flicker: hashInt(seed + i * 13) * 6.28 });
      placed++;
    }
    let gateGlow: Phaser.GameObjects.Image | null = null;
    if (type === 'terminus' && buildings.length) {
      const lm = buildings[0];
      gateGlow = this.scene.add.image(lm.img.x, lm.img.y - 14, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8f7bff).setScale(1.4, 1).setAlpha(0.4);
      this.layer.add(gateGlow); gateGlow.setDepth(lm.img.depth - 0.02);
    }

    // ---- diagram marker (on top) ----
    const ring = this.scene.add.image(x, y, 'st_ring').setScale(TEX_SCALE);
    const core = this.scene.add.image(x, y, 'st_core').setScale(TEX_SCALE * 1.1).setTint(color);
    const glyphKey = this.scene.textures.exists('gl_' + type) ? 'gl_' + type : 'gl_village';
    const glyph = this.scene.add.image(x, y, glyphKey).setScale(TEX_SCALE * 0.95).setTint(lum > 0.62 ? 0x0b0e1a : 0xffffff);
    const check = this.scene.add.image(x, y, 'st_check').setScale(TEX_SCALE).setVisible(false);
    const label = this.scene.add.text(x, y + 19, String(s.name ?? '').toUpperCase(), {
      fontFamily: FONT, fontSize: '9px', color: '#e6e9f2', stroke: '#0b0e1a', strokeThickness: 3, resolution: 2,
    }).setOrigin(0.5, 0);
    label.setLetterSpacing(1);
    const arc = this.scene.add.graphics();
    for (const o of [arc, ring, core, glyph, check, label]) { this.layer.add(o); o.setDepth(y + 0.5); }
    arc.setDepth(y + 0.4);
    return {
      id: s.id, type, col: s.col, row: s.row, x, y, color, ring, core, glyph, check, label, arc, buildings, gateGlow, status: '', seed,
      hoverT: 0, labelOk: true, labelW: label.width, labelH: label.height,
    };
  }

  // ------------------------------------------------------------------ hover
  /** Set (or clear with null) the hovered settlement. Cheap when unchanged. */
  setHover(id: string | null): void {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.hoverBranch = [];
    if (id) this.computeBranch();
    this.overlapDirty = true;
  }
  getHover(): string | null { return this.hoverId; }

  /** Follow the pre-laid rail line from the hovered settlement until a junction / line end (max 16 edges). */
  private computeBranch(): void {
    const v = this.hoverId ? this.views.get(this.hoverId) : null;
    if (!v) return;
    const start = tileKey(v.col, v.row);
    const out: Array<[number, number, number, number]> = [];
    const seen = new Set<string>([start]);
    const first = this.railAdj.get(start) ?? [];
    for (const n0 of first) {
      let prev = start, cur = n0;
      for (let steps = 0; steps < 16; steps++) {
        const pa = safeParseKey(prev), pb = safeParseKey(cur);
        if (!pa || !pb) break;
        const a = hexCenterP(pa[0], pa[1]), b = hexCenterP(pb[0], pb[1]);
        out.push([a.x, a.y, b.x, b.y]);
        if (seen.has(cur)) break;
        seen.add(cur);
        const adj = this.railAdj.get(cur) ?? [];
        if (adj.length !== 2) break; // junction or line end
        const next = adj[0] === prev ? adj[1] : adj[0];
        prev = cur; cur = next;
      }
    }
    this.hoverBranch = out;
  }

  // ------------------------------------------------------------------ frame
  update(state: SimState, nowMs: number, zoom: number, reducedMotion: boolean, night: number, view: Phaser.Geom.Rectangle,
    loco: { x: number; y: number } | null = null, dt = 1 / 60): void {
    const list = Array.isArray(state.settlements) ? state.settlements : [];
    if (list.length !== this.views.size) { this.rebuild(state); this.arcsHidden = false; }
    if (this.hideArcs !== this.arcsHidden) {
      this.arcsHidden = this.hideArcs;
      for (const v of this.views.values()) v.arc.setVisible(!this.arcsHidden);
    }
    const labelsAll = zoom >= LABEL_LOD_ZOOM;
    const slice = Math.max(1, Math.ceil(list.length / 15));
    const arcStart = this.arcCursor;
    const arcEnd = arcStart + slice;
    this.arcCursor = arcEnd >= list.length ? 0 : arcEnd;
    const blink = reducedMotion ? 1 : (Math.floor(nowMs / 300) % 2 === 0 ? 1 : 0.35);
    const tSec = nowMs / 1000;
    const x0 = view.x - 60, x1 = view.right + 60, y0 = view.y - 60, y1 = view.bottom + 60;
    const gateOpen = !!state.boss?.gateOpen;
    const dtGuess = 1 / 60;
    const hoverK = reducedMotion ? 1 : expFactor(18, dt);
    const overlapPass = this.overlapDirty || nowMs - this.lastOverlapAt > LABEL_OVERLAP_MS;
    if (overlapPass) { this.lastOverlapAt = nowMs; this.overlapDirty = false; }
    const candidates: SView[] = [];

    for (let li = 0; li < list.length; li++) {
      const s = list[li];
      const v = this.views.get(s.id);
      if (!v) continue;
      const doArcs = li >= arcStart && li < arcEnd;
      const hovered = v.id === this.hoverId;
      const status = s.consumed ? 'consumed' : s.visited ? 'visited' : 'open';
      if (status !== v.status) {
        v.status = status;
        if (status === 'consumed') {
          v.ring.setTint(0x3a3f4a).setAlpha(0.6); v.core.setTint(0x2a2f3a).setAlpha(0.7); v.glyph.setAlpha(0.35); v.check.setVisible(false);
          v.arc.clear();
          for (const b of v.buildings) { b.img.setTint(0x2a2438).setAlpha(0.5); b.shadow.setAlpha(0.15); b.light?.setVisible(false); b.beam?.setVisible(false); }
          v.gateGlow?.setVisible(false);
        } else if (status === 'visited') {
          v.ring.clearTint().setAlpha(1); v.core.setTint(v.color).setAlpha(1); v.glyph.setAlpha(0.9); v.check.setVisible(false);
          v.ring.setTint(0xbfe8c4); v.arc.clear();
        } else {
          v.ring.clearTint().setAlpha(1); v.core.setTint(v.color).setAlpha(1); v.glyph.setAlpha(1); v.check.setVisible(false);
        }
        this.overlapDirty = true;
      }
      if (status === 'visited') v.check.setVisible(true).setPosition(v.x + 12, v.y - 10).setScale(TEX_SCALE * 0.7);

      // hover factor (smoothed)
      const target = hovered ? 1 : 0;
      if (Math.abs(v.hoverT - target) > 0.001) v.hoverT += (target - v.hoverT) * hoverK; else v.hoverT = target;
      const ht = v.hoverT;
      if (ht > 0.001 || v.ring.scaleX !== TEX_SCALE) {
        const sc = TEX_SCALE * (1 + 0.12 * ht);
        v.ring.setScale(sc); v.core.setScale(TEX_SCALE * 1.1 * (1 + 0.08 * ht)); v.glyph.setScale(TEX_SCALE * 0.95 * (1 + 0.08 * ht));
        if (status !== 'consumed') v.ring.setTint(ht > 0.5 ? 0xffffff : status === 'visited' ? 0xbfe8c4 : 0xffffff);
      }

      const inView = v.x > x0 && v.x < x1 && v.y > y0 && v.y < y1;

      // ---- label LOD + priority ----
      const important = s.visited || s.passengers > 0 || v.type === 'yard';
      const wantLabel = hovered || (inView && (labelsAll || important) && zoom >= 0.5);
      if (wantLabel) candidates.push(v);
      else v.label.setVisible(false);
      if (wantLabel) {
        const base = status === 'consumed' ? 0.3 : status === 'visited' ? 0.8 : 1;
        v.label.setAlpha(Math.min(1, base + ht * 0.5));
        const col = ht > 0.5 ? '#ffffff' : '#e6e9f2';
        if (v.label.getData('col') !== col) { v.label.setColor(col); v.label.setData('col', col); }
        v.label.setScale(1 + 0.08 * ht);
      }

      // window lights + chimney smoke (only when in view)
      if (status !== 'consumed' && inView) {
        for (const b of v.buildings) {
          if (b.light) {
            if (b.flame) {
              const f = reducedMotion ? 0.9 : 0.75 + 0.25 * Math.sin(tSec * 9 + b.flicker) * Math.sin(tSec * 3.1 + b.flicker * 2);
              const a = (b.flame === 'lantern' ? 0.45 + night * 0.45 : 0.7) * f;
              b.light.setVisible(true).setAlpha(a);
              if (b.flame === 'shrine') {
                // violet/gold flame: tint oscillates between the two
                const m = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tSec * 2.2 + b.flicker);
                b.light.setTint(m > 0.5 ? 0xc9a0ff : 0xffd080);
                if (this.settings.quality !== 'low' && Math.random() < dtGuess * 1.2 * this.settings.particleMul) this.fx.glowPuffP(b.light.x + (Math.random() - 0.5) * 4, b.light.y - 2, m > 0.5 ? 0xc9a0ff : 0xffd080, 4, 700);
              } else if (b.flame === 'sweep') {
                // hub watchtower: steady lantern by day; at night a slow beam sweeps the ground below the tower
                b.light.setAlpha((0.35 + night * 0.55) * f);
                if (b.beam) {
                  if (night > 0.05) {
                    const ang = Math.PI / 2 + (reducedMotion ? 0.35 : Math.sin(tSec * 0.42 + b.flicker) * 1.05);
                    b.beam.setVisible(true).setRotation(ang).setAlpha(night * 0.95 * (0.8 + 0.2 * f));
                  } else b.beam.setVisible(false);
                }
              } else if (b.flame === 'fire' && this.settings.quality !== 'low' && Math.random() < dtGuess * 0.6 * this.settings.particleMul) {
                this.fx.smokeP(b.light.x, b.light.y - 4, 1, 0x6a6672);
              } else if (b.flame === 'doorway') {
                // expedition site: slow green breathing light in the doorway + drifting motes; dims once explored
                const breathe = reducedMotion ? 0.8 : 0.7 + 0.3 * Math.sin(tSec * 1.4 + b.flicker);
                const explored = s.visited ? 0.45 : 1;
                b.light.setAlpha((0.62 + night * 0.3) * breathe * explored).setScale(TEX_SCALE * 3.2 * (0.92 + 0.16 * breathe), TEX_SCALE * 3.6 * (0.92 + 0.16 * breathe));
                if (this.settings.quality !== 'low' && Math.random() < dtGuess * 2.6 * explored * this.settings.particleMul) {
                  this.fx.moteP(b.light.x + (Math.random() - 0.5) * 16, b.light.y + 6 + Math.random() * 6, Math.random() < 0.7 ? 0x8fffc0 : 0xd8ffe8, 1.4 + Math.random() * 0.8, 1400 + Math.random() * 900, (Math.random() - 0.5) * 7, -6 - Math.random() * 6);
                }
              }
            } else if (night > 0.05) {
              const f = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(tSec * 7 + b.flicker) * Math.sin(tSec * 2.3 + b.flicker * 2);
              b.light.setVisible(true).setAlpha(night * 0.7 * f);
            } else b.light.setVisible(false);
          }
          if (b.chimney && this.settings.quality !== 'low' && Math.random() < dtGuess * 0.35 * this.settings.particleMul) {
            this.fx.smokeP(b.chimney.x, b.chimney.y, 1, 0xb8bcc8);
          }
        }
        if (v.gateGlow) {
          const p = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(tSec * 1.8);
          v.gateGlow.setVisible(true).setTint(gateOpen ? 0xffd070 : 0x8f7bff).setAlpha(gateOpen ? 0.55 + 0.25 * p : 0.3 + 0.3 * p).setScale(1.4 + p * 0.2, 1 + p * 0.15);
          if (this.settings.quality === 'high' && Math.random() < dtGuess * 3) this.fx.glowPuffP(v.gateGlow.x + (Math.random() - 0.5) * 30, v.gateGlow.y + 10, gateOpen ? 0xffd070 : 0x8f7bff, 5, 900);
        }
      } else {
        for (const b of v.buildings) { b.light?.setVisible(false); b.beam?.setVisible(false); }
      }

      if (status !== 'open' || !doArcs) continue;
      const remaining = (Number.isFinite(s.deadline) ? s.deadline : 1e9) - (state.time || 0);
      const g = v.arc;
      g.clear();
      const R = 17;
      if (remaining > DEADLINE_WINDOW) {
        g.lineStyle(1.5, 0xffffff, 0.18);
        g.strokeCircle(v.x, v.y, R);
        continue;
      }
      const frac = Math.max(0, Math.min(1, remaining / DEADLINE_WINDOW));
      const color = frac > 0.5 ? 0x6fbf73 : frac > 0.25 ? 0xe8c170 : 0xe86f6f;
      const alpha = remaining < 45 ? blink : 0.95;
      g.lineStyle(1.5, 0xffffff, 0.12);
      g.strokeCircle(v.x, v.y, R);
      g.lineStyle(3, color, alpha);
      g.beginPath();
      g.arc(v.x, v.y, R, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
      g.strokePath();
      if (remaining < 60) {
        // pulsing red ring: the void is about to take it
        const p = reducedMotion ? 0.7 : 0.5 + 0.5 * Math.sin(tSec * 5);
        g.lineStyle(2.5, 0xff4040, 0.35 + 0.55 * p);
        g.strokeCircle(v.x, v.y, R + 5 + p * 3);
        g.lineStyle(1, 0xff8080, 0.3 * p);
        g.strokeCircle(v.x, v.y, R + 11 + p * 4);
      }
    }

    // ---- label overlap (greedy, every 250 ms) ----
    if (overlapPass) {
      const prio = (v: SView) => (v.id === this.hoverId ? 0 : v.status === 'visited' ? 2 : v.status === 'consumed' ? 4 : v.type === 'yard' ? 1 : 3);
      candidates.sort((a, b) => prio(a) - prio(b) || a.y - b.y);
      const taken: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
      for (const v of candidates) {
        const w = v.labelW + 4, h = v.labelH + 2;
        const r = { x0: v.x - w / 2, y0: v.y + 19, x1: v.x + w / 2, y1: v.y + 19 + h };
        let ok = true;
        for (const t of taken) { if (r.x0 < t.x1 && r.x1 > t.x0 && r.y0 < t.y1 && r.y1 > t.y0) { ok = false; break; } }
        v.labelOk = ok;
        if (ok) taken.push(r);
      }
    }
    for (const v of candidates) v.label.setVisible(v.labelOk);

    this.drawHover(state, nowMs, reducedMotion, loco);
  }

  /** Glow, dotted loco→settlement guide with a hex-distance chip, and the highlighted rail branch. */
  private drawHover(state: SimState, nowMs: number, reducedMotion: boolean, loco: { x: number; y: number } | null): void {
    const g = this.hoverGfx;
    const v = this.hoverId ? this.views.get(this.hoverId) : null;
    // any view still fading out keeps the glow alive briefly
    let fading: SView | null = null;
    if (!v) for (const o of this.views.values()) { if (o.hoverT > 0.01) { fading = o; break; } }
    const target = v ?? fading;
    if (!target || target.hoverT < 0.005) {
      g.clear();
      this.hoverGlow.setVisible(false);
      this.hoverChip.setVisible(false);
      return;
    }
    const ht = target.hoverT;
    const pulse = reducedMotion ? 0.8 : 0.75 + 0.25 * Math.sin(nowMs / 260);
    this.hoverGlow.setVisible(true).setPosition(target.x, target.y).setTint(target.color).setAlpha(0.55 * ht * pulse).setScale(0.62 + 0.06 * pulse, (0.62 + 0.06 * pulse) * ISO_Y + 0.12);
    g.clear();
    // outer highlight ring
    g.lineStyle(1.5, 0xffffff, 0.55 * ht);
    g.strokeCircle(target.x, target.y, 19 + 2 * pulse);
    if (!v || !loco) { this.hoverChip.setVisible(false); return; }
    // rail branch leading there
    if (this.hoverBranch.length) {
      g.lineStyle(6, target.color, 0.16 * ht);
      for (const [ax, ay, bx, by] of this.hoverBranch) g.lineBetween(ax, ay, bx, by);
      g.lineStyle(2, target.color, 0.75 * ht);
      for (const [ax, ay, bx, by] of this.hoverBranch) g.lineBetween(ax, ay, bx, by);
    }
    // dotted guide line from the locomotive
    const lx = loco.x, ly = loco.y * ISO_Y;
    const dx = target.x - lx, dy = target.y - ly;
    const len = Math.hypot(dx, dy);
    if (len > 24) {
      const ux = dx / len, uy = dy / len;
      const step = 9;
      const off = reducedMotion ? 0 : (nowMs / 40) % step;
      g.fillStyle(0xffffff, 0.6 * ht);
      const s0 = 16 + off, s1 = len - 20;
      for (let s = s0; s < s1; s += step) {
        const x = lx + ux * s, y = ly + uy * s;
        g.fillRect(x - 1.1, y - 1.1, 2.2, 2.2);
      }
      g.fillStyle(target.color, 0.9 * ht);
      g.fillCircle(lx + ux * 14, ly + uy * 14, 2);
    }
    // hex-distance chip near the midpoint (offset to the side of the line)
    const [lc, lr] = worldToHex(loco.x, loco.y);
    const hd = hexDistance(lc, lr, target.col, target.row);
    const txt = hd === 1 ? '1 hex' : `${hd} hex`;
    if (this.hoverChip.text !== txt) this.hoverChip.setText(txt);
    const mx = (lx + target.x) / 2, my = (ly + target.y) / 2;
    const nx = len > 1 ? -dy / len : 0, ny = len > 1 ? dx / len : -1;
    const chipVisible = len > 60;
    this.hoverChip.setVisible(chipVisible).setPosition(mx + nx * 12, my + ny * 12 - 4).setAlpha(clamp(ht, 0, 1));
    void state;
  }

  // ------------------------------------------------------------------ queries
  /** Nearest settlement within radius (world px, projected). */
  hitTest(px: number, py: number, radius: number): string | null {
    let best: string | null = null, bd = radius;
    for (const v of this.views.values()) {
      const d = dist(px, py, v.x, v.y);
      if (d < bd) { bd = d; best = v.id; }
    }
    return best;
  }

  /**
   * Generous hover hit test: the marker ring (r≈20 world px, or `minRadius` if larger) plus the
   * visible label's rectangle. Returns the closest match.
   */
  hoverHitTest(px: number, py: number, minRadius = HOVER_RADIUS): string | null {
    const rad = Math.max(HOVER_RADIUS, minRadius);
    let best: string | null = null, bd = Infinity;
    for (const v of this.views.values()) {
      const d = dist(px, py, v.x, v.y);
      let hit = d < rad;
      if (!hit && v.label.visible) {
        const w = v.labelW * v.label.scaleX + 6, h = v.labelH * v.label.scaleY + 4;
        if (px >= v.x - w / 2 && px <= v.x + w / 2 && py >= v.y + 17 && py <= v.y + 19 + h) hit = true;
      }
      if (hit && d < bd) { bd = d; best = v.id; }
    }
    return best;
  }

  positionOf(id: string): { x: number; y: number } | null {
    const v = this.views.get(id);
    return v ? { x: v.x, y: v.y } : null;
  }
}
