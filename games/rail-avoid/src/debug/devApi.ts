/**
 * window.__RAIL developer / verification API.
 * Installed by main.ts: installDevApi(ctx, autopilot). Everything here is a thin shim over
 * AppContext / SimApi / SimApi.debug so the verify harness (verify/verify.mjs) and a human in the
 * console can drive the game without touching internals.
 *
 * `?dev` in the URL sets window.__RAIL_DEV = true (used by the app to allow 4x speed etc.).
 */
import type { AppContext } from '../app';
import type { ResourceKey } from '../core/types';
import type { Autopilot } from './autopilot';
import { SIM_DT } from '../core/config';

declare global {
  interface Window {
    __RAIL: any;
    __RAIL_DEV?: boolean;
  }
}

const VERSION = '1.0.0';

function isDevUrl(): boolean {
  try { return typeof location !== 'undefined' && location.search.includes('dev'); } catch { return false; }
}

// Evaluate early so main.ts can read window.__RAIL_DEV before calling installDevApi().
if (typeof window !== 'undefined' && isDevUrl()) window.__RAIL_DEV = true;

function fmtError(e: unknown): string {
  if (e instanceof Error) return `${e.message}\n${e.stack ?? ''}`.trim();
  try { return typeof e === 'string' ? e : JSON.stringify(e); } catch { return String(e); }
}

export function installDevApi(ctx: AppContext, autopilot: Autopilot): void {
  if (typeof window === 'undefined') return;
  if (isDevUrl()) window.__RAIL_DEV = true;

  const errors: string[] = [];
  const warnings: string[] = [];

  // ---- capture uncaught errors / rejections / console noise (originals still run)
  window.addEventListener('error', (ev: ErrorEvent) => {
    const msg = ev.message || 'error';
    const stack = ev.error && ev.error.stack ? String(ev.error.stack) : `${ev.filename ?? ''}:${ev.lineno ?? ''}:${ev.colno ?? ''}`;
    errors.push(`${msg}\n${stack}`.trim());
  });
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    errors.push('unhandledrejection: ' + fmtError(ev.reason));
  });
  const anyWin = window as any;
  if (!anyWin.__RAIL_CONSOLE_WRAPPED) {
    anyWin.__RAIL_CONSOLE_WRAPPED = true;
    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);
    console.warn = (...args: unknown[]) => {
      try { warnings.push(args.map(a => (typeof a === 'string' ? a : fmtError(a))).join(' ')); } catch { /* ignore */ }
      origWarn(...args);
    };
    console.error = (...args: unknown[]) => {
      try { errors.push('console.error: ' + args.map(a => (typeof a === 'string' ? a : fmtError(a))).join(' ')); } catch { /* ignore */ }
      origError(...args);
    };
  }

  const speedOf = (m: number): 0 | 1 | 2 | 4 => (m === 0 || m === 1 || m === 2 || m === 4 ? m : m >= 3 ? 4 : m >= 1.5 ? 2 : m > 0 ? 1 : 0);

  const api = {
    version: VERSION,
    ready: true,
    ctx,
    get state() { return ctx.sim.state; },
    get sim() { return ctx.sim; },
    get view() { return ctx.view; },
    autopilot,
    errors,
    warnings,

    // ---- run flow
    newRun(seed?: number) { ctx.newRun(seed); return ctx.sim.state.seed; },
    continueRun() { return ctx.continueRun(); },
    quitToTitle() { ctx.quitToTitle(); },

    // ---- debug shims
    warpToRegion(n: number) { ctx.sim.debug.warpToRegion(Math.max(0, Math.min(3, n | 0))); },
    spawnWave(types: string[]) { ctx.sim.debug.spawnWave(Array.isArray(types) ? types : [String(types)]); },
    spawnBoss(type: string) { ctx.sim.debug.spawnBoss(type as 'boss_wagon' | 'boss_brood' | 'boss_maw'); },
    forceVictory() { ctx.sim.debug.forceVictory(); },
    forceDefeat(reason?: string) { ctx.sim.debug.forceDefeat(reason); },
    setSpeed(m: number) { ctx.sim.setSpeed(speedOf(m)); },
    pause() { ctx.sim.pause(); },
    resume() { ctx.sim.resume(); },
    godTrain() { ctx.sim.debug.godTrain(); },
    grant(res: Partial<Record<ResourceKey, number>>) { ctx.sim.debug.grant(res); },
    addCar(type: string) { ctx.sim.debug.addCar(type as any); },
    invulnerable(on: boolean) { ctx.sim.debug.invulnerable(!!on); },
    setWeather(k: string) { ctx.sim.debug.setWeather(k); },
    setTime(t: number) { ctx.sim.debug.setTime(t); },
    triggerEvent(id?: string) { ctx.sim.debug.triggerEvent(id); },

    // ---- persistence
    serialize() { return ctx.sim.serialize(); },
    restore(json: string) { return ctx.sim.restore(json); },

    // ---- view
    perf() { return ctx.view ? ctx.view.perf() : null; },
    snapshot() { return ctx.view ? ctx.view.snapshot() : null; },

    // ---- helpers for harnesses
    waitFor(pred: () => boolean, timeoutMs = 10000): Promise<boolean> {
      return new Promise(resolve => {
        const t0 = performance.now();
        const tick = () => {
          let ok = false;
          try { ok = !!pred(); } catch { ok = false; }
          if (ok) return resolve(true);
          if (performance.now() - t0 >= timeoutMs) return resolve(false);
          setTimeout(tick, 50);
        };
        tick();
      });
    },
    /** Synchronously fast-forward the sim by `seconds` of sim time in SIM_DT chunks (ignores pause/speed). */
    stepSim(seconds: number) {
      const sim = ctx.sim;
      const wasPaused = sim.isPaused();
      const mul = sim.state.speedMul;
      if (wasPaused) sim.resume();
      if (sim.state.speedMul !== 1) sim.setSpeed(1);
      const steps = Math.max(0, Math.round(seconds / SIM_DT));
      for (let i = 0; i < steps; i++) sim.update(SIM_DT);
      if (mul !== sim.state.speedMul) sim.setSpeed(mul);
      if (wasPaused) sim.pause();
      return sim.state.time;
    },
    summary() {
      const s = ctx.sim.state;
      const t = s.train;
      return {
        phase: s.phase,
        time: Math.round(s.time * 100) / 100,
        tick: s.tick,
        seed: s.seed,
        region: s.region,
        speedMul: s.speedMul,
        cars: t.cars.map(c => c.type),
        carHp: t.cars.map(c => Math.round(c.hp)),
        resources: { ...t.resources },
        enemies: s.enemies.filter(e => e.state !== 'dead').length,
        passengers: t.passengers,
        passengersDelivered: t.passengersDelivered,
        crew: t.crew.length,
        score: s.stats.score,
        kills: s.stats.kills,
        settlementsRescued: s.stats.settlementsRescued,
        defeatReason: s.defeatReason,
        boss: { active: s.boss.active, type: s.boss.type, phase: s.boss.phase, defeated: [...s.boss.defeated] },
        weather: s.weather.kind,
        isNight: s.isNight,
        route: { len: s.route.path.length, index: t.routeIndex, blocked: s.route.blocked },
        stopped: t.stopped,
        stopReason: t.stopReason,
        autopilot: autopilot.status(),
      };
    },
  };

  window.__RAIL = api;
}
