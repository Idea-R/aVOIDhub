/**
 * Camera choreography for cinematics. The DOM UI draws letterbox bars and title cards; this module
 * only moves the camera and dispatches window CustomEvent 'railavoid:cine'
 * ({ phase: 'start'|'card'|'end', name, title, subtitle }) at the right moments.
 */
import Phaser from 'phaser';
import { ISO_Y } from '../core/config';
import { clamp, smoothstep, lerp } from './util';

export type CineName = 'run_intro' | 'region_enter' | 'boss_intro' | 'victory' | 'defeat';
export interface CineData { title?: string; subtitle?: string; x?: number; y?: number; }

interface Shot {
  name: CineName;
  data: CineData;
  duration: number;
  cardAt: number;
  cardSent: boolean;
  t: number;
  resolve: () => void;
  // captured at start (projected world coords)
  fromX: number; fromY: number; fromZoom: number;
  toX: number; toY: number;
  shakeDone: boolean;
}

export interface CineHost {
  scene: Phaser.Scene;
  locoProjected(): { x: number; y: number } | null;
  voidFrontProjected(): { x: number; y: number } | null;
  reducedMotion(): boolean;
  shake(power: number): void;
  setFollowing(on: boolean): void;
}

export class CinematicController {
  private shot: Shot | null = null;

  constructor(private host: CineHost) {}

  isPlaying(): boolean { return this.shot !== null; }

  play(name: CineName, data: CineData = {}): Promise<void> {
    // a new cinematic replaces the running one (which ends immediately)
    if (this.shot) this.finish();
    const rm = this.host.reducedMotion();
    const cam = this.host.scene.cameras.main;
    const loco = this.host.locoProjected() ?? { x: cam.midPoint.x, y: cam.midPoint.y };
    const durations: Record<CineName, number> = { run_intro: 7, region_enter: 4, boss_intro: 4, victory: 5, defeat: 3 };
    const cards: Record<CineName, number> = { run_intro: 2, region_enter: 0.5, boss_intro: 1.4, victory: 1, defeat: 0.8 };
    const mul = rm ? 0.55 : 1;
    let fromX = cam.midPoint.x, fromY = cam.midPoint.y, fromZoom = cam.zoom;
    let toX = loco.x, toY = loco.y;
    if (name === 'run_intro') {
      const vf = this.host.voidFrontProjected();
      fromX = vf ? vf.x - 80 : loco.x - 500; fromY = loco.y; fromZoom = 0.55;
    } else if (name === 'boss_intro') {
      if (Number.isFinite(data.x) && Number.isFinite(data.y)) { toX = data.x as number; toY = (data.y as number) * ISO_Y; }
      fromX = loco.x; fromY = loco.y;
    } else {
      fromX = loco.x; fromY = loco.y;
    }
    let resolve: () => void = () => {};
    const p = new Promise<void>(r => { resolve = r; });
    this.shot = {
      name, data, duration: durations[name] * mul, cardAt: cards[name] * mul, cardSent: false, t: 0, resolve,
      fromX, fromY, fromZoom, toX, toY, shakeDone: false,
    };
    this.host.setFollowing(false);
    this.dispatch('start');
    this.apply(0);
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
    if (s.name === 'run_intro') cam.setZoom(1.1);
    else if (s.name === 'region_enter' || s.name === 'boss_intro') cam.setZoom(s.fromZoom);
    else if (s.name === 'defeat') cam.setZoom(Math.max(cam.zoom, 1.4));
    this.host.setFollowing(true);
    if (!s.cardSent) { s.cardSent = true; this.dispatch('card', s); }
    this.dispatch('end', s);
    try { s.resolve(); } catch { /* ignore */ }
  }

  private dispatch(phase: 'start' | 'card' | 'end', s: Shot | null = this.shot): void {
    if (!s) return;
    try {
      window.dispatchEvent(new CustomEvent('railavoid:cine', {
        detail: { phase, name: s.name, title: s.data.title, subtitle: s.data.subtitle },
      }));
    } catch { /* ignore */ }
  }

  update(dt: number): void {
    const s = this.shot;
    if (!s) return;
    s.t += dt;
    if (!s.cardSent && s.t >= s.cardAt) { s.cardSent = true; this.dispatch('card'); }
    if (s.t >= s.duration) { this.finish(); return; }
    this.apply(s.t / s.duration);
  }

  private apply(u: number): void {
    const s = this.shot;
    if (!s) return;
    const cam = this.host.scene.cameras.main;
    const rm = this.host.reducedMotion();
    const loco = this.host.locoProjected() ?? { x: s.fromX, y: s.fromY };
    let x = loco.x, y = loco.y, zoom = cam.zoom, rot = 0;
    switch (s.name) {
      case 'run_intro': {
        // dolly east from the void front to the locomotive while zooming in
        const k = smoothstep(clamp(u * 1.15, 0, 1));
        x = lerp(s.fromX, loco.x, k); y = lerp(s.fromY, loco.y, k);
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
    }
    cam.setZoom(clamp(zoom, 0.3, 2.5));
    try { cam.setRotation(rot); } catch { /* ignore */ }
    cam.centerOn(x, y);
  }
}
