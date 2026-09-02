/** Drives the audio engine from simulation state (mood, engine, weather, void proximity). */
import type { UiShared } from './shared';
import { HEX_R } from '../core/config';

const q = (v: number, step: number) => Math.round(v / step) * step;

export function createMoodDriver(ui: UiShared): { update(now: number): void; reset(): void } {
  let last = 0;
  let mood = '';
  let engI = -1, engS = -1;
  let wKind = '', wInt = -1;
  let voidP = -1;
  let boarding = false;

  function set(m: string, i: number, s: number, wk: string, wi: number, vp: number, board: boolean): void {
    const a = ui.audio();
    if (m !== mood) { mood = m; a.setMusicMood(m); }
    if (i !== engI || s !== engS) { engI = i; engS = s; a.setEngine(i, s); }
    if (wk !== wKind || wi !== wInt) { wKind = wk; wInt = wi; a.setWeather(wk, wi); }
    if (vp !== voidP) { voidP = vp; a.setVoidProximity?.(vp); }
    if (board !== boarding) { boarding = board; a.setBoardingAlert?.(board); }
  }

  return {
    reset() { mood = ''; engI = -1; engS = -1; wKind = ''; wInt = -1; voidP = -1; boarding = false; },
    update(now: number) {
      if (now - last < 250) return;
      last = now;
      const s = ui.state();
      if (!ui.runActive() || !s) { set('title', 0, 0, 'clear', 0, 0, false); return; }
      const sim = ui.sim();
      let m = 'calm';
      if (s.phase === 'victory') m = 'victory';
      else if (s.phase === 'defeat') m = 'defeat';
      else if (s.boss?.active) m = 'boss';
      else {
        let combat = false;
        let vd = Infinity;
        try { vd = sim ? sim.voidDistance() : Infinity; } catch { vd = Infinity; }
        const lx = s.train.trailX[0], ly = s.train.trailY[0];
        if (lx !== undefined && ly !== undefined) {
          for (const e of s.enemies) {
            if (e.state === 'dead' || e.hp <= 0) continue;
            const dx = e.x - lx, dy = e.y - ly;
            if (dx * dx + dy * dy < 400 * 400) { combat = true; break; }
          }
        }
        if (combat) m = 'combat';
        else if (vd < 250 || s.director?.warning) m = 'tense';
      }
      const t = s.train;
      const running = s.phase === 'running' || s.phase === 'event';
      const intensity = running && t.moving ? Math.min(1, t.speed / 0.45) : 0;
      let maxHeat = 0, worstDmg = 0, anyBoarders = false;
      for (const c of t.cars) {
        if (c.heat > maxHeat) maxHeat = c.heat;
        const d = c.maxHp > 0 ? 1 - c.hp / c.maxHp : 0;
        if (d > worstDmg) worstDmg = d;
        if (c.boarders.length > 0) anyBoarders = true;
      }
      const stress = Math.max(maxHeat / 110, worstDmg * 0.8, t.hounds > 0 ? 0.3 : 0);
      let vp = 0;
      try { const vd = sim ? sim.voidDistance() : Infinity; vp = Math.max(0, Math.min(1, 1 - vd / (HEX_R * 1.5 * 12))); } catch { vp = 0; }
      const w = s.weather;
      set(m, q(intensity, 0.05), q(Math.min(1, stress), 0.05), w?.kind ?? 'clear', q(w?.intensity ?? 0, 0.1), q(vp, 0.05), anyBoarders && s.phase === 'running');
    },
  };
}
