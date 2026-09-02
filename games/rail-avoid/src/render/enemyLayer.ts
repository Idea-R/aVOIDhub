/**
 * Enemies: pooled sprites per type, interpolated toward sim positions, y-sorted with the train.
 * Distinct silhouettes from procedural textures; bosses are multi-part containers.
 */
import Phaser from 'phaser';
import type { SimState, Enemy, EnemyType } from '../core/types';
import { ENEMY_DEFS } from '../core/enemies';
import { ISO_Y } from '../core/config';
import type { FxLayer } from './fxLayer';
import type { RenderSettings } from './settings';
import { TEX_SCALE } from './textures';
import { FONT } from './palette';
import { expFactor, projAngle, cssColor } from './util';

type GO = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

interface EView {
  id: string;
  type: EnemyType;
  obj: GO;
  parts: Phaser.GameObjects.Image[];
  baseTints: number[];
  shadow: Phaser.GameObjects.Image | null;
  x: number; y: number;           // smoothed unprojected
  facing: number;
  flashUntil: number;
  dying: boolean;
  dieT0: number;
  burst: boolean;
  seenAlive: boolean;
  hp: number; maxHp: number;
  visible: boolean;
  phase: number;
  spin: number;
  bob: number;
  recoil: number;
  smokeAcc: number;
}

const AIR_ALT = 30;

export class EnemyLayer {
  private views = new Map<string, EView>();
  private pools = new Map<EnemyType, EView[]>();
  private hpGfx: Phaser.GameObjects.Graphics;
  private bossLabel: Phaser.GameObjects.Text;
  private settings: RenderSettings;
  public positions = new Map<string, { x: number; y: number }>();

  constructor(private scene: Phaser.Scene, private world: Phaser.GameObjects.Layer, private air: Phaser.GameObjects.Layer,
    private shadows: Phaser.GameObjects.Layer, private fx: FxLayer, settings: RenderSettings) {
    this.settings = settings;
    this.hpGfx = scene.add.graphics();
    air.add(this.hpGfx);
    this.hpGfx.setDepth(1e6);
    this.bossLabel = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#ffffff', stroke: '#0b0e1a', strokeThickness: 3, resolution: 2 })
      .setOrigin(0.5, 1).setVisible(false);
    this.bossLabel.setLetterSpacing(1.5);
    air.add(this.bossLabel);
    this.bossLabel.setDepth(1e6 + 1);
  }

  setSettings(s: RenderSettings): void { this.settings = s; }

  destroy(): void {
    for (const v of this.views.values()) this.destroyView(v);
    for (const list of this.pools.values()) for (const v of list) this.destroyView(v);
    this.views.clear(); this.pools.clear();
    this.hpGfx.destroy(); this.bossLabel.destroy();
  }
  private destroyView(v: EView): void { v.obj.destroy(); v.shadow?.destroy(); }

  clear(): void {
    for (const v of this.views.values()) this.release(v);
    this.views.clear();
    this.positions.clear();
  }

  // ---------------- view creation ----------------
  private acquire(id: string, e: Enemy): EView {
    const type = (ENEMY_DEFS[e.type] ? e.type : 'raider') as EnemyType;
    const pool = this.pools.get(type);
    let v = pool && pool.length ? pool.pop()! : this.createView(type);
    v.id = id; v.x = e.x; v.y = e.y; v.facing = 1; v.flashUntil = 0; v.dying = false; v.dieT0 = 0; v.burst = false;
    v.seenAlive = e.state !== 'dead'; v.hp = e.hp; v.maxHp = e.maxHp; v.visible = true; v.phase = 0; v.spin = 0; v.bob = Math.random() * 6; v.recoil = 0; v.smokeAcc = 0;
    // restore boss plates (may have been tweened away)
    if (type === 'boss_brood') for (let i = 1; i < v.parts.length; i++) { const pl = v.parts[i]; pl.setVisible(true).setAlpha(1).setAngle(0); pl.setY(pl.getData('oy') ?? pl.y); }
    v.obj.setVisible(true).setAlpha(1).setScale(v.obj instanceof Phaser.GameObjects.Image ? TEX_SCALE : 1);
    if (v.obj instanceof Phaser.GameObjects.Image) v.obj.setFlipX(false);
    for (let i = 0; i < v.parts.length; i++) { v.parts[i].clearTint(); if (v.baseTints[i] !== -1) v.parts[i].setTint(v.baseTints[i]); v.parts[i].setAlpha(1); }
    if (v.shadow) v.shadow.setVisible(true).setAlpha(0.35);
    return v;
  }
  private release(v: EView): void {
    v.obj.setVisible(false);
    v.shadow?.setVisible(false);
    const list = this.pools.get(v.type) ?? [];
    list.push(v);
    this.pools.set(v.type, list);
  }

