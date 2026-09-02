/**
 * Loot drops: pooled views for `state.loot` (unprojected sim px → projected on placement).
 * Each drop is a ground shadow (shadow layer) + a small salvage sprite per kind (world layer,
 * y-sorted) + an additive glint. Drops bounce in when they appear, bob gently, glint every few
 * seconds, fade + shrink over the last 5 s of `ttl`, and on 'loot:pickup' are sucked into the
 * nearest car with a small burst. Budget: at most LOOT.maxDrops (40) drops, three images each.
 */
import Phaser from 'phaser';
import type { SimState, LootDrop } from '../core/types';
import { ISO_Y } from '../core/config';
import type { FxLayer } from './fxLayer';
import type { RenderSettings } from './settings';
import { TEX_SCALE } from './textures';
import { RESOURCE_COLORS } from './palette';
import { clamp, smoothstep } from './util';

type Kind = LootDrop['kind'];

interface LView {
  id: string;
  kind: Kind;
  shadow: Phaser.GameObjects.Image;
  body: Phaser.GameObjects.Image;
  glint: Phaser.GameObjects.Image;
  x: number; y: number;        // unprojected
  bornMs: number;
  phase: number;               // bob / glint phase offset
  ttl: number;
  pick: { t0: number; car: number; fromX: number; fromY: number; burst: boolean } | null; // projected start
  expired: boolean;
}

const MAX_DROPS = 40;
const FADE_S = 5;              // last seconds of ttl that fade + shrink
const BOUNCE_MS = 520;
const PICK_MS = 380;
const GLINT_PERIOD = 2.6;      // seconds
const BODY_SCALE = TEX_SCALE * 1.15;   // a touch larger than texture-native so drops read at zoom 1
const TEX: Record<Kind, string> = { scrap: 'loot_scrap', ammo: 'loot_ammo', rails: 'loot_rails', marks: 'loot_marks' };
export const LOOT_COLORS: Record<Kind, number> = { scrap: RESOURCE_COLORS.scrap, ammo: 0x8fd86a, rails: RESOURCE_COLORS.rails, marks: 0xc9a0ff };
const SHADOW_SCALE: Record<Kind, number> = { scrap: 0.42, ammo: 0.36, rails: 0.5, marks: 0.3 };

export class LootLayer {
  private views = new Map<string, LView>();
  private picking: LView[] = [];
  private pool: LView[] = [];
  private settings: RenderSettings;
  private now = 0;

  /**
   * @param carPos projected (screen-world) position of car i, or null
   * @param carCount number of cars in the current train
   */
  constructor(private scene: Phaser.Scene, private world: Phaser.GameObjects.Layer, private shadows: Phaser.GameObjects.Layer,
    private fx: FxLayer, settings: RenderSettings,
    private carPos: (i: number) => { x: number; y: number } | null, private carCount: () => number) {
    this.settings = settings;
  }

  setSettings(s: RenderSettings): void { this.settings = s; }

  destroy(): void {
    for (const v of this.views.values()) this.destroyView(v);
    for (const v of this.picking) this.destroyView(v);
    for (const v of this.pool) this.destroyView(v);
    this.views.clear(); this.picking = []; this.pool = [];
  }
  private destroyView(v: LView): void { v.shadow.destroy(); v.body.destroy(); v.glint.destroy(); }

  clear(): void {
    for (const v of this.views.values()) this.release(v);
    for (const v of this.picking) this.release(v);
    this.views.clear(); this.picking = [];
  }

  get count(): number { return this.views.size + this.picking.length; }

