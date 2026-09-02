/**
 * The train: each car is an isometric box (projected roof + extruded sides + wheels) drawn into
 * its own Graphics every frame (10 cars = a few hundred fill ops), rotated by the trail angle and
 * y-sorted with enemies. Type-specific detail, heat glow, fire, boarders, health bars, selection
 * ring, headlight at night, chimney smoke, wheel sparks and detached ghosts.
 */
import Phaser from 'phaser';
import type { SimState, Car, CarType, TrainState } from '../core/types';
import { CAR_DEFS } from '../core/cars';
import { ISO_Y } from '../core/config';
import type { FxLayer } from './fxLayer';
import type { RenderSettings } from './settings';
import { TEX_SCALE } from './textures';
import { FONT } from './palette';
import { projAngle, lerpAngle, expFactor, shade, lighten, mixColor, clamp, hashInt, disc } from './util';

interface CarView {
  gfx: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image | null;
  x: number; y: number; a: number;   // smoothed unprojected
  init: boolean;
  type: CarType | null;
  fireAcc: number;
  hoverT: number;
}
interface Snap { type: CarType; x: number; y: number; a: number; }
interface Ghost { type: CarType; x: number; y: number; a: number; t0: number; }

const GHOST_LIFE = 20000;

export class TrainLayer {
  private views: CarView[] = [];
  private ghosts: Ghost[] = [];
  private ghostGfx: Phaser.GameObjects.Graphics;
  private snapshot: Snap[] = [];
  private settings: RenderSettings;
  private smokeAcc = 0;
  private sparkTimer = 0;
  private prevSpeed = 0;
  private nowMs = 0;
  private nightF = 0;
  private wheelPhase = 0;
  private brakeGlow = 0;
  private reversing = false;
  private enemyPos = new Map<string, { x: number; y: number }>();

  constructor(private scene: Phaser.Scene, private layer: Phaser.GameObjects.Layer, private fx: FxLayer, settings: RenderSettings) {
    this.settings = settings;
    this.ghostGfx = scene.add.graphics();
    layer.add(this.ghostGfx);
  }

  setSettings(s: RenderSettings): void { this.settings = s; }

  destroy(): void {
    for (const v of this.views) this.destroyView(v);
    this.views = [];
    this.ghostGfx.destroy();
  }
  private destroyView(v: CarView): void { v.gfx.destroy(); v.label.destroy(); v.glow.destroy(); v.head?.destroy(); }

  reset(): void {
    for (const v of this.views) v.init = false;
    this.ghosts = [];
    this.snapshot = [];
    this.smokeAcc = 0; this.sparkTimer = 0; this.prevSpeed = 0;
  }

