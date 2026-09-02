/**
 * The single Phaser scene. Reads ctx.sim.state every frame (never caches the sim instance),
 * rebuilds static layers when the state identity changes, and implements ViewApi.
 * main.ts drives sim.update(); this scene only renders.
 */
import Phaser from 'phaser';
import type { AppContext } from '../app';
import type { SimState, Tile, EnemyType } from '../core/types';
import type { GameEvents } from '../core/events';
import { ISO_Y, MAP_W, MAP_H } from '../core/config';
import { unproject, worldToHex, inBounds, hexToWorld } from '../core/hex';
import { ENEMY_DEFS } from '../core/enemies';
import { generateAllTextures } from './textures';
import { LAYER_DEPTH, settingsForQuality, type RenderSettings, type QualityLevel } from './settings';
import { TerrainLayer, TerrainFx } from './terrain';
import { VoidLayer } from './voidLayer';
import { TrackLayer } from './trackLayer';
import { PlannableLayer } from './plannableLayer';
import { LineLayer } from './lineLayer';
import { SettlementsLayer } from './settlementsLayer';
import { TrainLayer } from './trainLayer';
import { EnemyLayer } from './enemyLayer';
import { ProjectileLayer } from './projectileLayer';
import { LootLayer } from './lootLayer';
import { FxLayer } from './fxLayer';
import { WeatherLayer } from './weatherLayer';
import { OverlayLayer } from './overlayLayer';
import { CameraController } from './cameraController';
import { PerfMonitor } from './perf';
import { CinematicController } from './cinematics';
import { createViewApi } from './viewApi';
import { RESOURCE_COLORS } from './palette';
import { fmtRes, expFactor, lerp, smoothstep, clamp } from './util';
import { ZOOM_MIN, ZOOM_MAX } from './cameraController';

type Unsub = () => void;

/** Value written to `canvas.dataset.cursor`; the DOM UI maps it to a CSS cursor. */
export type CursorKind = 'default' | 'plan' | 'blocked' | 'pointer' | 'grab';

const HOVER_POS_MS = 60;      // position updates while hovering a car / settlement
const HOVER_REFRESH_MS = 100; // re-hit-test with a still pointer (the train moves under it)

export class GameScene extends Phaser.Scene {
  public ctx: AppContext;

  // layers
  public terrainLayer!: Phaser.GameObjects.Layer;
  public decorLayer!: Phaser.GameObjects.Layer;
  public settlementLayer!: Phaser.GameObjects.Layer;
  public shadowLayer!: Phaser.GameObjects.Layer;
  public worldLayer!: Phaser.GameObjects.Layer;
  public projectileLayerObj!: Phaser.GameObjects.Layer;
  public airLayer!: Phaser.GameObjects.Layer;
  public fxLayerObj!: Phaser.GameObjects.Layer;
  /** Screen-space root: counter-transformed every frame so children use screen px (weather, tint, overlays). */
  public screenRoot!: Phaser.GameObjects.Container;

  // subsystems
  public terrain!: TerrainLayer;
  public terrainFx!: TerrainFx;
  public voidL!: VoidLayer;
  public track!: TrackLayer;
  public plannable!: PlannableLayer;
  public lines!: LineLayer;
  public settlements!: SettlementsLayer;
  public train!: TrainLayer;
  public enemies!: EnemyLayer;
  public projectiles!: ProjectileLayer;
  public loot!: LootLayer;
  public fx!: FxLayer;
  public weather!: WeatherLayer;
  public overlay!: OverlayLayer;
  public cameraCtl!: CameraController;
  public cine!: CinematicController;
  public perfMon = new PerfMonitor();
  private postFxOn = false;
  private punchT = -1;
  private punchBase = 1;
  private punchPower = 0;
  // expedition: the world camera drifts slowly and darkens under the DOM scene, then restores
  private expT = 0;
  private expDrift = 0;
  private expBase: { zoom: number; following: boolean } | null = null;

  // state tracking
  private lastSim: unknown = null;
  private lastSeed = NaN;
  private lastTiles: unknown = null;
  private needSnap = true;
  private boundBus: unknown = null;
  private unsubs: Unsub[] = [];
  private settingsUnsub: Unsub | null = null;

  public settings: RenderSettings;
  public qualityMode: 'auto' | QualityLevel = 'auto';
  public selectedCar = -1;
  public cursor: [number, number] | null = null;
  private lastHoverEmit = 0;
  private lastHoverKey = '';
  // pointer hover state (cars → settlements → hex)
  public hoverCar = -1;
  public hoverSettlement: string | null = null;
  private lastPointer: { x: number; y: number } | null = null;
  private pointerDirty = false;
  private lastHoverRefresh = -1;
  private lastHoverPosEmit = -1;
  private lastDragging = false;
  private cursorKind: CursorKind | '' = '';
  public visibleCount = 0;
  private ready = false;

  constructor(ctx: AppContext) {
    super({ key: 'game' });
    this.ctx = ctx;
    this.settings = settingsForQuality('high', false, true);
  }