  // ---------------- pool ----------------
  private acquire(d: LootDrop, nowMs: number): LView {
    const kind: Kind = TEX[d.kind] ? d.kind : 'scrap';
    let v = this.pool.pop();
    if (!v) {
      const shadow = this.scene.add.image(0, 0, 'shadow').setAlpha(0.32);
      const body = this.scene.add.image(0, 0, TEX[kind]).setOrigin(0.5, 0.9);
      const glint = this.scene.add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(TEX_SCALE * 0.9);
      this.shadows.add(shadow); this.world.add(body); this.world.add(glint);
      v = { id: '', kind, shadow, body, glint, x: 0, y: 0, bornMs: 0, phase: 0, ttl: 0, pick: null, expired: false };
    }
    v.id = d.id; v.kind = kind; v.x = d.x; v.y = d.y; v.bornMs = nowMs; v.phase = Math.random() * 6.283; v.ttl = d.ttl; v.pick = null; v.expired = false;
    v.body.setTexture(TEX[kind]).setVisible(true).setAlpha(1).setScale(TEX_SCALE).clearTint();
    v.shadow.setVisible(true).setAlpha(0.32).setScale(TEX_SCALE * SHADOW_SCALE[kind] * 2, TEX_SCALE * SHADOW_SCALE[kind] * 2 * ISO_Y);
    v.glint.setVisible(true).setAlpha(0).setTint(kind === 'marks' ? 0xe8d0ff : 0xffffff);
    return v;
  }
  private release(v: LView): void {
    v.body.setVisible(false); v.shadow.setVisible(false); v.glint.setVisible(false);
    v.pick = null;
    if (this.pool.length < MAX_DROPS + 8) this.pool.push(v); else this.destroyView(v);
  }

  // ---------------- events ----------------
  /** Sim event: a drop appeared (the bounce-in itself keys off first sight in update()). */
  onDrop(id: string, kind: Kind, x: number, y: number): void {
    void id;
    if (this.settings.quality === 'low') return;
    this.fx.puff(x, y, 0x9a8a78, 7);
    this.fx.sparks(x, y, 3, LOOT_COLORS[kind] ?? 0xffffff);
  }

  /** Sim event: a drop was collected — suck it into the nearest car and pop. */
  onPickup(id: string, kind: Kind, x: number, y: number): void {
    const v = this.views.get(id);
    const color = LOOT_COLORS[kind] ?? 0xffffff;
    if (!v) { this.fx.sparks(x, y, 4, color); return; }
    this.views.delete(id);
    const car = this.nearestCar(v.x, v.y * ISO_Y);
    const bob = this.bobY(v);
    v.pick = { t0: this.now, car, fromX: v.x, fromY: v.y * ISO_Y - bob, burst: false };
    v.shadow.setVisible(false);
    v.glint.setVisible(false);
    this.picking.push(v);
    if (this.settings.reducedMotion || car < 0) this.finishPick(v, color);
  }

  /** Sim event: a drop timed out (it has already faded to nothing). */
  onExpire(id: string): void {
    const v = this.views.get(id);
    if (!v) return;
    v.expired = true;
    if (this.settings.quality !== 'low') this.fx.puff(v.x, v.y, 0x6a6672, 6);
    this.views.delete(id);
    this.release(v);
  }