  private createView(): CarView {
    const gfx = this.scene.add.graphics();
    const label = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '7px', fontStyle: 'bold', color: '#ffffff', stroke: '#0b0e1a', strokeThickness: 2, resolution: 3 }).setOrigin(0.5, 0.5);
    label.setLetterSpacing(0.5);
    const glow = this.scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7a30).setAlpha(0).setScale(0.9, 0.7);
    this.layer.add(gfx); this.layer.add(label); this.layer.add(glow);
    return { gfx, label, glow, head: null, x: 0, y: 0, a: 0, init: false, type: null, fireAcc: 0, hoverT: 0 };
  }

  /** Projected position of car i (smoothed), or null. */
  carPos(i: number): { x: number; y: number } | null {
    const v = this.views[i];
    if (!v || !v.init) return null;
    return { x: v.x, y: v.y * ISO_Y };
  }

  /** Nearest car index to a projected world point within radius, or -1. */
  hitTest(px: number, py: number, radius: number): number {
    let best = -1, bd = radius;
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i];
      if (!v.init || !v.gfx.visible) continue;
      const d = Math.hypot(px - v.x, py - (v.y * ISO_Y - 6));
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  onDetach(count: number): void {
    const n = Math.max(0, Math.min(count | 0, this.snapshot.length));
    if (n === 0) return;
    const dropped = this.snapshot.slice(this.snapshot.length - n);
    for (const s of dropped) this.ghosts.push({ ...s, t0: this.nowMs });
    if (dropped.length) {
      const d = dropped[0];
      this.fx.sparks(d.x, d.y, 10, 0xffe8a0);
      this.fx.puff(d.x, d.y, 0xd8d8e0, 14);
    }
  }

  onDestroyed(x: number, y: number, explode: boolean): void {
    this.fx.explosion(x, y, explode ? 90 : 42, explode);
  }

  update(state: SimState, dt: number, nowMs: number, selected: number, night: number, zoom: number, enemies: Map<string, { x: number; y: number }>, hovered = -1): void {
    this.nowMs = nowMs;
    this.nightF = night;
    this.enemyPos = enemies;
    const t = state.train;
    const cars = t?.cars ?? [];
    // pool views
    while (this.views.length < cars.length) this.views.push(this.createView());
    for (let i = cars.length; i < this.views.length; i++) {
      const v = this.views[i];
      v.gfx.setVisible(false); v.label.setVisible(false); v.glow.setVisible(false); v.head?.setVisible(false);
      v.init = false;
    }
    const k = expFactor(24, dt);
    const showLabels = zoom >= 0.6;
    this.reversing = !!(t as { reversing?: boolean } | undefined)?.reversing;
    // wheel spin follows distance; reverse the spin direction while backing down the track
    this.wheelPhase = ((t?.distanceTravelled || 0) * 59 / 2.7) % (Math.PI * 2) * (this.reversing ? -1 : 1);
    this.brakeGlow = this.sparkTimer > 0 ? 1 : 0;
    const pulse = this.settings.reducedMotion ? 0.7 : 0.5 + 0.5 * Math.sin(nowMs / 160);
    const snap: Snap[] = [];
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const v = this.views[i];
      const tx = t.trailX?.[i], ty = t.trailY?.[i], ta = t.trailAngle?.[i];
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) { v.gfx.setVisible(false); v.label.setVisible(false); v.glow.setVisible(false); continue; }
      const ang = Number.isFinite(ta) ? ta : 0;
      if (!v.init || Math.hypot(tx - v.x, ty - v.y) > 200) { v.x = tx; v.y = ty; v.a = ang; v.init = true; }
      else { v.x += (tx - v.x) * k; v.y += (ty - v.y) * k; v.a = lerpAngle(v.a, ang, k); }
      v.type = car.type;
      snap.push({ type: car.type, x: v.x, y: v.y, a: v.a });
      const cx = v.x, cyBase = v.y * ISO_Y;
      // hovered car lifts 2 px (smoothed) and gets a gold outline
      const hv = i === hovered ? 1 : 0;
      v.hoverT = this.settings.reducedMotion ? hv : v.hoverT + (hv - v.hoverT) * expFactor(20, dt);
      const lift = v.hoverT * 2;
      const cy = cyBase - lift;
      v.gfx.setVisible(true).setDepth(cyBase);
      v.gfx.clear();
      const def = CAR_DEFS[car.type] ?? CAR_DEFS.coach;
      const nv = this.views[i + 1];
      const next = i + 1 < cars.length && nv && nv.init ? { x: nv.x, y: nv.y, a: nv.a } : null;
      this.drawCar(v.gfx, cx, cy, v.a, car.type, car, 1, i === selected ? pulse : -1, def.color, i, next, v.hoverT);
      if (this.reversing && i === cars.length - 1) this.drawRearLanterns(v.gfx, cx, cy, v.a, car.type === 'locomotive' ? 34 : 30, nowMs);
      // label
      v.label.setVisible(showLabels).setText(def.short).setDepth(cyBase + 0.1);
      const pa = projAngle(v.a);
      let la = pa;
      if (Math.cos(pa) < 0) la += Math.PI;
      v.label.setPosition(cx, cy - 9).setRotation(la);
      // heat glow
      const heat = clamp(car.heat || 0, 0, 120);
      if (this.settings.glow && heat > 40) {
        const h = Math.pow((heat - 40) / 80, 1.3);
        // heat shimmer: the additive glow breathes and wobbles with the heat level
        const sh = this.settings.reducedMotion ? 0 : Math.sin(nowMs / 90 + i) * 0.08 * h + Math.sin(nowMs / 37 + i * 2) * 0.04 * h;
        v.glow.setVisible(true).setPosition(cx + sh * 20, cy - 8 - sh * 10).setAlpha(h * 0.75 + sh)
          .setScale(0.9 + sh * 2 + h * 0.25, 0.7 + h * 0.2 - sh).setDepth(cy + 0.2);
        if (heat > 90 && Math.random() < dt * 6 * this.settings.particleMul) this.fx.glowPuffP(cx + (Math.random() - 0.5) * 24, cy - 12, 0xff7a30, 6, 500);
      } else v.glow.setVisible(false);
      // fire
      if (car.onFire) {
        v.fireAcc += dt * 12 * this.settings.particleMul;
        while (v.fireAcc >= 1) { v.fireAcc -= 1; this.fx.fireP(cx + (Math.random() - 0.5) * 20, cy - 10 + (Math.random() - 0.5) * 6, 1); }
        if (Math.random() < dt * 3) this.fx.smokeP(cx, cy - 14, 1, 0x3a3a44);
      }
      // headlight (loco)
      if (i === 0) {
        if (!v.head) {
          v.head = this.scene.add.image(0, 0, 'headlight').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
          this.layer.add(v.head);
        }
        const L = 34;
        const fx = cx + Math.cos(v.a) * (L / 2), fy = cy + Math.sin(v.a) * (L / 2) * ISO_Y - 6;
        const a = night * (this.reversing ? 0.18 : 0.55) * (state.phase === 'title' ? 0 : 1);
        v.head.setVisible(a > 0.01).setPosition(fx, fy).setRotation(pa).setScale(0.95, 0.75).setAlpha(a).setDepth(cy - 0.5);
        this.updateLoco(state, t, cx, cy, v.a, dt);
      }
    }
    this.snapshot = snap;
    this.drawGhosts(nowMs);
  }

  private updateLoco(state: SimState, t: TrainState, cx: number, cy: number, a: number, dt: number): void {
    const speed = Math.max(0, t.speed || 0);
    const L = 34, H = 9;
    // chimney at local (L/2-7, 0, H+5)
    const ca = Math.cos(a), sa = Math.sin(a);
    const chx = cx + (L / 2 - 7) * ca, chy = cy + (L / 2 - 7) * sa * ISO_Y - H - 5;
    if (state.phase !== 'title') {
      this.smokeAcc += dt * (1.5 + speed * 16) * this.settings.particleMul;
      while (this.smokeAcc >= 1) {
        this.smokeAcc -= 1;
        this.fx.steamP(chx + (Math.random() - 0.5) * 3, chy, 1, speed > 0.22, t.burningScrap ? 0x5a4a3a : 0xd0d4dc);
        if (t.burningScrap && Math.random() < 0.3) this.fx.fireP(chx, chy, 1);
        if (this.nightF > 0.2 && Math.random() < 0.2 + speed * 0.8) this.fx.sparksP(chx, chy - 2, 1, 0xffb060);
      }
    }
    // stop sparks
    if (this.prevSpeed > 0.06 && speed < 0.01) this.sparkTimer = 0.7;
    this.prevSpeed = speed;
    if (this.sparkTimer > 0) {
      this.sparkTimer -= dt;
      if (Math.random() < dt * 30 * this.settings.particleMul) {
        const side = Math.random() < 0.5 ? -8 : 8;
        const u = (Math.random() - 0.5) * 20;
        this.fx.sparksP(cx + u * ca - side * sa, cy + (u * sa + side * ca) * ISO_Y, 2, 0xffd080);
      }
    }
  }

  private drawGhosts(nowMs: number): void {
    const g = this.ghostGfx;
    g.clear();
    if (!this.ghosts.length) return;
    let w = 0, maxY = 0;
    for (const gh of this.ghosts) {
      const t = (nowMs - gh.t0) / GHOST_LIFE;
      if (t >= 1) continue;
      this.ghosts[w++] = gh;
      const cy = gh.y * ISO_Y;
      if (cy > maxY) maxY = cy;
      const def = CAR_DEFS[gh.type] ?? CAR_DEFS.coach;
      this.drawCar(g, gh.x, cy, gh.a, gh.type, null, 0.85 * (1 - t), -1, mixColor(def.color, 0x4a4f5a, 0.5), -1, null);
    }
    this.ghosts.length = w;
    g.setDepth(maxY).setVisible(w > 0);
  }

  /** Red rear lanterns (lit) on the trailing car while the train reverses. */
  private drawRearLanterns(g: Phaser.GameObjects.Graphics, cx: number, cy: number, ang: number, L: number, nowMs: number): void {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const p = this.settings.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(nowMs / 120);
    for (const v of [-5, 5]) {
      const x = cx + (-L / 2 - 1) * ca - v * sa, y = cy + ((-L / 2 - 1) * sa + v * ca) * ISO_Y - 6;
      g.fillStyle(0xff3030, 0.28 * p); disc(g, x, y, 6, 4, 8);
      g.fillStyle(0xff5050, 0.95 * p); disc(g, x, y, 1.8, 1.4, 6);
    }
  }

  // ---------------------------------------------------------------------------------------
  private drawCar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, ang: number, type: CarType, car: Car | null,
    alpha: number, selPulse: number, accent: number, index: number, next: { x: number; y: number; a: number } | null, hover = 0): void {
    const L = type === 'locomotive' ? 34 : 30, W = 16, H = 9;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lp = (u: number, v: number, z = 0) => ({ x: cx + u * ca - v * sa, y: cy + (u * sa + v * ca) * ISO_Y - z });
    const F = (c: number, a = 1) => g.fillStyle(c, a * alpha);
    const S = (w: number, c: number, a = 1) => g.lineStyle(w, c, a * alpha);
    const poly = (pts: Array<{ x: number; y: number }>) => g.fillPoints(pts, true);
    const disabled = !!car?.disabled;
    const now = this.nowMs;

    // colors
    let body = shade(accent, 0.8);
    let roof = lighten(accent, 0.12);
    if (type === 'medical') { roof = 0xf5f5f5; body = 0xc8c8cc; }
    if (type === 'armor_plate') { roof = 0x8a8f9a; body = 0x5a5f6a; }
    if (disabled) { roof = mixColor(roof, 0x50545c, 0.7); body = mixColor(body, 0x3a3d44, 0.7); }

    const R = [lp(L / 2, -W / 2, H), lp(L / 2, W / 2, H), lp(-L / 2, W / 2, H), lp(-L / 2, -W / 2, H)];
    const G = [lp(L / 2, -W / 2), lp(L / 2, W / 2), lp(-L / 2, W / 2), lp(-L / 2, -W / 2)];
    const rc = lp(0, 0, H);

    // shadow
    F(0x000000, 0.28);
    poly([lp(L / 2 + 3, -W / 2 - 3, -1), lp(L / 2 + 3, W / 2 + 3, -1), lp(-L / 2 - 3, W / 2 + 3, -1), lp(-L / 2 - 3, -W / 2 - 3, -1)]);
    // coupling link to the next car
    if (next) {
      const Ln = next && CAR_DEFS && 30;
      const a = lp(-L / 2 - 1, 0, 3);
      const nx = next.x + Math.cos(next.a) * (Ln / 2 + 1), ny = next.y * ISO_Y + Math.sin(next.a) * (Ln / 2 + 1) * ISO_Y - 3;
      S(2.6, 0x15171c, 0.95); g.lineBetween(a.x, a.y, nx, ny);
      S(1, 0x6a6e78, 0.8); g.lineBetween(a.x, a.y, nx, ny);
      F(0x3a3f4a); g.fillCircle((a.x + nx) / 2, (a.y + ny) / 2, 1.6);
    }

    // selection ring (under the car)
    if (selPulse >= 0) {
      S(2, 0xffffff, 0.45 + 0.35 * selPulse);
      g.strokeEllipse(cx, cy, L + 18 + selPulse * 4, (W + 18 + selPulse * 4) * ISO_Y + 8);
      S(1, accent, 0.8);
      g.strokeEllipse(cx, cy, L + 10, (W + 10) * ISO_Y + 6);
    }

    // which faces are toward the camera (their midpoint projects below the roof centre)
    const vis: boolean[] = [];
    const faceDy: number[] = [];
    for (let i = 0; i < 4; i++) { const a = R[i], b = R[(i + 1) % 4]; const dy = (a.y + b.y) / 2 - rc.y; faceDy.push(dy); vis.push(dy > 0.6); }
    // hover: soft gold pool under the lifted car
    if (hover > 0.01) {
      F(0xffd75a, 0.14 * hover); g.fillEllipse(cx, cy + 2 + hover * 2, L + 14, (W + 14) * ISO_Y + 6);
    }
    // bogies on the sides that are not facing the camera, drawn before the body so it hides part of them:
    //  - edge-on sides (train heading up/down the screen): wheels at ground level, outer half visible
    //  - back-facing sides: the roof overhangs them, so their darker upper arcs peek past the far roof edge
    for (const i of [1, 3]) {
      if (vis[i]) continue;
      const edgeOn = Math.abs(faceDy[i]) <= 0.6;
      const v = (i === 1 ? W / 2 : -W / 2) * (edgeOn ? 1.12 : 1.06);
      const z = edgeOn ? -1 : H - 0.8;
      for (const u of [-L / 3, 0, L / 3]) {
        const w = lp(u, v, z);
        F(edgeOn ? 0x15171c : 0x0e1014); disc(g, w.x, w.y, edgeOn ? 2.75 : 2.5, (edgeOn ? 2.75 : 2.5) * ISO_Y + 0.5, 8);
        F(edgeOn ? 0x50545e : 0x3a3e48, 0.9); disc(g, w.x, w.y, 1, 1 * ISO_Y + 0.2, 6);
        const sa2 = (car ? this.wheelPhase : 0) + u * 0.3;
        const sx = w.x + Math.cos(sa2) * 1.6, sy = w.y + Math.sin(sa2) * 1.6 * ISO_Y;
        F(0xb0b4bc, 0.85); g.fillRect(sx - 0.6, sy - 0.6, 1.2, 1.2);
      }
    }

    // visible side faces
    const faceShade = [0.62, 0.74, 0.62, 0.74]; // end, side, end, side
    for (let i = 0; i < 4; i++) {
      const a = R[i], b = R[(i + 1) % 4];
      if (!vis[i]) continue;
      F(shade(body, faceShade[i]));
      poly([a, b, G[(i + 1) % 4], G[i]]);
      S(1, shade(body, 0.4), 0.7);
      g.lineBetween(G[i].x, G[i].y, G[(i + 1) % 4].x, G[(i + 1) % 4].y);
      // wheels on visible side faces
      if (i === 1 || i === 3) {
        const v = i === 1 ? W / 2 : -W / 2;
        const spokes: Array<{ x: number; y: number }> = [];
        const brake = car ? this.brakeGlow : 0;
        for (const u of [-L / 3, 0, L / 3]) {
          const w = lp(u, v, -1);
          if (brake > 0) { F(0xff6a20, 0.35); disc(g, w.x, w.y, 4, 4 * ISO_Y + 0.5, 8); }
          F(0x1a1c22);
          disc(g, w.x, w.y, 2.75, 2.75 * ISO_Y + 0.5, 8);
          F(brake > 0 ? 0xff8a40 : 0x6a6e78, 0.85);
          disc(g, w.x, w.y, 1.1, 1.1 * ISO_Y + 0.2, 6);
          const sa2 = (car ? this.wheelPhase : 0) + u * 0.3;
          const sx = w.x + Math.cos(sa2) * 1.7, sy = w.y + Math.sin(sa2) * 1.7 * ISO_Y;
          F(0xd0d4dc, 0.9); g.fillRect(sx - 0.7, sy - 0.7, 1.4, 1.4);
          spokes.push({ x: sx, y: sy });
        }
        if (type === 'locomotive' && spokes.length === 3) {
          // connecting rod between the drive wheels
          S(1.3, 0xb8bcc8, 0.95); g.lineBetween(spokes[0].x, spokes[0].y, spokes[2].x, spokes[2].y);
          S(0.6, 0xffffff, 0.5); g.lineBetween(spokes[0].x, spokes[0].y, spokes[1].x, spokes[1].y);
        }
      } else {
        // coupling knuckle at the ends
        const e = lp(i === 0 ? L / 2 + 2 : -L / 2 - 2, 0, 3);
        F(0x2a2f3a);
        g.fillRect(e.x - 1.5, e.y - 1.5, 3, 3);
      }
    }
    // roof
    F(roof);
    poly(R);
    F(shade(roof, 0.9));
    poly([lp(L / 2 - 3, -W / 2 + 3, H), lp(L / 2 - 3, W / 2 - 3, H), lp(-L / 2 + 3, W / 2 - 3, H), lp(-L / 2 + 3, -W / 2 + 3, H)]);
    S(1, shade(body, 0.35), 0.8);
    g.strokePoints(R, true, true);

    // ---- type details ----
    const dot = (u: number, v: number, z: number, r: number, c: number, a = 1) => { const p = lp(u, v, z); F(c, a); disc(g, p.x, p.y, r, r * ISO_Y + 0.25, r > 3 ? 10 : 6); };
    const seg = (u1: number, v1: number, u2: number, v2: number, z: number, w: number, c: number, a = 1) => { const p = lp(u1, v1, z), q = lp(u2, v2, z); S(w, c, a); g.lineBetween(p.x, p.y, q.x, q.y); };
    const rect = (u0: number, v0: number, u1: number, v1: number, z: number, c: number, a = 1) => { F(c, a); poly([lp(u0, v0, z), lp(u1, v0, z), lp(u1, v1, z), lp(u0, v1, z)]); };
    const mast = (u: number, v: number, h: number, w: number, c: number) => { const p = lp(u, v, H), q = lp(u, v, H + h); S(w, c); g.lineBetween(p.x, p.y, q.x, q.y); };
    const barrel = (u: number, v: number, len: number, w: number, offset = 0) => {
      const base = lp(u, v, H + 2);
      let aim = projAngle(ang) + offset;
      const tid = car?.derived?.targetEnemyId;
      if (tid) { const e = this.enemyPos.get(tid); if (e) aim = Math.atan2(e.y * ISO_Y - base.y, e.x - base.x) + offset; }
      S(w, 0x22252c); g.lineBetween(base.x, base.y, base.x + Math.cos(aim) * len, base.y + Math.sin(aim) * len);
      S(Math.max(1, w - 2), 0x8a8f9a, 0.8); g.lineBetween(base.x, base.y, base.x + Math.cos(aim) * (len - 1), base.y + Math.sin(aim) * (len - 1));
      return { x: base.x + Math.cos(aim) * len, y: base.y + Math.sin(aim) * len };
    };
    switch (type) {
      case 'locomotive': {
        rect(-L / 2 + 2, -W / 2 + 1, -L / 2 + 12, W / 2 - 1, H + 3, shade(body, 0.7));
        rect(-L / 2 + 3, -W / 2 + 2, -L / 2 + 11, W / 2 - 2, H + 3, this.nightF > 0.2 ? 0xffe8a0 : 0x9fc8e8, 0.5 + this.nightF * 0.5);
        mast(L / 2 - 7, 0, 6, 4.5, 0x2a2f3a);
        dot(L / 2 - 7, 0, H + 6, 3.2, 0x3a3f4a);
        dot(L / 2 - 7, 0, H + 6, 1.8, 0x15171c);
        dot(L / 2 - 14, 0, H + 1, 2.5, 0xb8a060);
        dot(L / 2, 0, H - 3, 1.6, 0xfff2c8);
        // cowcatcher
        F(shade(body, 0.5)); poly([lp(L / 2, -W / 2 + 2, 2), lp(L / 2 + 5, 0, -1), lp(L / 2, W / 2 - 2, 2)]);
        if (car && this.nightF > 0.05) {
          // pool of light on the ground ahead of the headlight
          const hp0 = lp(L / 2 + 34, 0, 0);
          F(0xfff2c8, 0.10 * this.nightF); g.fillEllipse(hp0.x, hp0.y, 78, 30);
          F(0xfff2c8, 0.08 * this.nightF); g.fillEllipse(hp0.x, hp0.y, 40, 16);
        }
        break;
      }
      case 'coal_bunker':
        F(0x24262c); g.fillEllipse(rc.x, rc.y - 1, 20, 9 * ISO_Y + 4);
        dot(-3, -2, H + 3, 1.2, 0x4a4c54); dot(4, 1, H + 3, 1, 0x4a4c54);
        break;
      case 'boiler':
        rect(-11, -5, 11, 5, H + 2, 0x8a5a3a);
        rect(-11, -5, 11, -2, H + 2, 0xb07a52, 0.8);
        seg(-4, -5, -4, 5, H + 2, 1.2, 0x4a3020); seg(4, -5, 4, 5, H + 2, 1.2, 0x4a3020);
        dot(8, 0, H + 2, 1.3, 0xffb060, 0.7);
        break;
      case 'reactor': {
        const p = this.settings.reducedMotion ? 0.7 : 0.5 + 0.5 * Math.sin(now / 200);
        dot(0, 0, H, 6, 0x1a2a2a);
        dot(0, 0, H, 4, 0x5ee0b0, 0.5 + 0.5 * p);
        S(1, 0x5ee0b0, 0.8); g.strokeEllipse(rc.x, rc.y, 14, 14 * ISO_Y + 1);
        if (this.settings.glow && Math.random() < 0.05) this.fx.glowPuffP(rc.x, rc.y, 0x5ee0b0, 8, 300);
        break;
      }
      case 'radiator':
        for (const u of [-7, -3.5, 0, 3.5, 7]) seg(u, -6, u, 6, H + 1, 1.5, 0xdde8f0, 0.9);
        seg(-8, 0, 8, 0, H + 1, 1, 0x9ab0c0, 0.6);
        break;
      case 'fabricator':
        rect(-7, -4, 5, 4, H + 1, 0x6a5a3a);
        seg(-7, 0, 5, 0, H + 1, 1, 0xc9a54a, 0.6);
        mast(9, -4, 4, 2.5, 0x3a3f4a);
        break;
      case 'foundry': {
        rect(-7, -4, 5, 4, H + 1, 0x5a4030);
        const p = this.settings.reducedMotion ? 0.7 : 0.6 + 0.4 * Math.sin(now / 150);
        dot(-1, 0, H + 1, 2.5, 0xff8040, p);
        mast(9, -4, 5, 3, 0x3a3f4a);
        if (Math.random() < 0.06 * this.settings.particleMul) { const c = lp(9, -4, H + 5); this.fx.smokeP(c.x, c.y, 1, 0x7a7078); }
        break;
      }
      case 'cargo':
        for (const [u, v] of [[-8, -4], [-8, 1], [1, -4], [1, 1]] as Array<[number, number]>) {
          rect(u, v, u + 7, v + 3.5, H + 1, 0x6a4a30);
          seg(u, v, u + 7, v, H + 1, 0.8, 0x9a7a5a, 0.8);
        }
        break;
      case 'armored_cargo':
        for (const u of [-9, -3, 3, 9]) seg(u, -6.5, u, 6.5, H, 1, 0x4a4f5a, 0.8);
        for (const [u, v] of [[-12, -5], [12, -5], [-12, 5], [12, 5]] as Array<[number, number]>) dot(u, v, H + 0.5, 0.9, 0xb0b4bc);
        break;
      case 'gatling': {
        dot(0, 0, H + 1, 4.5, 0x3a3f4a);
        const tip = barrel(0, 0, 12, 2.5);
        void tip;
        break;
      }
      case 'cannon': {
        dot(0, 0, H + 1, 6, 0x3a3f4a);
        dot(0, 0, H + 1, 3, 0x22252c);
        barrel(0, 0, 17, 4);
        break;
      }
      case 'flak':
        dot(0, 0, H + 1, 5, 0x3a3f4a);
        barrel(0, 0, 10, 2, -0.22);
        barrel(0, 0, 10, 2, 0.22);
        break;
      case 'tesla': {
        seg(-6, 0, 6, 0, H + 3, 2, 0x3a3f4a);
        for (const u of [-6, 6]) { mast(u, 0, 3, 2.5, 0x3a3f4a); dot(u, 0, H + 4, 3, 0x8fd3ff, 0.9); dot(u, 0, H + 4, 1.4, 0xffffff); }
        const wpn = CAR_DEFS.tesla.weapon;
        if (car && wpn && car.cooldown > wpn.cooldown * 0.85 && !this.settings.reducedMotion) {
          const a = lp(-6, 0, H + 4), b = lp(6, 0, H + 4);
          S(1.5, 0xffffff, 0.9);
          g.lineBetween(a.x, a.y, (a.x + b.x) / 2 + (Math.random() - 0.5) * 6, (a.y + b.y) / 2 - 4 + (Math.random() - 0.5) * 6);
          g.lineBetween((a.x + b.x) / 2 + (Math.random() - 0.5) * 6, (a.y + b.y) / 2 - 4, b.x, b.y);
        }
        break;
      }
      case 'flamethrower':
        rect(-10, -4, 1, 4, H + 2, 0x7a3a2a);
        rect(-10, -4, 1, -1.5, H + 2, 0xa05a3a, 0.8);
        seg(3, 0, L / 2 + 2, 0, H + 1, 3, 0x2a2f3a);
        dot(L / 2 + 2, 0, H + 1, 1.5, 0xff8f3a);
        break;
      case 'barracks':
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; dot(Math.cos(a) * 9, Math.sin(a) * 4.5, H + 0.5, 1.3, 0x8a7a5a); }
        dot(-3, 0, H + 1, 1.3, 0x6fbf73); dot(3, 1, H + 1, 1.3, 0x6fbf73);
        break;
      case 'medical':
        rect(-5, -1.3, 5, 1.3, H + 0.5, 0xd94f4f);
        rect(-1.3, -5, 1.3, 5, H + 0.5, 0xd94f4f);
        break;
      case 'scout': {
        mast(0, 0, 9, 1.2, 0x8a8f9a);
        dot(0, 0, H + 9, 3, 0x9fd8ff, 0.9);
        const blink = this.settings.reducedMotion ? 1 : (Math.sin(now / 250) > 0 ? 1 : 0.3);
        dot(0, 0, H + 11, 1, 0xffffff, blink);
        break;
      }
      case 'coach':
      case 'sleeper': {
        const lit = this.nightF > 0.15;
        const wc = lit ? 0xffe8a0 : 0x9fc8e8;
        for (const v of [-(W / 2 - 2.5), W / 2 - 2.5]) for (const u of [-9, -3, 3, 9]) rect(u - 2, v - 1, u + 2, v + 1, H + 0.3, wc, lit ? 0.95 : 0.8);
        if (lit && this.settings.glow) { for (const u of [-6, 6]) { const p = lp(u, 0, H); F(0xffe8a0, 0.06 * this.nightF); g.fillEllipse(p.x, p.y, 26, 18); } }
        {
          // passengers as tiny silhouettes in the windows
          const heads = car ? Math.min(8, Math.ceil((car.passengers || 0) / 3)) : 0;
          let hi = 0;
          for (const v of [-(W / 2 - 2.5), W / 2 - 2.5]) for (const u of [-9, -3, 3, 9]) {
            if (hi >= heads) break;
            dot(u + ((hi * 7) % 3) - 1, v, H + 0.6, 0.9, 0x2a2430, 0.95);
            hi++;
          }
        }
        break;
      }
      case 'rail_layer':
        seg(-4, 0, 10, -6, H + 6, 2.5, 0x8a8f9a);
        mast(-4, 0, 6, 2, 0x8a8f9a);
        for (const v of [-4, 0, 4]) seg(-12, v, 6, v, H + 0.5, 1.2, 0xc9c9c9, 0.9);
        break;
      case 'armor_plate':
        for (let i = 0; i < 6; i++) { const u = -12 + i * 4.8; dot(u, -6.2, H + 0.5, 0.8, 0xb0b4bc); dot(u, 6.2, H + 0.5, 0.8, 0xb0b4bc); }
        seg(-13, 0, 13, 0, H + 0.5, 1, 0x5a5f6a, 0.6);
        break;
      case 'signal': {
        mast(0, 0, 10, 1.5, 0x8a8f9a);
        const phase = this.settings.reducedMotion ? 0 : Math.floor(now / 500) % 2;
        dot(0, 0, H + 10, 1.8, phase ? 0xe86f6f : 0x6fbf73);
        break;
      }
      case 'caboose': {
        // short rear-guard car: raised cupola with windows and a red rear lantern
        rect(-6, -4.5, 4, 4.5, H + 4, shade(accent, 0.75));
        rect(-6, -4.5, 4, -3, H + 4, lighten(accent, 0.2), 0.9);
        seg(-6, -4.5, -6, 4.5, H + 4, 1, shade(accent, 0.4), 0.8);
        seg(4, -4.5, 4, 4.5, H + 4, 1, shade(accent, 0.4), 0.8);
        const lit = this.nightF > 0.15;
        rect(-4, -4.4, -1, -3.2, H + 4.2, lit ? 0xffe8a0 : 0x9fc8e8, 0.9);
        rect(0, -4.4, 3, -3.2, H + 4.2, lit ? 0xffe8a0 : 0x9fc8e8, 0.9);
        rect(-4, 3.2, -1, 4.4, H + 4.2, lit ? 0xffe8a0 : 0x9fc8e8, 0.9);
        rect(0, 3.2, 3, 4.4, H + 4.2, lit ? 0xffe8a0 : 0x9fc8e8, 0.9);
        mast(-11, 0, 3, 1.2, 0x3a3f4a);
        const rl = this.reversing || lit ? 1 : 0.45;
        dot(-L / 2 - 1, 0, H + 2, 1.6, 0xff4040, rl);
        if (rl >= 1) { F(0xff3030, 0.25); const p = lp(-L / 2 - 1, 0, H + 2); disc(g, p.x, p.y, 5, 3.5, 8); }
        break;
      }
      default:
        // unknown / future car types: the generic box with a hatch
        rect(-6, -4, 6, 4, H + 0.5, shade(accent, 0.7), 0.8);
        break;
    }

    // ---- upgrade level: brass trim (2+) and a pennant mast (3) ----
    const level = car ? Math.max(1, Math.min(3, (car.level as number | undefined) ?? 1)) : 1;
    if (level >= 2) {
      S(1.2, 0xd8b25a, 0.95);
      for (let i = 0; i < 4; i++) {
        if (!vis[i]) continue;
        const a = R[i], b = R[(i + 1) % 4];
        g.lineBetween(a.x, a.y + 1.6, b.x, b.y + 1.6);
      }
      // trim studs on the roof rim
      F(0xf0d080, 0.9);
      for (const [u, v] of [[L / 2 - 3, -W / 2 + 2], [L / 2 - 3, W / 2 - 2], [-L / 2 + 3, -W / 2 + 2], [-L / 2 + 3, W / 2 - 2]] as Array<[number, number]>) {
        const p = lp(u, v, H + 0.2); g.fillRect(p.x - 0.7, p.y - 0.7, 1.4, 1.4);
      }
    }
    if (level >= 3) {
      const base = lp(-L / 2 + 5, -W / 2 + 3, H), top = lp(-L / 2 + 5, -W / 2 + 3, H + 9);
      S(1.1, 0x8a8f9a, 0.95); g.lineBetween(base.x, base.y, top.x, top.y);
      const pa = projAngle(ang);
      const flutter = this.settings.reducedMotion ? 0 : Math.sin(now / 110 + index * 1.7) * 1.2;
      const fx = -Math.cos(pa) * 6, fy = -Math.sin(pa) * 6 * 0.6 + flutter;
      F(0xd8b25a, 0.95); g.fillTriangle(top.x, top.y, top.x + fx, top.y + fy + 1.2, top.x, top.y + 3.2);
      F(0xfff0c0); g.fillCircle(top.x, top.y, 0.9);
    }
    // ---- hover: gold outline around the silhouette ----
    if (hover > 0.01) {
      S(1.6, 0xffd75a, 0.95 * hover);
      g.strokePoints(R, true, true);
      for (let i = 0; i < 4; i++) {
        if (!vis[i]) continue;
        const a = R[i], b = R[(i + 1) % 4], ga = G[i], gb = G[(i + 1) % 4];
        g.lineBetween(a.x, a.y, ga.x, ga.y); g.lineBetween(ga.x, ga.y, gb.x, gb.y); g.lineBetween(gb.x, gb.y, b.x, b.y);
      }
    }

    if (!car) return;

    // heat tint on the roof
    const heat = clamp(car.heat || 0, 0, 120);
    if (heat > 25) { F(0xff6a20, ((heat - 25) / 75) * 0.5); poly(R); }
    // disabled flicker
    if (disabled) {
      if (!this.settings.reducedMotion && Math.sin(now / 25) > 0.4) { F(0xffffff, 0.15); poly(R); }
      const p = lp(0, 0, H + 4);
      F(0xffd080, 0.9); g.fillCircle(p.x + (Math.random() - 0.5) * 8, p.y, 1);
    }
    // boarders on the roof
    const boarders = Array.isArray(car.boarders) ? car.boarders.length : 0;
    for (let i = 0; i < boarders; i++) {
      const u = -L / 2 + 6 + ((i * 7) % Math.max(1, L - 10));
      const v = i % 2 ? 4 : -4;
      const b = lp(u, v, H + 3), h = lp(u, v, H + 7);
      F(0xe06060); g.fillRect(b.x - 1.6, b.y - 2.5, 3.2, 4.5);
      F(0xffd0b0); g.fillCircle(h.x, h.y, 1.6);
      if (!this.settings.reducedMotion && Math.random() < 0.02) this.fx.sparksP(b.x, b.y, 1, 0xff8080);
    }
    // damage: dents / scorch marks scaling with lost hp
    const dmg = 1 - clamp(car.hp / (car.maxHp || 1), 0, 1);
    if (dmg > 0.12) {
      for (let k = 0; k < 4; k++) {
        if (dmg < 0.12 + k * 0.2) break;
        const hu = hashInt(index * 17 + k * 31 + 3), hv = hashInt(index * 23 + k * 41 + 5);
        const p = lp((hu - 0.5) * (L - 10), (hv - 0.5) * (W - 6), H + 0.2);
        F(0x1a1410, 0.3 + dmg * 0.4); g.fillEllipse(p.x, p.y, 5 + hu * 4, 3 + hv * 1.5);
        F(0x4a3020, 0.5); g.fillEllipse(p.x + 1, p.y + 0.8, 2.5, 1.4);
      }
      if (dmg > 0.55) { F(0x100a08, (dmg - 0.55) * 0.9); poly(R); }
    }
    // marines engaged marker
    if (car.derived?.marinesEngaged) { dot(0, 0, H + 6, 1.2, 0x6fbf73, 0.6 + 0.4 * Math.sin(now / 90)); }
    // health bar
    const maxHp = car.maxHp || 1;
    if (car.hp < maxHp) {
      const ratio = clamp(car.hp / maxHp, 0, 1);
      const bx = cx - 13, by = cy - H - 15;
      F(0x0b0e1a, 0.8); g.fillRect(bx - 1, by - 1, 28, 5);
      F(ratio > 0.5 ? 0x6fbf73 : ratio > 0.25 ? 0xe8c170 : 0xe86f6f); g.fillRect(bx, by, 26 * ratio, 3);
    }
    // brownout indicator
    const def = CAR_DEFS[type];
    if (def && def.powerUse > 0 && car.derived && car.derived.powerRatio < 0.99) {
      const p = lp(-L / 2 + 4, -W / 2 + 3, H + 1);
      F(0xe8c170, 0.9); g.fillTriangle(p.x - 2, p.y - 3, p.x + 2, p.y - 3, p.x, p.y + 1);
    }
    void index;
  }
}
