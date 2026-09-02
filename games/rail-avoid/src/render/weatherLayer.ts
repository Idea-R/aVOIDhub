/**
 * Screen-space weather: rain streaks, fog blobs, storm flashes, ashfall flakes.
 * Everything here lives in the scene's screen-space Container (GameScene.screenRoot), which is
 * counter-transformed every frame so 1 unit == 1 screen px regardless of camera zoom/rotation.
 */
import Phaser from 'phaser';
import type { SimState } from '../core/types';
import type { RenderSettings } from './settings';

/** Wrap a Rectangle as a particle RandomZoneSource (keeps the reference so resize() can mutate it). */
function zoneSource(rect: Phaser.Geom.Rectangle): Phaser.Types.GameObjects.Particles.RandomZoneSource {
  return { getRandomPoint: (point) => { rect.getRandomPoint(point as Phaser.Geom.Point); } };
}

export class WeatherLayer {
  private rainZone: Phaser.Geom.Rectangle;
  private ashZone: Phaser.Geom.Rectangle;
  private rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private ash: Phaser.GameObjects.Particles.ParticleEmitter;
  private fog: Phaser.GameObjects.Image[] = [];
  private flash: Phaser.GameObjects.Rectangle;
  private flashAlpha = 0;
  private flashHold = 0;
  private stormTimer = 0;
  private w = 1280;
  private h = 720;
  private settings: RenderSettings;

  constructor(private scene: Phaser.Scene, private layer: Phaser.GameObjects.Container, settings: RenderSettings) {
    this.settings = settings;
    this.w = scene.scale.width; this.h = scene.scale.height;
    this.rainZone = new Phaser.Geom.Rectangle(0, -30, this.w + 400, 10);
    this.ashZone = new Phaser.Geom.Rectangle(-50, -20, this.w + 100, 10);
    this.rain = scene.add.particles(0, 0, 'streak', {
      emitZone: { type: 'random', source: zoneSource(this.rainZone) },
      speedY: { min: 900, max: 1250 }, speedX: { min: -260, max: -200 }, lifespan: 1600,
      alpha: { start: 0.55, end: 0.25 }, scale: { min: 0.5, max: 0.9 }, tint: 0xbfd4f0, rotate: 12,
      frequency: 18, quantity: 4, emitting: false, maxAliveParticles: 700,
    });
    this.ash = scene.add.particles(0, 0, 'flake', {
      emitZone: { type: 'random', source: zoneSource(this.ashZone) },
      speedY: { min: 35, max: 80 }, speedX: { min: -25, max: 25 }, lifespan: 16000,
      alpha: { start: 0.7, end: 0.4 }, scale: { min: 0.35, max: 0.9 }, tint: [0x9a97a6, 0x6d6a75, 0xc4c1cc], rotate: { start: 0, end: 360 },
      frequency: 60, quantity: 2, emitting: false, maxAliveParticles: 500,
    });
    layer.add(this.rain); layer.add(this.ash);
    for (let i = 0; i < 12; i++) {
      const img = scene.add.image(Math.random() * this.w, Math.random() * this.h, 'fog');
      img.setAlpha(0).setTint(0xb8c4d8).setScale(2 + Math.random() * 2.5).setBlendMode(Phaser.BlendModes.SCREEN);
      img.setData('vx', 6 + Math.random() * 10).setData('vy', (Math.random() - 0.5) * 4);
      layer.add(img);
      this.fog.push(img);
    }
    this.flash = scene.add.rectangle(0, 0, this.w, this.h, 0xffffff, 1).setOrigin(0, 0).setAlpha(0);
    layer.add(this.flash);
  }

  setSettings(s: RenderSettings): void { this.settings = s; }

  destroy(): void {
    this.rain.destroy(); this.ash.destroy(); this.flash.destroy();
    for (const f of this.fog) f.destroy();
    this.fog = [];
  }

  resize(w: number, h: number): void {
    this.w = w; this.h = h;
    this.rainZone.setTo(0, -30, w + 400, 10);
    this.ashZone.setTo(-50, -20, w + 100, 10);
    this.flash.setSize(w, h);
    this.flash.setDisplaySize(w, h);
  }

  /** External lightning strike: white screen flash. */
  lightningFlash(strength = 0.55): void {
    if (this.settings.reducedMotion) strength *= 0.4;
    this.flashAlpha = Math.max(this.flashAlpha, strength);
    this.flashHold = 0.08; // hold the full-screen illumination for 80 ms, then decay
  }

  update(state: SimState, dt: number, nowMs: number): void {
    const wth = state.weather;
    const kind = wth?.kind ?? 'clear';
    const intensity = Math.max(0, Math.min(1, wth?.intensity ?? 0));
    const on = this.settings.weather && state.phase !== 'title';
    const mul = this.settings.particleMul * (this.settings.reducedMotion ? 0.6 : 1);

    // rain / storm
    const rainI = on && (kind === 'rain' || kind === 'storm') ? intensity : 0;
    if (rainI > 0.02) {
      const q = Math.max(1, Math.round((kind === 'storm' ? 7 : 4) * rainI * mul * (this.w / 1280)));
      this.rain.setFrequency(kind === 'storm' ? 14 : 20, q);
      this.rain.emitting = true;
      this.rain.setAlpha(0.5 + 0.5 * rainI);
    } else {
      this.rain.emitting = false;
    }
    // ashfall
    const ashI = on && kind === 'ashfall' ? intensity : 0;
    if (ashI > 0.02) {
      this.ash.setFrequency(70, Math.max(1, Math.round(2 * ashI * mul * (this.w / 1280))));
      this.ash.emitting = true;
    } else {
      this.ash.emitting = false;
    }
    // fog
    const fogI = on && kind === 'fog' ? intensity : (on && kind === 'ashfall' ? intensity * 0.35 : 0);
    for (const f of this.fog) {
      const target = fogI * 0.16;
      f.alpha += (target - f.alpha) * Math.min(1, dt * 1.5);
      if (f.alpha < 0.005) { f.setVisible(false); continue; }
      f.setVisible(true);
      if (!this.settings.reducedMotion) {
        f.x += (f.getData('vx') as number) * dt;
        f.y += (f.getData('vy') as number) * dt;
      }
      if (f.x > this.w + 300) f.x = -300;
      if (f.y > this.h + 200) f.y = -200;
      if (f.y < -300) f.y = this.h + 200;
    }
    // storm periodic flicker
    if (on && kind === 'storm' && intensity > 0.4) {
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        this.stormTimer = 5 + Math.random() * 9;
        this.flashAlpha = Math.max(this.flashAlpha, this.settings.reducedMotion ? 0.06 : 0.16);
      }
    }
    // flash decay
    if (this.flashAlpha > 0.001) {
      this.flash.setAlpha(this.flashAlpha).setVisible(true);
      if (this.flashHold > 0) this.flashHold -= dt; else this.flashAlpha *= Math.exp(-dt * 9);
    } else {
      this.flash.setVisible(false);
    }
    void nowMs;
  }
}
