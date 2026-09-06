/**
 * gsap motion helpers shared by every UI component.
 * Reduced motion (Settings.reducedMotion) collapses every duration to 0 via D() and skips loops;
 * the global timeline is also sped up as a safety net for any tween that forgot to use D().
 */
import { gsap } from 'gsap';

let reduced = false;
export function setReducedMotion(on: boolean): void { reduced = on; gsap.globalTimeline.timeScale(on ? 60 : 1); }
export function isReduced(): boolean { return reduced; }
/** Duration helper: seconds, or 0 under reduced motion. */
export const D = (s: number): number => (reduced ? 0 : s);

export type Vars = gsap.TweenVars;
export type Target = gsap.TweenTarget;

/** UI chrome fades in place. Combat movement uses its own explicit tweens. */
export function popIn(t: Target, _from: Vars = {}, vars: Vars = {}): gsap.core.Tween {
  gsap.killTweensOf(t);
  return gsap.fromTo(t, { opacity: 0 },
    { opacity: 1, duration: D(0.22), ease: 'power1.out', clearProps: 'opacity', onComplete: vars.onComplete });
}
/** Reveal related controls together, in their final positions. */
export function rowsIn(t: Target, vars: Vars = {}, from: Vars = {}): gsap.core.Tween {
  return popIn(t, from, vars);
}
/** Quick positional shake (damage, slams). */
export function shake(t: Target, power = 4, dur = 0.3): void {
  if (reduced) return;
  gsap.killTweensOf(t, 'x,y');
  const n = 6;
  const tl = gsap.timeline({ onComplete: () => gsap.set(t, { clearProps: 'x,y' }) });
  for (let i = 0; i < n; i++) {
    const k = 1 - i / n;
    tl.to(t, { x: (i % 2 ? 1 : -1) * power * k, y: ((i % 3) - 1) * power * 0.45 * k, duration: dur / (n + 1), ease: 'none' });
  }
  tl.to(t, { x: 0, y: 0, duration: dur / (n + 1) });
}
/** A label that rises out of `parent` (which must be position:relative) and fades. */
export function floatLabel(parent: HTMLElement, text: string, cls = ''): void {
  const s = document.createElement('span');
  s.className = 'rv-float ' + cls;
  s.textContent = text;
  parent.appendChild(s);
  if (reduced) { window.setTimeout(() => s.remove(), 700); return; }
  gsap.fromTo(s, { opacity: 0 }, { opacity: 1, duration: 0.16 });
  gsap.to(s, { opacity: 0, duration: 0.22, delay: 0.8, onComplete: () => s.remove() });
}
/** Tween every integer inside `final` from 0 into el.textContent, preserving zero-padding and punctuation. */
export function countText(el: Element, final: string, opts: { dur?: number; delay?: number; onDone?: () => void } = {}): void {
  const parts = final.split(/(\d+)/);
  const o = { v: 0 };
  const render = () => { el.textContent = parts.map((p, i) => (i % 2 ? String(Math.round(Number(p) * o.v)).padStart(p.length, '0') : p)).join(''); };
  if (!parts.some((_, i) => i % 2) || reduced) { el.textContent = final; opts.onDone?.(); return; }
  render();
  gsap.to(o, { v: 1, duration: opts.dur ?? 0.8, delay: opts.delay ?? 0, ease: 'power2.out', onUpdate: render, onComplete: () => { el.textContent = final; opts.onDone?.(); } });
}
/** Full-screen flash; `atPeak` fires at maximum brightness (used to swap screens underneath). */
export function screenFlash(root: HTMLElement, color = '#fff', peak = 0.9, atPeak?: () => void): void {
  if (reduced) { atPeak?.(); return; }
  const f = document.createElement('div');
  f.className = 'rv-flash';
  f.style.background = color;
  root.appendChild(f);
  gsap.timeline({ onComplete: () => f.remove() })
    .to(f, { opacity: peak, duration: 0.16, ease: 'power2.in', onComplete: atPeak })
    .to(f, { opacity: 0, duration: 0.75, ease: 'power2.out' });
}

/** Cheap additive ember/dust field on a canvas with pointer parallax (title, victory screen). */
export class Particles {
  private g: CanvasRenderingContext2D | null;
  private ps: Array<{ x: number; y: number; vx: number; vy: number; r: number; a: number; c: number; z: number; t: number }> = [];
  private raf = 0; private mx = 0; private my = 0; private px = 0; private py = 0; private last = 0;
  constructor(public canvas: HTMLCanvasElement, private count = 120, private palette = ['232,193,112', '109,95,214', '111,183,232']) {
    this.g = canvas.getContext('2d');
    this.onMove = this.onMove.bind(this);
  }
  private onMove(e: PointerEvent): void { this.mx = (e.clientX / (window.innerWidth || 1) - 0.5) * 2; this.my = (e.clientY / (window.innerHeight || 1) - 0.5) * 2; }
  start(): void {
    if (this.raf || !this.g) return;
    window.addEventListener('pointermove', this.onMove);
    this.resize();
    if (!this.ps.length) for (let i = 0; i < this.count; i++) this.ps.push(this.spawn(true));
    this.last = performance.now();
    const loop = (now: number) => { this.raf = requestAnimationFrame(loop); this.step(Math.min(0.05, (now - this.last) / 1000)); this.last = now; };
    this.raf = requestAnimationFrame(loop);
  }
  stop(): void { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; window.removeEventListener('pointermove', this.onMove); }
  private resize(): void { const c = this.canvas, w = c.clientWidth | 0, h = c.clientHeight | 0; if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; } }
  private spawn(anywhere: boolean) {
    const c = this.canvas, z = 0.3 + Math.random() * 0.7;
    return { x: Math.random() * c.width, y: anywhere ? Math.random() * c.height : c.height + 8, vx: (Math.random() - 0.5) * 14 * z, vy: -(8 + Math.random() * 28) * z,
      r: (0.6 + Math.random() * 1.9) * z, a: 0.2 + Math.random() * 0.55, c: Math.floor(Math.random() * this.palette.length), z, t: Math.random() * 6.28 };
  }
  private step(dt: number): void {
    const g = this.g; if (!g) return;
    this.resize();
    const W = this.canvas.width, H = this.canvas.height;
    const tx = reduced ? 0 : this.mx, ty = reduced ? 0 : this.my;
    this.px += (tx - this.px) * 0.05; this.py += (ty - this.py) * 0.05;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      if (!reduced) { p.t += dt; p.x += (p.vx + Math.sin(p.t * 1.3) * 6) * dt; p.y += p.vy * dt; }
      if (p.y < -10 || p.x < -10 || p.x > W + 10) { this.ps[i] = this.spawn(false); continue; }
      const tw = 0.7 + 0.3 * Math.sin(p.t * 3);
      g.fillStyle = `rgba(${this.palette[p.c]},${(p.a * tw).toFixed(3)})`;
      g.beginPath(); g.arc(p.x - this.px * 30 * p.z, p.y - this.py * 20 * p.z, p.r, 0, 6.2832); g.fill();
    }
  }
}

export { gsap };