  // ----------------------------------------------------------------------------- lifecycle
  create(): void {
    try { generateAllTextures(this); } catch (e) { console.error('[render] textures', e); }
    this.readInitialSettings();

    const L = (depth: number) => { const l = this.add.layer(); l.setDepth(depth); return l; };
    this.terrainLayer = L(LAYER_DEPTH.terrain);
    this.decorLayer = L(LAYER_DEPTH.decor);
    this.settlementLayer = L(LAYER_DEPTH.settlements);
    this.shadowLayer = L(LAYER_DEPTH.shadows);
    this.worldLayer = L(LAYER_DEPTH.world);
    this.projectileLayerObj = L(LAYER_DEPTH.projectiles);
    this.airLayer = L(LAYER_DEPTH.air);
    this.fxLayerObj = L(LAYER_DEPTH.fx);
    this.screenRoot = this.add.container(0, 0).setScrollFactor(0).setDepth(LAYER_DEPTH.weather);

    this.fx = new FxLayer(this, this.fxLayerObj, this.settings);
    this.terrain = new TerrainLayer(this, this.terrainLayer, this.decorLayer);
    this.terrainFx = new TerrainFx(this, LAYER_DEPTH.decor + 1);
    this.voidL = new VoidLayer(this, LAYER_DEPTH.void, this.fx, this.settings);
    this.track = new TrackLayer(this, LAYER_DEPTH.track, LAYER_DEPTH.trackPulse);
    this.plannable = new PlannableLayer(this, LAYER_DEPTH.plannable);
    // line hover sits just above the track bake; junction signage floats above the y-sorted world
    this.lines = new LineLayer(this, LAYER_DEPTH.trackPulse + 0.3, LAYER_DEPTH.projectiles - 10);
    this.settlements = new SettlementsLayer(this, this.settlementLayer, this.fx, this.settings);
    this.train = new TrainLayer(this, this.worldLayer, this.fx, this.settings);
    this.enemies = new EnemyLayer(this, this.worldLayer, this.airLayer, this.shadowLayer, this.fx, this.settings);
    this.projectiles = new ProjectileLayer(this, this.projectileLayerObj);
    this.projectiles.onEnemyShot = (x, y) => { this.enemies.onEnemyShot(x, y); };
    this.loot = new LootLayer(this, this.worldLayer, this.shadowLayer, this.fx, this.settings,
      i => this.train.carPos(i), () => this.currentState()?.train?.cars?.length ?? 0);
    this.weather = new WeatherLayer(this, this.screenRoot, this.settings);
    this.overlay = new OverlayLayer(this, this.screenRoot);
    this.cameraCtl = new CameraController(this, {
      onClick: (x, y) => this.handleClick(x, y),
      onHover: (x, y) => this.handleHover(x, y),
      onLeave: () => this.handleLeave(),
    });
    this.cameras.main.setBackgroundColor('#0b0e1a');
    this.cameras.main.setRoundPixels(true);
    // the DOM UI owns the pointer look via canvas[data-cursor]; make sure Phaser never sets an inline cursor
    try { this.input.setDefaultCursor(''); this.game.canvas.style.cursor = ''; } catch { /* ignore */ }
    this.setCursor('default');
    this.cine = new CinematicController({
      scene: this,
      locoProjected: () => { const l = this.locoWorld(); return l ? { x: l.x, y: l.y * ISO_Y } : null; },
      voidFrontProjected: () => {
        const st = this.currentState(); const l = this.locoWorld();
        if (!st || !l || !st.void?.front?.length) return null;
        const row = Math.max(0, Math.min(st.void.front.length - 1, Math.round(l.y / (Math.sqrt(3) * 34))));
        const fx = st.void.front[row];
        return { x: Number.isFinite(fx) ? fx : l.x - 400, y: l.y * ISO_Y };
      },
      reducedMotion: () => this.settings.reducedMotion,
      shake: p => this.shake(p),
      setFollowing: on => { this.cameraCtl.following = on; },
    });
    this.applyPostFx();
    this.overlay.setGrain(this.settings.quality === 'high' && this.settings.glow);

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.teardown());
    this.events.once('destroy', () => this.teardown());

    this.bindBus();
    this.bindSettings();