  private nearestCar(px: number, py: number): number {
    let best = -1, bd = Infinity;
    const n = this.carCount();
    for (let i = 0; i < n; i++) {
      const c = this.carPos(i);
      if (!c) continue;
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  private finishPick(v: LView, color: number): void {
    const c = v.pick && v.pick.car >= 0 ? this.carPos(v.pick.car) : null;
    const px = c ? c.x : v.x, py = c ? c.y - 8 : v.y * ISO_Y - 8;
    this.fx.sparksP(px, py, this.settings.quality === 'low' ? 3 : 6, color);
    if (this.settings.glow) this.fx.lightP(px, py, color, 22, 140);
    if (this.settings.quality !== 'low') this.fx.glowPuffP(px, py, color, 9, 260);
    const i = this.picking.indexOf(v);
    if (i >= 0) this.picking.splice(i, 1);
    this.release(v);
  }

  // ---------------- per-frame ----------------
  private bobY(v: LView): number {
    if (this.settings.reducedMotion) return 0;
    return 1.2 + Math.sin(this.now / 1000 * 2.1 + v.phase) * 1.6;
  }

  update(state: SimState, dt: number, nowMs: number): void {
    this.now = nowMs;
    const list = Array.isArray(state.loot) ? state.loot : [];
    const rm = this.settings.reducedMotion;
    const seen = new Set<string>();
    const n = Math.min(list.length, MAX_DROPS);
    for (let i = 0; i < n; i++) {
      const d = list[i];
      if (!d || typeof d.id !== 'string' || !Number.isFinite(d.x) || !Number.isFinite(d.y)) continue;
      seen.add(d.id);
      let v = this.views.get(d.id);
      if (!v) { v = this.acquire(d, nowMs); this.views.set(d.id, v); }
      v.ttl = Number.isFinite(d.ttl) ? d.ttl : 1e9;
      this.place(v, rm);
    }
    // views whose drop vanished from the state without an event: treat as a pickup (or expiry if it had faded out)
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      if (v.ttl <= 0.35) this.onExpire(id);
      else this.onPickup(id, v.kind, v.x, v.y);
    }
    // pickup animations
    for (let i = this.picking.length - 1; i >= 0; i--) {
      const v = this.picking[i];
      const p = v.pick;
      if (!p) { this.picking.splice(i, 1); this.release(v); continue; }
      const t = clamp((nowMs - p.t0) / PICK_MS, 0, 1);
      const color = LOOT_COLORS[v.kind] ?? 0xffffff;
      if (t >= 1) { this.finishPick(v, color); continue; }
      const c = this.carPos(p.car);
      const tx = c ? c.x : p.fromX, ty = c ? c.y - 8 : p.fromY - 20;
      const k = t * t * (0.6 + 0.4 * t);            // ease-in: hangs, then snaps in
      const lift = Math.sin(t * Math.PI) * 14;       // small arc
      const x = p.fromX + (tx - p.fromX) * k, y = p.fromY + (ty - p.fromY) * k - lift;
      const sc = BODY_SCALE * (1.1 - 0.75 * k);
      v.body.setPosition(x, y).setScale(sc).setAlpha(1 - 0.35 * k).setDepth(y + 20);
      if (this.settings.quality === 'high' && Math.random() < dt * 30) this.fx.glowPuffP(x, y, color, 4, 220);
    }
    void dt;
  }

  private place(v: LView, rm: boolean): void {
    const px = v.x, py = v.y * ISO_Y;
    // bounce-in
    let h = 0, pop = 1, squash = 0;
    const age = this.now - v.bornMs;
    if (!rm && age < BOUNCE_MS) {
      const t = age / BOUNCE_MS;
      const decay = Math.pow(1 - t, 1.25);
      h = 24 * Math.abs(Math.cos(t * Math.PI * 1.5)) * decay;
      pop = Math.min(1, 0.4 + t * 2.4);
      squash = h < 2 ? (1 - h / 2) * 0.22 * decay : 0;
    }
    // fade + shrink over the final seconds
    const fade = clamp(v.ttl / FADE_S, 0, 1);
    const alpha = fade < 1 ? 0.15 + 0.85 * smoothstep(fade) : 1;
    const size = fade < 1 ? 0.55 + 0.45 * fade : 1;
    const blink = fade < 1 && !rm && fade < 0.45 ? (Math.floor(this.now / 160) % 2 ? 0.55 : 1) : 1;
    const bob = age < BOUNCE_MS ? 0 : this.bobY(v);
    const s = BODY_SCALE * pop * size;
    v.body.setPosition(px, py - h - bob).setScale(s * (1 + squash), s * (1 - squash)).setAlpha(alpha * blink).setDepth(py);
    const near = 1 - clamp((h + bob) / 30, 0, 0.7);
    v.shadow.setPosition(px, py + 1).setAlpha(0.32 * alpha * near).setScale(TEX_SCALE * SHADOW_SCALE[v.kind] * 2 * size * (0.8 + 0.2 * near), TEX_SCALE * SHADOW_SCALE[v.kind] * 2 * ISO_Y * size);
    // glint: a short sparkle every few seconds (phase-offset per drop)
    if (rm || this.settings.quality === 'low') { v.glint.setAlpha(0); return; }
    const cyc = ((this.now / 1000 + v.phase) % GLINT_PERIOD) / GLINT_PERIOD;
    const g = cyc < 0.16 ? Math.sin((cyc / 0.16) * Math.PI) : 0;
    if (g > 0.01) {
      v.glint.setPosition(px + 3, py - h - bob - 9).setAlpha(g * alpha).setScale(TEX_SCALE * (0.6 + g * 0.9)).setRotation(cyc * 4).setDepth(py + 0.1);
    } else v.glint.setAlpha(0);
  }
}