  private createView(type: EnemyType): EView {
    const def = ENEMY_DEFS[type];
    const scene = this.scene;
    const parts: Phaser.GameObjects.Image[] = [];
    const baseTints: number[] = [];
    let obj: GO;
    let shadow: Phaser.GameObjects.Image | null = null;
    const mkShadow = (scale: number) => {
      const s = scene.add.image(0, 0, 'shadow').setScale(TEX_SCALE * scale).setAlpha(0.35);
      this.shadows.add(s);
      return s;
    };
    switch (type) {
      case 'harpy': {
        const c = scene.add.container(0, 0);
        const rotor = scene.add.image(0, -7, 'rotor').setScale(TEX_SCALE * 1.3).setAlpha(0.55);
        const body = scene.add.image(0, 0, 'e_harpy').setScale(TEX_SCALE);
        c.add([rotor, body]);
        parts.push(body); baseTints.push(-1);
        obj = c;
        this.air.add(c);
        shadow = mkShadow(0.7);
        break;
      }
      case 'wisp': {
        const c = scene.add.container(0, 0);
        const glow = scene.add.image(0, 0, 'glow').setScale(0.8).setBlendMode(Phaser.BlendModes.ADD).setTint(def.color).setAlpha(0.45);
        const body = scene.add.image(0, 0, 'e_wisp').setScale(TEX_SCALE).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.85);
        c.add([glow, body]);
        parts.push(body); baseTints.push(-1);
        obj = c;
        this.world.add(c);
        break;
      }
      case 'boss_wagon': {
        const c = scene.add.container(0, 0);
        const head = scene.add.image(0, 0, 'e_wagon_head').setScale(TEX_SCALE).setOrigin(0.5, 0.9);
        c.add(head); parts.push(head); baseTints.push(-1);
        for (let i = 1; i < 4; i++) {
          const seg = scene.add.image(-i * 62, 0, 'e_wagon').setScale(TEX_SCALE).setOrigin(0.5, 0.9);
          c.add(seg); parts.push(seg); baseTints.push(-1);
        }
        obj = c;
        this.world.add(c);
        shadow = mkShadow(2.2);
        break;
      }
      case 'boss_brood': {
        const c = scene.add.container(0, 0);
        const body = scene.add.image(0, 0, 'e_brood').setScale(TEX_SCALE).setOrigin(0.5, 0.88);
        c.add(body); parts.push(body); baseTints.push(-1);
        const offs: Array<[number, number]> = [[-26, -22], [-4, -30], [18, -24], [-4, -12]];
        for (const [x, y] of offs) {
          const p = scene.add.image(x, y, 'e_brood_plate').setScale(TEX_SCALE);
          p.setData('oy', y);
          c.add(p); parts.push(p); baseTints.push(-1);
        }
        obj = c;
        this.world.add(c);
        shadow = mkShadow(2.6);
        break;
      }
      case 'boss_maw': {
        const c = scene.add.container(0, 0);
        const r3 = scene.add.image(0, 0, 'e_maw_ring').setScale(TEX_SCALE * 1.7).setAlpha(0.35);
        const r2 = scene.add.image(0, 0, 'e_maw_ring').setScale(TEX_SCALE * 1.25).setAlpha(0.6);
        const r1 = scene.add.image(0, 0, 'e_maw_ring').setScale(TEX_SCALE * 0.85).setAlpha(0.9);
        const core = scene.add.image(0, 0, 'e_maw_core').setScale(TEX_SCALE);
        c.add([r3, r2, r1, core]);
        for (let i = 0; i < 3; i++) {
          const w = scene.add.image(0, 0, 'e_maw_wisp').setScale(TEX_SCALE).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
          c.add(w);
        }
        parts.push(core); baseTints.push(-1);
        const eye = scene.add.image(0, -4, 'eye').setScale(TEX_SCALE);
        const pupil = scene.add.image(0, -4, 'pupil').setScale(TEX_SCALE);
        c.add([eye, pupil]);
        for (const r of [r1, r2, r3]) c.setData('ring' + parts.length, r);
        c.setScale(1, ISO_Y + 0.1);
        obj = c;
        this.world.add(c);
        break;
      }
      default: {
        const img = scene.add.image(0, 0, 'e_' + type).setScale(TEX_SCALE).setOrigin(0.5, 0.92);
        parts.push(img); baseTints.push(-1);
        obj = img;
        this.world.add(img);
        shadow = mkShadow(type === 'crawler' ? 1.1 : 0.6);
      }
    }
    return {
      id: '', type, obj, parts, baseTints, shadow, x: 0, y: 0, facing: 1, flashUntil: 0, dying: false, dieT0: 0, burst: false,
      seenAlive: true, hp: def.hp, maxHp: def.hp, visible: true, phase: 0, spin: 0, bob: 0, recoil: 0, smokeAcc: 0,
    };
  }

  // ---------------- events ----------------
  onHit(id: string, x: number, y: number, immune: boolean, nowMs: number): void {
    const v = this.views.get(id);
    if (v) v.flashUntil = nowMs + 70;
    if (immune) this.fx.floatText(x, y, 'IMMUNE', 0xb8b8c8, 9, 22);
  }
  onDied(id: string, type: EnemyType, x: number, y: number, nowMs: number): void {
    const def = ENEMY_DEFS[type];
    const color = def?.color ?? 0xffffff;
    const boss = type.startsWith('boss_');
    this.fx.burst(x, y, color, boss ? 60 : 12);
    if (boss) { this.fx.explosion(x, y, 120, true); this.fx.shockwave(x, y, 220); }
    else if (type === 'crawler') this.fx.debris(x, y, 8, color);
    else if (type === 'wisp') this.fx.implosion(x, y);
    const v = this.views.get(id);
    if (v && !v.dying) { v.dying = true; v.dieT0 = nowMs; v.burst = true; }
  }
  /** An enemy shell was fired near (x,y): Iron Wagon turret recoil + muzzle light. */
  onEnemyShot(x: number, y: number): void {
    for (const v of this.views.values()) {
      if (v.type !== 'boss_wagon' || v.dying) continue;
      if (Math.hypot(v.x - x, v.y - y) > 200) continue;
      v.recoil = 1;
      const px = v.x, py = v.y * ISO_Y;
      this.fx.lightP(px + v.facing * 30, py - 22, 0xffb060, 34, 100);
      this.fx.puff(x, y, 0xc8c8d0, 10);
      break;
    }
  }
  /** Boss phase change: Brood Mother plates visibly fall off. */
  onBossPhase(type: EnemyType, phase: number): void {
    if (type !== 'boss_brood') return;
    for (const v of this.views.values()) {
      if (v.type !== 'boss_brood') continue;
      const keep = Math.max(0, 4 - (phase | 0));
      for (let i = 1; i < v.parts.length; i++) {
        const pl = v.parts[i];
        const idx = i - 1;
        if (idx < keep || !pl.visible || pl.getData('falling')) continue;
        pl.setData('falling', true);
        const dir = idx % 2 ? 1 : -1;
        this.scene.tweens.add({
          targets: pl, y: pl.y + 46, x: pl.x + dir * 22, angle: dir * 70, alpha: 0, duration: 900, ease: 'Quad.easeIn',
          onComplete: () => { pl.setVisible(false).setAlpha(1).setAngle(0); pl.setY(pl.getData('oy') ?? pl.y); pl.setX(pl.x - dir * 22); pl.setData('falling', false); },
        });
        this.fx.debris(v.x + pl.x, v.y + pl.y / ISO_Y, 8, ENEMY_DEFS.boss_brood.color);
      }
      v.phase = phase | 0;
    }
  }

  onSpawn(id: string, type: EnemyType, x: number, y: number): void {
    const def = ENEMY_DEFS[type];
    this.fx.burst(x, y, def?.color ?? 0x6d5fd6, 5);
    void id;
  }

  /** Projected position of the active boss, or null. */
  bossPos(state: SimState): { x: number; y: number } | null {
    const id = state.boss?.enemyId;
    if (!id) return null;
    const v = this.views.get(id);
    if (!v) return null;
    return { x: v.x, y: v.y * ISO_Y };
  }

  // ---------------- per-frame ----------------
  update(state: SimState, dt: number, nowMs: number, loco: { x: number; y: number } | null): void {
    const list = Array.isArray(state.enemies) ? state.enemies : [];
    const rm = this.settings.reducedMotion;
    const hi = this.settings.quality === 'high';
    const seen = new Set<string>();
    const k = expFactor(16, dt);
    const trailX = state.train?.trailX ?? [], trailY = state.train?.trailY ?? [];
    const hp = this.hpGfx;
    hp.clear();
    let bossShown = false;

    for (const e of list) {
      if (!e || typeof e.id !== 'string') continue;
      seen.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        if (e.state === 'dead') continue;
        v = this.acquire(e.id, e);
        this.views.set(e.id, v);
      }
      if (e.state === 'dead' || e.hp <= 0) {
        if (!v.dying) { v.dying = true; v.dieT0 = nowMs; }
      }
      // smooth position
      const dx = e.x - v.x, dy = e.y - v.y;
      if (Math.abs(dx) > 400 || Math.abs(dy) > 400) { v.x = e.x; v.y = e.y; }
      else { v.x += dx * k; v.y += dy * k; }
      const mvx = dx * k;
      if (Math.abs(mvx) > 0.15) v.facing = mvx < 0 ? -1 : 1;
      else if (Math.abs(e.vx) > 2) v.facing = e.vx < 0 ? -1 : 1;
      this.positions.set(e.id, { x: v.x, y: v.y });
      v.hp = e.hp; v.maxHp = e.maxHp;

      // visibility rules
      let visible = true;
      let alpha = 1;
      if (e.boardedCar >= 0 || e.state === 'boarded') visible = false;
      if (e.type === 'sapper' && !e.revealed) {
        alpha = 0.35;
        let near = false;
        for (let i = 0; i < trailX.length; i++) {
          if (Math.hypot(trailX[i] - v.x, trailY[i] - v.y) <= 140) { near = true; break; }
        }
        if (!near) visible = false;
      }
      const px = v.x, py = v.y * ISO_Y;
      const def = ENEMY_DEFS[v.type];
      v.bob += dt * 5;

      // dying animation
      if (v.dying) {
        const t = (nowMs - v.dieT0) / 900;
        if (t >= 1) { this.release(v); this.views.delete(e.id); this.positions.delete(e.id); continue; }
        alpha *= 1 - t;
        if (v.obj instanceof Phaser.GameObjects.Image) v.obj.setScale(TEX_SCALE * (1 + t * 0.2), TEX_SCALE * (1 - t * 0.6));
        for (const p of v.parts) p.setTint(0x333340);
        if (def.layer === 'air') v.obj.setY(py - AIR_ALT + t * 60);
        v.obj.setAlpha(alpha).setVisible(visible);
        if (v.shadow) v.shadow.setAlpha(0.35 * (1 - t));
        continue;
      }

      v.visible = visible;
      v.obj.setVisible(visible);
      v.shadow?.setVisible(visible);
      if (!visible) continue;
      v.obj.setAlpha(alpha);

      // placement per layer
      let depthY = py;
      if (def.layer === 'air') {
        const bob = this.settings.reducedMotion ? 0 : Math.sin(v.bob) * 3;
        v.obj.setPosition(px, py - AIR_ALT + bob);
        v.shadow?.setPosition(px, py + 2).setAlpha(0.28 * alpha);
        const rotor = (v.obj as Phaser.GameObjects.Container).list[0] as Phaser.GameObjects.Image | undefined;
        if (rotor && !this.settings.reducedMotion) rotor.setRotation(rotor.rotation + dt * 28);
      } else if (v.type === 'wisp') {
        const bob = this.settings.reducedMotion ? 0 : Math.sin(v.bob * 0.8) * 3;
        v.obj.setPosition(px, py - 10 + bob);
        const c = v.obj as Phaser.GameObjects.Container;
        const s = this.settings.reducedMotion ? 1 : 1 + Math.sin(v.bob * 1.7) * 0.12;
        c.setScale(s, s);
        const gl = c.list[0] as Phaser.GameObjects.Image | undefined;
        if (gl) gl.setAlpha(0.35 + 0.25 * (rm ? 0.5 : 0.5 + 0.5 * Math.sin(v.bob * 2.6)));
        if (this.settings.glow && Math.random() < dt * (hi ? 14 : 5)) this.fx.glowPuffP(px + (Math.random() - 0.5) * 8, py - 10 + (Math.random() - 0.5) * 6, def.color, 5, 550);
      } else if (v.type === 'boss_maw') {
        v.obj.setPosition(px, py);
        const c = v.obj as Phaser.GameObjects.Container;
        v.spin += dt;
        const items = c.list as Phaser.GameObjects.Image[];
        const pulse = this.settings.reducedMotion ? 1 : 1 + Math.sin(v.spin * 2.5) * 0.06;
        if (items[0]) items[0].setRotation(v.spin * 0.4).setScale(TEX_SCALE * 1.7 * pulse);
        if (items[1]) items[1].setRotation(-v.spin * 0.7).setScale(TEX_SCALE * 1.25 * pulse);
        if (items[2]) items[2].setRotation(v.spin * 1.1).setScale(TEX_SCALE * 0.85 * pulse);
        if (items[3]) items[3].setScale(TEX_SCALE * (this.settings.reducedMotion ? 1 : 1 + Math.sin(v.spin * 4) * 0.08));
        for (let i = 4; i < 7 && i < items.length; i++) {
          const a = v.spin * (0.9 + i * 0.2) + i * 2.1;
          items[i].setPosition(Math.cos(a) * 58, Math.sin(a) * 58);
        }
        // the eye follows the locomotive
        if (items[8] && loco) {
          const dx = loco.x - v.x, dy = (loco.y - v.y) * ISO_Y;
          const l = Math.hypot(dx, dy) || 1;
          items[8].setPosition((dx / l) * 3.2, -4 + (dy / l) * 2);
          if (items[7]) items[7].setAlpha(0.85 + 0.15 * Math.sin(v.spin * 1.3));
        }
        if (this.settings.quality !== 'low' && Math.random() < dt * (hi ? 16 : 7)) this.fx.spiralP(px, py, 95, 0x9a6fff);
        depthY = py + 10;
      } else if (v.type === 'boss_wagon') {
        v.obj.setPosition(px, py);
        const c = v.obj as Phaser.GameObjects.Container;
        const pa = projAngle(e.angle || 0);
        const ux = Math.cos(pa), uy = Math.sin(pa);
        v.recoil = Math.max(0, v.recoil - dt * 5);
        for (let i = 0; i < v.parts.length; i++) {
          const back = i === 0 ? v.recoil * 7 : 0;
          v.parts[i].setPosition(-ux * (62 * i + back), -uy * (62 * i + back)).setFlipX(ux < 0);
        }
        if (this.settings.quality !== 'low') {
          v.smokeAcc += dt * 5 * this.settings.particleMul;
          while (v.smokeAcc >= 1) { v.smokeAcc -= 1; this.fx.smokeP(px + ux * 8 + (Math.random() - 0.5) * 3, py - 30, 1, 0x4a4a52); }
        }
        void c;
        v.shadow?.setPosition(px - ux * 90, py - uy * 90).setScale(TEX_SCALE * 2.2 * 2, TEX_SCALE * 2.2);
        depthY = py + 6;
      } else if (v.type === 'boss_brood') {
        const bob = this.settings.reducedMotion ? 0 : Math.abs(Math.sin(v.bob * 1.4)) * 3;
        v.obj.setPosition(px, py - bob);
        const c = v.obj as Phaser.GameObjects.Container;
        c.setScale(v.facing, 1);
        const phase = Math.max(0, e.phase | 0);
        if (phase > v.phase) this.onBossPhase('boss_brood', phase);
        const wig = rm ? 1 : 1 + Math.sin(v.bob * 2.2) * 0.03;
        c.setScale(v.facing * wig, 1 / wig);
        v.shadow?.setPosition(px, py + 2);
        depthY = py + 4;
      } else {
        const img = v.obj as Phaser.GameObjects.Image;
        const moving = e.state === 'approach' || e.state === 'fleeing' || e.state === 'spawn' || e.state === 'planting';
        const bobY = moving && !rm ? Math.abs(Math.sin(v.bob * 2.2)) * (v.type === 'crawler' ? 0.8 : 1.6) : 0;
        img.setPosition(px, py - bobY);
        img.setFlipX(v.facing < 0);
        if (v.type === 'crawler') {
          const w = rm ? 0 : Math.sin(v.bob * 3.2) * 0.035;
          img.setScale(TEX_SCALE * (1 + w), TEX_SCALE * (1 - w * 0.8));
        } else {
          const sq = moving && !rm ? Math.abs(Math.sin(v.bob * 2.2)) * 0.06 : 0;
          img.setScale(TEX_SCALE * (1 + sq * 0.5), TEX_SCALE * (1 - sq));
        }
        v.shadow?.setPosition(px, py + 1).setScale(TEX_SCALE * (v.type === 'crawler' ? 1.1 : 0.6) * (1 - bobY * 0.05));
        if (e.state === 'attack' && !rm) {
          const lunge = Math.abs(Math.sin(v.bob * 2)) * 2;
          img.setY(py - lunge);
        }
      }
      v.obj.setDepth(depthY);
      if (v.shadow) v.shadow.setDepth(py);

      // status tints / flash
      const flashing = nowMs < v.flashUntil;
      for (let i = 0; i < v.parts.length; i++) {
        const p = v.parts[i];
        if (flashing) { if (v.type.startsWith("boss_")) p.setTint(0xffb8b8); else p.setTintFill(0xffffff); }
        else if (e.stunned > 0) p.setTint(Math.floor(nowMs / 80) % 2 ? 0x9fd8ff : 0xffffff);
        else if (e.burning > 0) p.setTint(0xffb080);
        else if (v.baseTints[i] !== -1) p.setTint(v.baseTints[i]);
        else p.clearTint();
      }
      if (e.burning > 0 && Math.random() < dt * 8 * this.settings.particleMul) this.fx.fireP(px + (Math.random() - 0.5) * 10, py - 8, 1);

      // hp bars
      if (e.hp < e.maxHp && e.maxHp > 0) {
        const boss = v.type.startsWith('boss_');
        const w = boss ? 70 : 16, h = boss ? 4 : 2;
        const top = def.layer === 'air' ? py - AIR_ALT - 16 : py - (boss ? 60 : 18) - def.radius * 0.4;
        const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
        hp.fillStyle(0x0b0e1a, 0.75); hp.fillRect(px - w / 2 - 1, top - 1, w + 2, h + 2);
        hp.fillStyle(boss ? 0xb98fe8 : ratio > 0.5 ? 0xe86f6f : 0xff4040, 1); hp.fillRect(px - w / 2, top, w * ratio, h);
        if (boss) {
          hp.lineStyle(1, 0xffffff, 0.5);
          for (let i = 1; i < 4; i++) hp.lineBetween(px - w / 2 + (w * i) / 4, top, px - w / 2 + (w * i) / 4, top + h);
        }
      }
      // boss label
      if (state.boss?.active && state.boss.enemyId === e.id) {
        bossShown = true;
        const top = py - (v.type === 'boss_maw' ? 90 : 70);
        const txt = `${def.name.toUpperCase()}  ·  PHASE ${Math.max(1, (e.phase | 0) + 1)}`;
        const col = cssColor(def.color);
        if (this.bossLabel.text !== txt) this.bossLabel.setText(txt);
        if (this.bossLabel.getData('col') !== col) { this.bossLabel.setColor(col); this.bossLabel.setData('col', col); }
        this.bossLabel.setVisible(true).setPosition(px, top);
      }
    }
    if (!bossShown) this.bossLabel.setVisible(false);

    // remove views whose enemy vanished from the state
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      if (!v.dying) { v.dying = true; v.dieT0 = nowMs - 600; }
      const t = (nowMs - v.dieT0) / 900;
      if (t >= 1) { this.release(v); this.views.delete(id); this.positions.delete(id); }
      else { v.obj.setAlpha(1 - t); }
    }
  }
}