    // expose ViewApi
    try {
      this.ctx.view = createViewApi(this);
      window.dispatchEvent(new CustomEvent('railavoid:viewready', { detail: { view: this.ctx.view } }));
    } catch (e) { console.error('[render] view api', e); }
    // hide boot splash
    try {
      const boot = document.getElementById('boot');
      if (boot) { boot.style.transition = 'opacity 0.4s'; boot.style.opacity = '0'; setTimeout(() => boot.remove(), 450); }
    } catch { /* ignore */ }
    this.ready = true;
  }

  private teardown(): void {
    for (const u of this.unsubs) { try { u(); } catch { /* ignore */ } }
    this.unsubs = [];
    this.boundBus = null;
    if (this.settingsUnsub) { try { this.settingsUnsub(); } catch { /* ignore */ } this.settingsUnsub = null; }
    try { this.scale.off('resize', this.onResize, this); } catch { /* ignore */ }
    try { this.cameraCtl?.destroy(); } catch { /* ignore */ }
    if (this.ctx.view && (this.ctx.view as unknown as { __scene?: unknown }).__scene === this) this.ctx.view = null;
  }

  private readInitialSettings(): void {
    let reduced = false, shake = true, quality: 'auto' | QualityLevel = 'auto';
    try {
      const s = this.ctx.settings?.get?.();
      if (s) { reduced = !!s.reducedMotion; shake = s.screenShake !== false; quality = s.quality ?? 'auto'; }
    } catch { /* ignore */ }
    this.qualityMode = quality;
    this.settings = settingsForQuality(quality === 'auto' ? 'high' : quality, reduced, shake);
  }

  private bindSettings(): void {
    try {
      const st = this.ctx.settings;
      if (st && typeof st.onChange === 'function') {
        this.settingsUnsub = st.onChange(s => {
          try {
            if (!s) return;
            const q = s.quality ?? 'auto';
            if (q !== this.qualityMode) this.setQuality(q);
            this.applySettings({ reducedMotion: !!s.reducedMotion, screenShake: s.screenShake !== false });
          } catch (e) { console.warn('[render] settings change', e); }
        });
      }
    } catch { /* ignore */ }
  }

  /** Camera-level post FX (bloom + vignette) on WebGL only; off at 'low' quality. */
  private applyPostFx(): void {
    const cam = this.cameras.main;
    const want = this.settings.glow && this.settings.quality !== 'low' && this.renderer.type === Phaser.WEBGL;
    if (want === this.postFxOn) return;
    try {
      cam.postFX.clear();
      if (want) {
        cam.postFX.addBloom(0xffffff, 1, 1, 1.4, 0.3, 3);
        cam.postFX.addVignette(0.5, 0.5, 0.95, 0.25);
      }
      this.postFxOn = want;
    } catch (e) { console.warn('[render] postFX unavailable', e); this.postFxOn = false; }
  }

  /** Brief camera zoom punch (big explosions). */
  public zoomPunch(power: number): void {
    if (!this.settings.screenShake || this.settings.reducedMotion || this.settings.quality === 'low' || this.cine.isPlaying() || this.expBase) return;
    if (this.punchT >= 0) return;
    this.punchT = 0;
    this.punchBase = this.cameras.main.zoom;
    this.punchPower = Math.max(0.02, Math.min(0.12, power));
  }
  private updatePunch(dt: number): void {
    if (this.punchT < 0) return;
    const cam = this.cameras.main;
    this.punchT += dt;
    const D = 0.28;
    if (this.punchT >= D || this.cine.isPlaying()) { cam.setZoom(this.punchBase); this.punchT = -1; return; }
    cam.setZoom(this.punchBase * (1 + this.punchPower * Math.sin(Math.PI * this.punchT / D)));
  }

  /**
   * Expedition phase: the world camera drifts slowly around the locomotive, eases in a touch of zoom
   * and the overlay darkens (the DOM expedition scene sits on top). Everything eases back on exit and
   * the previous zoom / follow state is restored. Returns true while it owns the camera.
   */
  private updateExpedition(state: SimState, loco: { x: number; y: number } | null, dt: number): boolean {
    const active = state.phase === 'expedition';
    const cam = this.cameras.main;
    if (active && !this.expBase) { this.expBase = { zoom: cam.zoom, following: this.cameraCtl.following }; this.expDrift = Math.random() * 6.28; }
    const target = active ? 1 : 0;
    const k = expFactor(active ? 1.6 : 2.4, dt);
    this.expT += (target - this.expT) * k;
    if (Math.abs(this.expT - target) < 0.004) this.expT = target;
    this.overlay.setDim(0.45 * smoothstep(this.expT));
    const base = this.expBase;
    if (!base) return false;
    if (!active && this.expT <= 0) {
      cam.setZoom(clamp(base.zoom, ZOOM_MIN, ZOOM_MAX));
      this.cameraCtl.following = base.following;
      this.expBase = null;
      return false;
    }
    const rm = this.settings.reducedMotion;
    if (!rm) this.expDrift += dt;
    const e = smoothstep(this.expT);
    const dx = (Math.sin(this.expDrift * 0.21) * 64 + Math.sin(this.expDrift * 0.07) * 40) * e;
    const dy = (Math.cos(this.expDrift * 0.16) * 34) * e;
    cam.setZoom(clamp(lerp(base.zoom, base.zoom * 1.12, e), ZOOM_MIN, ZOOM_MAX));
    const c = loco ? { x: loco.x, y: loco.y * ISO_Y } : { x: cam.midPoint.x, y: cam.midPoint.y };
    this.cameraCtl.follow(c.x + dx, c.y + dy, dt);
    return true;
  }

  /** Keep the screen-space root aligned with the viewport regardless of camera zoom/rotation. */
  private updateScreenRoot(): void {
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height, z = cam.zoom || 1, rot = ((cam as unknown as { rotation?: number }).rotation) || 0;
    const cx = w / 2, cy = h / 2;
    const c = Math.cos(-rot), s = Math.sin(-rot);
    const ix = (c * cx - s * cy) / z, iy = (s * cx + c * cy) / z;
    this.screenRoot.setPosition(cx - ix, cy - iy).setRotation(-rot).setScale(1 / z);
  }

  public applySettings(patch: Partial<RenderSettings>): void {
    const prevDensity = this.settings.decorDensity;
    const prevLive = this.settings.quality === 'high';
    this.settings = { ...this.settings, ...patch };
    this.applyPostFx();
    this.fx.setSettings(this.settings);
    this.train.setSettings(this.settings);
    this.enemies.setSettings(this.settings);
    this.loot.setSettings(this.settings);
    this.weather.setSettings(this.settings);
    this.voidL.setSettings(this.settings);
    this.settlements.setSettings(this.settings);
    this.overlay.setGrain(this.settings.quality === 'high' && this.settings.glow);
    const live = this.settings.quality === 'high';
    if (Math.abs(prevDensity - this.settings.decorDensity) > 0.01 || live !== prevLive) {
      const state = this.currentState();
      if (state) { try { this.terrain.build(state, this.settings.decorDensity, live); } catch (e) { console.warn('[render] terrain rebuild', e); } }
    }
  }

  public setQuality(q: 'auto' | QualityLevel): void {
    this.qualityMode = q;
    this.perfMon.reset();
    const level: QualityLevel = q === 'auto' ? 'high' : q;
    const s = settingsForQuality(level, this.settings.reducedMotion, this.settings.screenShake);
    this.applySettings(s);
  }

  // ----------------------------------------------------------------------------- bus
  private bindBus(): void {
    const bus = this.ctx.bus ?? this.ctx.sim?.bus;
    if (!bus || bus === this.boundBus) return;
    for (const u of this.unsubs) { try { u(); } catch { /* ignore */ } }
    this.unsubs = [];
    this.boundBus = bus;
    const on = <K extends keyof GameEvents>(name: K, h: (p: GameEvents[K]) => void) => {
      try {
        this.unsubs.push(bus.on(name, (p: GameEvents[K]) => { try { h(p); } catch (e) { console.warn('[render] handler', name, e); } }));
      } catch (e) { console.warn('[render] bus.on failed', name, e); }
    };
    const now = () => this.time.now;
    const rm = () => this.settings.reducedMotion;

    on('weapon:fire', p => {
      if (!p) return;
      if (this.settings.glow && p.kind !== 'marines') {
        const lc = p.kind === 'tesla' ? 0x8fd3ff : p.kind === 'flame' ? 0xff8a3a : 0xffd080;
        this.fx.lightP(p.x, p.y * ISO_Y - 8, lc, p.kind === 'cannon' ? 46 : 30, p.kind === 'cannon' ? 120 : 80);
      }
      switch (p.kind) {
        case 'gatling': this.fx.tracer(p.x, p.y, p.tx, p.ty); this.fx.muzzle(p.x, p.y, 0xffe8a0, 4); break;
        case 'cannon': this.fx.muzzle(p.x, p.y, 0xffc070, 7); this.fx.puff(p.x, p.y, 0xc8c8d0, 12); this.shake(0.15); break;
        case 'flak': this.fx.muzzle(p.x, p.y, 0xffe090, 4); break;
        case 'tesla': this.fx.muzzle(p.x, p.y, 0x8fd3ff, 6); break;
        case 'flame': this.fx.flameCone(p.x, p.y, p.tx, p.ty); break;
        case 'marines': this.fx.sparks(p.x, p.y, 2, 0xfff0c0); break;
      }
    });
    on('tesla:chain', p => { if (p?.points) this.fx.teslaChain(p.points); });
    on('projectile:explode', p => {
      if (!p) return;
      const r = Number.isFinite(p.radius) ? p.radius : 30;
      if (p.kind === 'reactor') { this.fx.explosion(p.x, p.y, r, true); this.shake(1); this.zoomPunch(0.08); }
      else if (p.kind === 'flak') { this.fx.puff(p.x, p.y, 0xffe0a0, r * 0.5); this.fx.sparks(p.x, p.y, 4, 0xffe090); }
      else { this.fx.ring(p.x, p.y, r, 0xffb060, 300, 2); this.fx.sparks(p.x, p.y, 8, 0xffc870); this.fx.puff(p.x, p.y, 0x9a9aa8, r * 0.6); }
    });
    on('enemy:hit', p => { if (p) this.enemies.onHit(p.id, p.x, p.y, !!p.immune, now()); });
    on('enemy:died', p => { if (p) { this.enemies.onDied(p.id, p.type, p.x, p.y, now()); if (p.type.startsWith('boss_')) this.fx.bossDeath(p.x, p.y, ENEMY_DEFS[p.type]?.color ?? 0xffffff); } });
    on('enemy:spawn', p => { if (p) this.enemies.onSpawn(p.id, p.type, p.x, p.y); });
    on('enemy:ram', p => { if (p) { this.fx.sparks(p.x, p.y, 10, 0xffd080); this.shake(0.35); } });
    on('enemy:boarded', p => { if (!p) return; const c = this.train.carPos(p.carIndex); if (c) this.fx.sparksP(c.x, c.y - 10, 4, 0xff8080); });
    on('sapper:planted', p => { if (p) { const w = hexToWorld(p.col, p.row); this.fx.ring(w.x, w.y, 24, 0x60c0a0, 500, 1.5); } });
    on('sapper:detonate', p => { if (p) { this.fx.explosion(p.x, p.y, 70, true); this.shake(0.8); this.zoomPunch(0.06); } });
    on('sapper:defused', p => { if (p) { const w = hexToWorld(p.col, p.row); this.fx.floatText(w.x, w.y, 'DEFUSED', 0x8fe0a0, 10); this.fx.sparks(w.x, w.y, 6, 0x8fe0a0); } });
    on('rift:open', p => { if (p) { this.fx.shockwave(p.x, p.y, 160); this.shake(0.5); } });
    on('void:consume', p => { if (p) { const w = hexToWorld(p.col, p.row); this.fx.implosion(w.x, w.y); } });
    on('settlement:reached', p => {
      if (!p) return;
      const s = this.ctx.sim?.settlementById?.(p.id);
      if (!s) return;
      const w = hexToWorld(s.col, s.row);
      this.fx.celebrate(w.x, w.y);
      this.fx.floatText(w.x, w.y - 10, String(p.name ?? s.name).toUpperCase(), 0xffffff, 12, 40);
    });
    on('settlement:consumed', p => {
      if (!p) return;
      const s = this.ctx.sim?.settlementById?.(p.id);
      if (!s) return;
      const w = hexToWorld(s.col, s.row);
      this.fx.implosion(w.x, w.y);
      this.fx.floatText(w.x, w.y, 'LOST', 0xb98fe8, 11);
    });
    on('resource:change', p => {
      if (!p || !Number.isFinite(p.delta) || Math.abs(p.delta) < 0.5) return;
      let x = p.x, y = p.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        const lp = this.locoWorld(); if (!lp) return; x = lp.x; y = lp.y;
      }
      if (p.delta < 0 && Math.abs(p.delta) < 3) return; // don't spam small drains
      this.fx.floatText(x!, y!, fmtRes(p.key, p.delta), RESOURCE_COLORS[p.key] ?? 0xffffff, 10);
    });
    on('passengers:board', p => { if (p && p.count > 0) { const lp = this.locoWorld(); if (lp) this.fx.floatText(lp.x, lp.y, `+${p.count} passengers`, 0xd6b4f0, 10); } });
    on('ui:shake', p => this.shake(p?.power ?? 0.5));
    on('ui:flash', p => { if (p) this.overlay.screenFlash(p.color ?? 0xffffff, p.alpha ?? 0.4); });
    on('train:detach', p => { if (p) this.train.onDetach(p.count); });
    on('train:split', () => { this.overlay.screenFlash(0xffffff, 0.45); this.shake(0.7); });
    on('car:destroyed', p => { if (p) { this.train.onDestroyed(p.x, p.y, !!p.explode); this.shake(p.explode ? 1 : 0.5); this.zoomPunch(p.explode ? 0.1 : 0.05); } });
    on('train:damage', p => {
      if (!p || !Number.isFinite(p.amount) || p.amount < 1) return;
      if (p.source === 'heat' || p.source === 'fire' || p.source === 'boarder') { if (Math.random() > 0.15) return; }
      this.fx.floatText(p.x, p.y, `-${Math.round(p.amount)}`, 0xff7070, 10, 26);
      if (p.source === 'ram' || p.source === 'shell') this.fx.sparks(p.x, p.y, 5, 0xffd080);
    });
    on('lightning', p => { if (p) { this.fx.lightning(p.x, p.y); this.weather.lightningFlash(0.5); this.shake(0.3); } });
    on('car:fire', p => { if (p?.on) { const c = this.train.carPos(p.carIndex); if (c) this.fx.fireP(c.x, c.y - 10, 6); } });
    on('car:repaired', p => { if (!p) return; const c = this.train.carPos(p.carIndex); if (c) this.fx.sparksP(c.x, c.y - 8, 5, 0x8fe0a0); });
    on('boss:spawn', p => { if (p) { this.overlay.screenFlash(0x6d5fd6, 0.35); this.shake(0.6); } });
    on('boss:phase', p => { this.overlay.screenFlash(0xffffff, 0.25); this.shake(0.4); if (p) this.enemies.onBossPhase(p.type, p.phase); });
    on('boss:died', p => {
      this.overlay.screenFlash(0xffffff, 0.6); this.shake(1); this.zoomPunch(0.1);
      const st = this.currentState();
      const e = st?.enemies?.find(en => en.type === p?.type);
      if (e && p) this.fx.bossDeath(e.x, e.y, ENEMY_DEFS[p.type]?.color ?? 0xffffff);
    });
    on('gate:open', () => { this.overlay.screenFlash(0xe8c170, 0.5); });
    on('run:start', () => { this.needSnap = true; this.cameraCtl.following = true; this.selectedCar = -1; });
    on('run:loaded', () => { this.needSnap = true; this.cameraCtl.following = true; this.selectedCar = -1; });
    on('track:planned', p => { if (p) { const w = hexToWorld(p.col, p.row); this.fx.ring(w.x, w.y, 20, 0x6fb7e8, 260, 1.5); } });
    on('track:blocked', () => { const lp = this.locoWorld(); if (lp) this.fx.floatText(lp.x, lp.y, 'BLOCKED', 0xe86f6f, 10); });
    // loot / elites / relics / bounties
    on('loot:drop', p => { if (p) this.loot.onDrop(p.id, p.kind, p.x, p.y); });
    on('loot:pickup', p => { if (p) this.loot.onPickup(p.id, p.kind, p.x, p.y); });
    on('loot:expire', p => { if (p) this.loot.onExpire(p.id); });
    on('enemy:elite', p => { if (p) this.enemies.onElite(p.id); });
    on('relic:taken', () => { const lp = this.locoWorld(); if (lp) { this.fx.relicPulse(lp.x, lp.y); if (this.settings.glow) this.fx.lightP(lp.x, lp.y * ISO_Y - 10, 0xe8c170, 70, 380); } });
    on('bounty:done', p => {
      const lp = this.locoWorld(); if (!lp) return;
      this.fx.bountyBurst(lp.x, lp.y);
      const r = p?.reward;
      if (r && Number.isFinite(r.marks) && r.marks > 0) this.fx.floatText(lp.x, lp.y - 14, `+${r.marks} marks`, 0xc9a0ff, 11, 40);
    });
    void rm;
  }

  private shake(power: number): void {
    if (!this.settings.screenShake || this.settings.reducedMotion) return;
    const p = Math.max(0, Math.min(1.5, power));
    try { this.cameras.main.shake(140 + p * 220, 0.0035 * p, false); } catch { /* ignore */ }
  }

  // ----------------------------------------------------------------------------- helpers
  public currentState(): SimState | null {
    try {
      const s = this.ctx.sim?.state;
      if (s && Array.isArray(s.tiles)) return s;
    } catch { /* ignore */ }
    return null;
  }

  /** Unprojected loco position. */
  public locoWorld(): { x: number; y: number } | null {
    const st = this.currentState();
    if (!st) return null;
    const t = st.train;
    if (t && t.trailX && Number.isFinite(t.trailX[0]) && Number.isFinite(t.trailY[0])) return { x: t.trailX[0], y: t.trailY[0] };
    try { const p = this.ctx.sim.locoPos(); if (p && Number.isFinite(p.x)) return p; } catch { /* ignore */ }
    return null;
  }

  public screenToHex(sx: number, sy: number): [number, number] | null {
    const st = this.currentState();
    if (!st) return null;
    const w = this.cameras.main.getWorldPoint(sx, sy);
    const u = unproject(w.x, w.y);
    const [c, r] = worldToHex(u.x, u.y);
    if (!inBounds(c, r, st.mapW || MAP_W, st.mapH || MAP_H)) return null;
    return [c, r];
  }

  public worldToScreen(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    const px = x, py = y * ISO_Y;
    return { x: (px - cam.worldView.x) * cam.zoom, y: (py - cam.worldView.y) * cam.zoom };
  }

  public planEnd(): [number, number] | null {
    const st = this.currentState();
    const p = st?.route?.path;
    if (!p || !p.length) return null;
    const e = p[p.length - 1];
    return [e[0], e[1]];
  }

  // ----------------------------------------------------------------------------- input
  private handleClick(sx: number, sy: number): void {
    const st = this.currentState();
    if (!st) return;
    const bus = this.ctx.bus;
    const cam = this.cameras.main;
    const wp = cam.getWorldPoint(sx, sy);
    const radius = 22 / cam.zoom;
    // 1) train car
    const ci = this.train.hitTest(wp.x, wp.y, radius);
    if (ci >= 0) {
      this.selectedCar = ci;
      try { bus.emit('ui:selectCar', { index: ci }); } catch { /* ignore */ }
      return;
    }
    // 2) junction signage (label / chevron corridor) → plan the first tile of that branch
    const jo = this.lines.hitTest(wp.x, wp.y, cam.zoom);
    if (jo) {
      try { this.ctx.sim.planTile(jo.option.col, jo.option.row); } catch (e) { console.warn('[render] junction plan failed', e); }
      return;
    }
    // 3) settlement marker
    const sid = this.settlements.hitTest(wp.x, wp.y, 16 / cam.zoom);
    if (sid) {
      try { bus.emit('ui:selectSettlement', { id: sid }); } catch { /* ignore */ }
      return;
    }
    // 4) tile planning
    const hex = this.screenToHex(sx, sy);
    if (!hex) return;
    this.planHex(hex[0], hex[1]);
  }

  public planHex(col: number, row: number): void {
    const sim = this.ctx.sim;
    if (!sim) return;
    const tile: Tile | null = sim.tileAt(col, row);
    if (!tile) return;
    try {
      if (this.plannable.isPlannable(col, row)) { sim.planTile(col, row); return; }
      if (tile.void || tile.terrain === 'mountain') return;
      sim.planPathTo(col, row);
    } catch (e) { console.warn('[render] plan failed', e); }
  }

  private handleHover(sx: number, sy: number): void {
    this.lastPointer = { x: sx, y: sy };
    this.pointerDirty = true;
    this.pointerMoved = true;
  }
  private pointerMoved = false;

  /**
   * One hover pass (at most once per frame): hit-test train cars → settlement markers → hex tile,
   * emit ui:hoverCar / ui:hoverSettlement on change (+ position updates every 60 ms), keep the
   * throttled ui:hoverTile behaviour for tiles (suppressed while a car / settlement is hovered)
   * and set the canvas cursor state in the same pass.
   */
  private refreshHover(now: number): void {
    const p = this.lastPointer;
    const st = this.currentState();
    const dragging = this.cameraCtl.isDragging;
    this.lastDragging = dragging;
    if (!p || !st || !this.cameraCtl.pointerOver) { this.clearHover(); this.setCursor(dragging ? 'grab' : 'default'); return; }
    const cam = this.cameras.main;
    const zoom = cam.zoom || 1;
    const wp = cam.getWorldPoint(p.x, p.y);
    const interactive = !dragging && !this.cine.isPlaying() && st.phase !== 'title';
    let car = -1, sid: string | null = null, jopt = -1;
    if (interactive) {
      car = this.train.hitTest(wp.x, wp.y, Math.max(16, 22 / zoom));
      if (car < 0) { const jo = this.lines.hitTest(wp.x, wp.y, zoom); if (jo) jopt = jo.index; }
      if (car < 0 && jopt < 0) sid = this.settlements.hoverHitTest(wp.x, wp.y, 14 / zoom);
    }
    this.lines.setHoverOption(jopt);
    const hex = interactive ? this.screenToHex(p.x, p.y) : null;
    const bus = this.ctx.bus;
    // position updates only when the pointer actually moved, at most every 60 ms
    const posDue = this.pointerMoved && now - this.lastHoverPosEmit >= HOVER_POS_MS;
    let emitted = false;
    // --- cars ---
    if (car !== this.hoverCar) {
      this.hoverCar = car;
      try { bus?.emit('ui:hoverCar', { index: car, x: p.x, y: p.y }); } catch { /* ignore */ }
      emitted = true;
    } else if (car >= 0 && posDue) {
      try { bus?.emit('ui:hoverCar', { index: car, x: p.x, y: p.y }); } catch { /* ignore */ }
      emitted = true;
    }
    // --- settlements ---
    if (sid !== this.hoverSettlement) {
      this.hoverSettlement = sid;
      try { bus?.emit('ui:hoverSettlement', { id: sid, x: p.x, y: p.y }); } catch { /* ignore */ }
      emitted = true;
    } else if (sid && posDue) {
      try { bus?.emit('ui:hoverSettlement', { id: sid, x: p.x, y: p.y }); } catch { /* ignore */ }
      emitted = true;
    }
    if (emitted) { this.lastHoverPosEmit = now; this.pointerMoved = false; }
    this.settlements.setHover(sid);
    // --- hex tile (suppressed while a car / settlement / junction label is hovered) ---
    const suppress = car >= 0 || !!sid || jopt >= 0;
    this.plannable.hovered = suppress ? null : hex;
    if (suppress) {
      if (this.lastHoverKey !== 'none') { this.lastHoverKey = 'none'; this.emitHover(null); }
    } else if (now - this.lastHoverEmit >= 60) {
      const key = hex ? hex[0] + ',' + hex[1] : 'none';
      if (key !== this.lastHoverKey) { this.lastHoverEmit = now; this.lastHoverKey = key; this.emitHover(hex); }
    }
    // --- cursor ---
    this.setCursor(jopt >= 0 && !dragging ? 'pointer' : this.cursorFor(dragging, car, sid, hex));
  }

  private cursorFor(dragging: boolean, car: number, sid: string | null, hex: [number, number] | null): CursorKind {
    if (dragging) return 'grab';
    if (car >= 0 || sid) return 'pointer';
    if (!hex) return 'default';
    const sim = this.ctx.sim;
    if (!sim) return 'default';
    try {
      const tile = sim.tileAt(hex[0], hex[1]);
      if (!tile) return 'default';
      if (tile.void || tile.terrain === 'mountain') return 'blocked';
      if (this.plannable.isPlannable(hex[0], hex[1])) return 'plan';
      const pr = sim.previewPlan(hex[0], hex[1]);
      if (pr?.ok) return 'plan';
      const reason = String(pr?.reason ?? '');
      if (reason && !/not adjacent/i.test(reason)) return 'blocked';
    } catch { /* ignore */ }
    return 'default';
  }

  private setCursor(kind: CursorKind): void {
    if (kind === this.cursorKind) return;
    this.cursorKind = kind;
    try {
      const c = this.game.canvas;
      c.dataset.cursor = kind;
      if (c.style.cursor) c.style.cursor = '';
    } catch { /* ignore */ }
  }

  private clearHover(): void {
    const bus = this.ctx.bus;
    const p = this.lastPointer ?? { x: 0, y: 0 };
    if (this.hoverCar !== -1) { this.hoverCar = -1; try { bus?.emit('ui:hoverCar', { index: -1, x: p.x, y: p.y }); } catch { /* ignore */ } }
    if (this.hoverSettlement !== null) { this.hoverSettlement = null; try { bus?.emit('ui:hoverSettlement', { id: null, x: p.x, y: p.y }); } catch { /* ignore */ } }
    this.settlements.setHover(null);
    this.lines.setHoverOption(-1);
    this.plannable.hovered = null;
    if (this.lastHoverKey !== 'none') { this.lastHoverKey = 'none'; this.emitHover(null); }
  }

  private emitHover(hex: [number, number] | null): void {
    const bus = this.ctx.bus;
    if (!bus) return;
    try {
      if (!hex) { bus.emit('ui:hoverTile', { col: -1, row: -1, cost: 0, free: false, plannable: false }); return; }
      const sim = this.ctx.sim;
      const p = this.plannable.isPlannable(hex[0], hex[1]);
      let cost = 0, free = false, plannable = false;
      if (p) { cost = p.cost; free = p.free; plannable = true; }
      else {
        try { const pr = sim.previewPlan(hex[0], hex[1]); cost = pr?.cost ?? 0; plannable = !!pr?.ok; free = plannable && cost === 0; } catch { /* ignore */ }
      }
      bus.emit('ui:hoverTile', { col: hex[0], row: hex[1], cost, free, plannable });
    } catch { /* ignore */ }
  }

  private handleLeave(): void {
    this.pointerDirty = false;
    this.clearHover();
    this.setCursor('default');
  }

  public moveCursor(dCol: number, dRow: number): void {
    const st = this.currentState();
    if (!st) return;
    if (!this.cursor) this.cursor = this.planEnd() ?? [0, 0];
    const w = st.mapW || MAP_W, h = st.mapH || MAP_H;
    this.cursor = [Math.max(0, Math.min(w - 1, this.cursor[0] + (dCol | 0))), Math.max(0, Math.min(h - 1, this.cursor[1] + (dRow | 0)))];
    this.plannable.cursor = this.cursor;
    this.plannable.showCursor();
  }

  public confirmCursor(): void {
    if (!this.cursor) this.cursor = this.planEnd();
    if (!this.cursor) return;
    this.plannable.cursor = this.cursor;
    this.plannable.showCursor();
    this.planHex(this.cursor[0], this.cursor[1]);
  }

  private onResize(): void {
    try {
      const w = Math.max(1, Math.round(this.scale.width)), h = Math.max(1, Math.round(this.scale.height));
      this.cameras.main.setSize(w, h);
      this.weather.resize(w, h);
      this.overlay.resize(w, h);
      this.cameraCtl.applyBounds();
    } catch (e) { console.warn('[render] resize', e); }
  }
  public refreshLayout(): void {
    try { this.scale.refresh(); } catch { /* ignore */ }
    this.onResize();
  }

  // ----------------------------------------------------------------------------- frame
  update(time: number, delta: number): void {
    if (!this.ready) return;
    const dt = Math.min(0.1, Math.max(0, delta) / 1000);
    this.perfMon.update(delta, time);
    this.autoQuality(time);
    this.bindBus();

    const sim = this.ctx.sim;
    const state = this.currentState();
    if (!sim || !state) { this.fx.update(dt, time); return; }

    // static rebuild detection
    if (sim !== this.lastSim || state.seed !== this.lastSeed || state.tiles !== this.lastTiles || !this.terrain.isBuilt()) {
      this.rebuildStatic(state, sim);
    }

    // viewport sanity: Scale.RESIZE may grow the canvas without our handler having run yet
    if (Math.abs(this.cameras.main.width - this.scale.width) > 1 || Math.abs(this.cameras.main.height - this.scale.height) > 1) this.onResize();

    // camera
    const loco = this.locoWorld();
    if (this.cine.isPlaying()) {
      this.cine.update(dt);
      this.needSnap = false;
    } else if (this.updateExpedition(state, loco, dt)) {
      this.needSnap = false;
    } else if (loco && this.cameraCtl.following) {
      this.cameraCtl.follow(loco.x, loco.y * ISO_Y, dt, this.needSnap);
      this.needSnap = false;
    }
    this.updatePunch(dt);
    this.updateScreenRoot();
    const zoom = this.cameras.main.zoom;
    const rm = this.settings.reducedMotion;
    const tSec = time / 1000;

    // pointer hover / cursor: once per frame when the pointer moved, else every 100 ms (or on drag change)
    if (this.pointerDirty || time - this.lastHoverRefresh > HOVER_REFRESH_MS || this.cameraCtl.isDragging !== this.lastDragging) {
      this.pointerDirty = false;
      this.lastHoverRefresh = time;
      try { this.refreshHover(time); } catch (e) { this.warnOnce('hover', e); }
    }
    // zoom level-of-detail: decor + enemy shadows go away when zoomed far out (train and route always show)
    const detail = zoom >= 0.55;
    try { this.terrain.setDecorVisible(detail); this.shadowLayer.setVisible(detail); } catch (e) { this.warnOnce('lod', e); }

    const view = this.cameras.main.worldView;
    try { this.terrain.update(tSec, view, zoom, this.settings); } catch (e) { this.warnOnce('terrain', e); }
    try { this.terrainFx.update(this.terrain, tSec, view, zoom, this.settings); } catch (e) { this.warnOnce('terrainFx', e); }
    try { this.voidL.update(state, tSec, dt, view); } catch (e) { this.warnOnce('void', e); }
    try { this.track.update(state, tSec, rm, zoom); } catch (e) { this.warnOnce('track', e); }
    try { this.plannable.update(state, sim, time, this.cameraCtl.pointerOver, zoom, rm); } catch (e) { this.warnOnce('plannable', e); }
    try { this.lines.update(state, sim, time, rm, zoom, this.cameraCtl.pointerOver ? this.plannable.hovered : null, dt); } catch (e) { this.warnOnce('lines', e); }
    try { this.settlements.update(state, time, zoom, rm, this.overlay.night, view, loco, dt); } catch (e) { this.warnOnce('settlements', e); }
    try { this.enemies.update(state, dt, time, loco); } catch (e) { this.warnOnce('enemies', e); }
    if (this.selectedCar >= (state.train?.cars?.length ?? 0)) this.selectedCar = -1;
    if (this.hoverCar >= (state.train?.cars?.length ?? 0)) this.hoverCar = -1;
    try { this.train.update(state, dt, time, this.selectedCar, this.overlay.night, zoom, this.enemies.positions, this.hoverCar); } catch (e) { this.warnOnce('train', e); }
    try { this.projectiles.update(state, dt); } catch (e) { this.warnOnce('projectiles', e); }
    try { this.loot.update(state, dt, time); } catch (e) { this.warnOnce('loot', e); }
    try { this.fx.update(dt, time); if (state.phase !== 'title' || true) this.fx.ambient(state.region | 0, view, dt); } catch (e) { this.warnOnce('fx', e); }
    try { this.weather.update(state, dt, time); } catch (e) { this.warnOnce('weather', e); }
    let voidDist = Infinity;
    try { voidDist = sim.voidDistance(); } catch { /* ignore */ }
    let bossScreen: { x: number; y: number } | null = null;
    try {
      const bp = this.enemies.bossPos(state);
      if (bp) { const cam = this.cameras.main; bossScreen = { x: (bp.x - cam.worldView.x) * cam.zoom, y: (bp.y - cam.worldView.y) * cam.zoom }; }
    } catch { /* ignore */ }
    try { this.overlay.update(state, dt, time, voidDist, bossScreen, rm); } catch (e) { this.warnOnce('overlay', e); }

    this.visibleCount = this.countVisible();
  }

  private warned = new Set<string>();
  private warnOnce(what: string, e: unknown): void {
    if (this.warned.has(what)) return;
    this.warned.add(what);
    console.warn('[render] ' + what + ' update failed', e);
  }

  private countVisible(): number {
    let n = 0;
    const layers = [this.terrainLayer, this.decorLayer, this.settlementLayer, this.shadowLayer, this.worldLayer, this.projectileLayerObj, this.airLayer, this.fxLayerObj, this.screenRoot];
    for (const l of layers) {
      const list = l.list;
      for (let i = 0; i < list.length; i++) { const o = list[i] as Phaser.GameObjects.GameObject & { visible?: boolean }; if (o.visible !== false) n++; }
    }
    return n + 6; // graphics on the root display list (void, track, pulse, plannable, tint...)
  }

  private rebuildStatic(state: SimState, sim: unknown): void {
    this.lastSim = sim; this.lastSeed = state.seed; this.lastTiles = state.tiles;
    this.needSnap = true;
    this.selectedCar = -1;
    this.cursor = null;
    this.hoverCar = -1; this.hoverSettlement = null;
    this.warned.clear();
    try { this.terrain.build(state, this.settings.decorDensity, this.settings.quality === 'high'); } catch (e) { console.error('[render] terrain build', e); }
    try { this.settlements.rebuild(state); } catch (e) { console.error('[render] settlements', e); }
    this.track.invalidate();
    this.lines.invalidate();
    this.enemies.clear();
    this.projectiles.clear();
    this.loot.clear();
    this.fx.clear();
    this.train.reset();
    this.expT = 0; this.expBase = null; this.overlay.setDim(0);
    const b = this.terrain.bounds;
    this.cameraCtl.setBounds(b.x0, b.y0, b.x1, b.y1);
    this.track.setBounds(b.x0, b.y0, b.x1, b.y1);
    if (this.cine.isPlaying()) this.cine.skip();
    this.cameraCtl.following = true;
    this.plannable.cursor = null;
    this.plannable.cursorVisible = false;
  }

  private autoQuality(nowMs: number): void {
    if (this.qualityMode !== 'auto') return;
    const fps = this.game.loop.actualFps;
    const step = this.perfMon.autoStep(fps, nowMs);
    if (step === 0) return;
    const order: QualityLevel[] = ['low', 'medium', 'high'];
    const idx = order.indexOf(this.settings.quality);
    const next = order[Math.max(0, Math.min(order.length - 1, idx + step))];
    if (next !== this.settings.quality) {
      this.applySettings(settingsForQuality(next, this.settings.reducedMotion, this.settings.screenShake));
    }
  }

  /** Enemy colour lookup for UI-ish effects. */
  public enemyColor(type: EnemyType): number { return ENEMY_DEFS[type]?.color ?? 0xffffff; }
}
