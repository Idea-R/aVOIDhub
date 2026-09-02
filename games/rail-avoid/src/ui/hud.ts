/** In-run HUD: resources, status bar, speed controls, void meter, warnings, route panel, stop status, log feed. */
import { el, btn, setText, setWidth, toggleClass, show, setAttr, fmtTime, clamp } from './dom';
import type { UiShared } from './shared';
import type { SimState, ResourceKey } from '../core/types';
import type { GameEvents } from '../core/events';
import { HEX_R, REGION_NAMES, TRAIN } from '../core/config';
import { ENEMY_DEFS } from '../core/enemies';
import { gsap, D, isReduced, floatLabel } from './motion';

export type HoverPayload = GameEvents['ui:hoverTile'];

export interface Hud {
  el: HTMLElement;
  update(s: SimState, now: number): void;
  setHover(p: HoverPayload): void;
  flashResource(key: ResourceKey, delta: number): void;
  anchors: Record<string, HTMLElement>;
  reset(): void;
  /** Staggered slide-in of every HUD group (run start, after a cinematic). */
  enter(delay?: number): void;
  /** Fade the HUD out (cinematics). */
  hide(): void;
}

const RES: Array<{ key: ResourceKey; label: string; icon: string }> = [
  { key: 'rails', label: 'Rails', icon: '═' },
  { key: 'scrap', label: 'Scrap', icon: '⚙' },
  { key: 'coal', label: 'Coal', icon: '⬢' },
  { key: 'ammo', label: 'Ammo', icon: '➤' },
  { key: 'food', label: 'Food', icon: '✿' },
];
const WEATHER_ICON: Record<string, string> = { clear: '○', rain: '☂', fog: '≋', storm: '⚡', ashfall: '☁' };

export function createHud(ui: UiShared, actions: { openPause(): void; toggleReverse(): void }): Hud {
  // ---------- top-left: resources ----------
  const chips: Record<string, { el: HTMLElement; v: HTMLElement; cap: HTMLElement; flashTimer: number }> = {};
  const chipsEl = el('div', { class: 'rv-chips', role: 'group', 'aria-label': 'Resources' });
  for (const r of RES) {
    const v = el('span', { class: 'rv-chip-v', text: '0' });
    const capEl = el('span', { class: 'rv-chip-cap', text: '/0' });
    const chip = el('div', { class: 'rv-chip', 'data-key': r.key, 'aria-label': r.label, title: r.label },
      el('span', { class: 'rv-chip-ico', 'aria-hidden': 'true', text: r.icon }),
      el('span', { class: 'rv-chip-k', text: r.label }), v, capEl);
    chips[r.key] = { el: chip, v, cap: capEl, flashTimer: 0 };
    chipsEl.appendChild(chip);
  }
  const paxV = el('span', { class: 'rv-chip-v', text: '0' });
  const paxCap = el('span', { class: 'rv-chip-cap', text: '/0' });
  const morale = el('span', { class: 'rv-morale', text: '' });
  const paxChip = el('div', { class: 'rv-chip', title: 'Passengers aboard / capacity, and morale', 'aria-label': 'Passengers' },
    el('span', { class: 'rv-chip-ico', 'aria-hidden': 'true', text: '⚇' }), el('span', { class: 'rv-chip-k', text: 'Pax' }), paxV, paxCap, morale);
  const crewV = el('span', { class: 'rv-chip-v', text: '0' });
  const crewCap = el('span', { class: 'rv-chip-cap', text: '' });
  const crewChip = el('div', { class: 'rv-chip', title: 'Crew specialists (assigned / total)', 'aria-label': 'Crew' },
    el('span', { class: 'rv-chip-ico', 'aria-hidden': 'true', text: '⚒' }), el('span', { class: 'rv-chip-k', text: 'Crew' }), crewV, crewCap);
  chipsEl.append(paxChip, crewChip);

  // void meter
  const voidFill = el('i');
  const voidDist = el('span', { class: 'rv-void-dist', text: '—' });
  const voidEl = el('div', { class: 'rv-void rv-panel', role: 'meter', 'aria-label': 'Distance to the void front', 'aria-valuemin': '0', 'aria-valuemax': '24' },
    el('span', { class: 'rv-label', text: 'Void' }), el('div', { class: 'rv-bar' }, voidFill), voidDist);
  const tl = el('div', { class: 'rv-hud-tl' }, chipsEl, voidEl);

  // ---------- top-center: status ----------
  const regionEl = el('span', { class: 'rv-region', text: '' });
  const dialHand = el('i');
  const dial = el('span', { class: 'rv-dial', 'aria-hidden': 'true' }, dialHand);
  const dayLbl = el('span', { class: 'rv-daylbl', text: '☀' });
  const weatherEl = el('span', { class: 'rv-weather', text: '' });
  const forecastEl = el('span', { class: 'rv-forecast', text: '' });
  const clockEl = el('span', { class: 'rv-clock', text: '00:00' });
  const statusEl = el('div', { class: 'rv-status rv-panel', role: 'status', 'aria-label': 'Region, time of day, weather and clock' }, regionEl, dial, dayLbl, weatherEl, forecastEl, clockEl);
  const warnText = el('span');
  const warnSecs = el('b', { class: 'rv-warn-secs' });
  const warningEl = el('div', { class: 'rv-warning rv-panel', role: 'alert' }, warnText, warnSecs);
  warningEl.hidden = true;
  const bossName = el('span', { text: '' });
  const bossHp = el('span', { text: '' });
  const bossFill = el('i');
  const bossEl = el('div', { class: 'rv-boss rv-panel', role: 'meter', 'aria-label': 'Boss health' },
    el('div', { class: 'rv-bossname' }, bossName, bossHp), el('div', { class: 'rv-bar' }, bossFill));
  bossEl.hidden = true;
  const tc = el('div', { class: 'rv-hud-tc' }, statusEl, warningEl, bossEl);

  // ---------- top-right: speed + menu ----------
  const speedBtns: Array<{ mul: 0 | 1 | 2 | 4; b: HTMLButtonElement }> = [];
  const mkSpeed = (mul: 0 | 1 | 2 | 4, label: string, aria: string) => {
    const b = btn(label, () => {
      const sim = ui.sim(); const s = ui.state();
      if (!sim || !s) return;
      ui.audio().ui('click');
      if (mul === 0) { if (s.phase === 'paused') sim.resume(); else if (s.phase === 'running') sim.pause(); }
      else { sim.setSpeed(mul); if (s.phase === 'paused') sim.resume(); }
    }, { class: 'rv-icon', aria });
    speedBtns.push({ mul, b });
    return b;
  };
  const speedEl = el('div', { class: 'rv-speed rv-panel', role: 'group', 'aria-label': 'Simulation speed' },
    mkSpeed(0, '⏸', 'Pause or resume (Space)'), mkSpeed(1, '1×', 'Normal speed (1)'), mkSpeed(2, '2×', 'Double speed (2)'));
  if (ui.isDev) speedEl.appendChild(mkSpeed(4, '4×', 'Quadruple speed (3, dev)'));
  const menuBtn = btn('Menu', () => { ui.audio().ui('open'); actions.openPause(); }, { aria: 'Open menu (Esc)' });
  const tr = el('div', { class: 'rv-hud-tr' }, el('div', { class: 'rv-row' }, speedEl, menuBtn));

  // ---------- route panel ----------
  const aheadV = el('b', { text: '0' });
  const rangeV = el('b', { text: '0' });
  const hoverEl = el('div', { class: 'rv-hover', text: 'Hover a hex to see its track cost.' });
  const followBtn = btn('Follow', () => { const v = ui.view(); if (!v) return; ui.audio().ui('click'); v.setFollow(!v.isFollowing()); }, { class: 'rv-small', aria: 'Toggle camera follow' });
  const reverseBtn = btn('Reverse', () => actions.toggleReverse(), { class: 'rv-small rv-reverse', aria: 'Reverse down the track (R)' });
  let reversingShown = false;
  const routeEl = el('div', { class: 'rv-route rv-panel', role: 'group', 'aria-label': 'Route planning' },
    el('div', { class: 'rv-label', text: 'Route' }),
    el('div', { class: 'rv-kv' }, el('span', { text: 'Planned ahead' }), el('span', null, aheadV, ' hex')),
    el('div', { class: 'rv-kv' }, el('span', { text: 'Plan range' }), el('span', null, rangeV, ' hex')),
    hoverEl,
    el('div', { class: 'rv-route-btns' },
      btn('Undo', () => { const sim = ui.sim(); if (!sim) return; const r = sim.unplanLast(); ui.audio().ui(r.ok ? 'click' : 'error'); if (!r.ok && r.reason) ui.notify(r.reason, 'warn'); }, { class: 'rv-small', aria: 'Undo last planned hex (Backspace)' }),
      btn('Clear', () => { const sim = ui.sim(); if (!sim) return; ui.audio().ui('click'); sim.clearPlan(); }, { class: 'rv-small', aria: 'Clear planned route' }),
      btn('Center', () => { ui.audio().ui('click'); ui.view()?.centerOnTrain(); }, { class: 'rv-small', aria: 'Center camera on train (F)' }),
      followBtn,
    ),
    reverseBtn,
  );

  // ---------- stop status ----------
  const stopText = el('div', { class: 'rv-stop-text', text: '' });
  const departBtn = btn('Depart now', () => { ui.audio().ui('confirm'); ui.sim()?.depart(); }, { class: 'rv-small rv-primary', aria: 'Depart the settlement now' });
  const pressureFill = el('i');
  const pressureEl = el('div', { class: 'rv-pressure' }, el('span', { text: 'Stop pressure' }), el('div', { class: 'rv-bar' }, pressureFill));
  const havenEl = el('div', { class: 'rv-haven', title: 'Safe haven: no waves spawn and the militia defends while you are stopped here' }, el('span', { class: 'rv-haven-tag', text: 'Haven' }), el('span', { text: 'militia on watch · no waves' }));
  const stopEl = el('div', { class: 'rv-stop rv-panel', role: 'status' },
    el('span', { class: 'rv-stop-arrow', 'aria-hidden': 'true', text: '▲' }), stopText, departBtn, pressureEl, havenEl);
  stopEl.hidden = true;

  // ---------- log ----------
  const logEl = el('div', { class: 'rv-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Event log' });
  const logLines: Array<{ el: HTMLElement; key: string; t: number }> = [];

  const root = el('div', { class: 'rv-hud' }, tl, tc, tr, routeEl, stopEl, logEl);

  // ---------- state caches ----------
  let lastResSig = '';
  let lastPhase = '';
  let lastSpeed = -1;
  let lastHover = '';
  let warnShown = false, bossShown = false, lastSecs = -1;
  const logSeen = new Set<string>();

  // resource deltas are coalesced per key for 400 ms, then: chip pop + colour flash + floating "+12"
  const pending: Partial<Record<ResourceKey, number>> = {};
  let flushTimer = 0;
  function flashResource(key: ResourceKey, delta: number): void {
    if (!chips[key]) return;
    pending[key] = (pending[key] ?? 0) + delta;
    if (!flushTimer) flushTimer = window.setTimeout(flushDeltas, 400);
  }
  function flushDeltas(): void {
    flushTimer = 0;
    for (const k of Object.keys(pending) as ResourceKey[]) {
      const d = pending[k] ?? 0;
      delete pending[k];
      const c = chips[k];
      if (!c || Math.abs(d) < 0.5) continue;
      const up = d > 0;
      c.el.classList.remove('rv-flash-up', 'rv-flash-down');
      void c.el.offsetWidth;
      c.el.classList.add(up ? 'rv-flash-up' : 'rv-flash-down');
      if (c.flashTimer) clearTimeout(c.flashTimer);
      c.flashTimer = window.setTimeout(() => { c.el.classList.remove('rv-flash-up', 'rv-flash-down'); c.flashTimer = 0; }, 500);
      if (isReduced()) continue;
      gsap.killTweensOf(c.el);
      gsap.fromTo(c.el, { scale: 1 }, { scale: 1.25, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1, clearProps: 'transform' });
      floatLabel(c.el, `${up ? '+' : '−'}${Math.round(Math.abs(d))}`, up ? 'rv-good-text' : 'rv-danger-text');
    }
  }

  function enter(delay = 0): void {
    root.classList.remove('rv-hud-off');
    const narrow = window.innerWidth <= 1180;
    (Array.from(root.children) as HTMLElement[]).forEach((e, i) => {
      const cl = e.classList;
      const base: gsap.TweenVars = cl.contains('rv-hud-tc') || cl.contains('rv-stop') || cl.contains('rv-strip') ? { xPercent: -50 } : cl.contains('rv-route') && !narrow ? { yPercent: -50 } : {};
      const from: gsap.TweenVars = cl.contains('rv-hud-tr') ? { x: 48 } : cl.contains('rv-hud-tc') ? { y: -44 } : cl.contains('rv-strip') ? { y: 64 } : cl.contains('rv-stop') ? { y: 30 } : { x: -48 };
      gsap.killTweensOf(e);
      gsap.fromTo(e, { ...base, ...from, opacity: 0 }, { ...base, x: 0, y: 0, opacity: 1, duration: D(0.65), delay: D(delay + i * 0.07), ease: 'power3.out', clearProps: 'transform,opacity' });
    });
  }
  function hide(): void {
    root.classList.add('rv-hud-off');
    for (const e of Array.from(root.children) as HTMLElement[]) { gsap.killTweensOf(e); gsap.to(e, { opacity: 0, duration: D(0.3), ease: 'power2.in' }); }
  }

  function setHover(p: HoverPayload): void {
    let text = 'Hover a hex to see its track cost.';
    let cls = 'rv-hover';
    if (p.col >= 0) {
      if (!p.plannable) {
        const sim = ui.sim();
        let why = 'Not plannable from here';
        if (sim) {
          try { const r = sim.previewPlan(p.col, p.row); if (r.reason) why = r.reason; } catch { /* */ }
          const t = sim.tileAt(p.col, p.row);
          if (t?.void) why = 'Consumed by the void';
          else if (t?.terrain === 'mountain') why = 'Mountain — impassable';
        }
        text = `${p.col},${p.row} — ${why}`;
        cls += ' rv-no';
      } else if (p.free) { text = `${p.col},${p.row} — FREE (old rail)`; cls += ' rv-free'; }
      else text = `${p.col},${p.row} — ${p.cost} rail${p.cost === 1 ? '' : 's'}`;
    }
    if (text !== lastHover) {
      lastHover = text;
      setText(hoverEl, text);
      hoverEl.className = cls;
    }
  }

  function updateResources(s: SimState): void {
    const t = s.train;
    const sig = RES.map(r => `${Math.floor(t.resources[r.key])}/${Math.floor(t.capacity[r.key])}`).join('|') + `|${t.passengers}/${t.passengerCap}|${Math.round(t.morale)}|${t.crew.length}|${t.crew.filter(c => c.carIndex >= 0).length}`;
    if (sig === lastResSig) return;
    lastResSig = sig;
    for (const r of RES) {
      const c = chips[r.key];
      const v = Math.floor(t.resources[r.key] ?? 0), capV = Math.floor(t.capacity[r.key] ?? 0);
      setText(c.v, String(v));
      setText(c.cap, '/' + capV);
      const low = capV > 0 ? v <= Math.max(3, capV * 0.15) : v <= 3;
      toggleClass(c.el, 'rv-low', low);
      toggleClass(c.el, 'rv-full', capV > 0 && v >= capV);
      setAttr(c.el, 'aria-label', `${r.label} ${v} of ${capV}${low ? ', low' : ''}`);
    }
    setText(paxV, String(t.passengers));
    setText(paxCap, '/' + t.passengerCap);
    const m = Math.round(t.morale);
    setText(morale, `☺ ${m}`);
    toggleClass(paxChip, 'rv-low', t.passengers > 0 && m < 30);
    setAttr(paxChip, 'aria-label', `Passengers ${t.passengers} of ${t.passengerCap}, morale ${m}`);
    const assigned = t.crew.filter(c => c.carIndex >= 0).length;
    setText(crewV, String(t.crew.length));
    setText(crewCap, t.crew.length ? ` (${assigned} posted)` : '');
  }

  function updateStatus(s: SimState): void {
    setText(regionEl, REGION_NAMES[clamp(s.region, 0, 3)] ?? '');
    const deg = Math.round((s.dayTime ?? 0) * 360);
    const tf = `rotate(${deg}deg)`;
    if (dialHand.style.transform !== tf) dialHand.style.transform = tf;
    setText(dayLbl, s.isNight ? '☾ night' : '☀ day');
    const w = s.weather;
    setText(weatherEl, `${WEATHER_ICON[w.kind] ?? '○'} ${w.kind}`);
    const hasSignal = s.train.cars.some(c => c.type === 'signal' && c.hp > 0 && !c.disabled);
    setText(forecastEl, hasSignal && w.next && w.next !== w.kind ? `next: ${w.next} in ${Math.max(0, Math.ceil(w.timer))}s` : '');
    setText(clockEl, fmtTime(s.time));
    setAttr(dial, 'title', `Day ${Math.round((s.dayTime ?? 0) * 100)}%`);
  }

  function updateSpeed(s: SimState): void {
    const key = s.phase === 'paused' ? 0 : s.speedMul;
    if (key === lastSpeed && s.phase === lastPhase) return;
    lastSpeed = key; lastPhase = s.phase;
    for (const { mul, b } of speedBtns) {
      const pressed = mul === 0 ? s.phase === 'paused' || s.speedMul === 0 : (s.phase !== 'paused' && s.speedMul === mul);
      setAttr(b, 'aria-pressed', pressed ? 'true' : 'false');
    }
  }

  function updateVoid(s: SimState): void {
    const sim = ui.sim();
    let d = Infinity;
    try { d = sim ? sim.voidDistance() : Infinity; } catch { d = Infinity; }
    const hexes = Number.isFinite(d) ? d / (HEX_R * 1.5) : 99;
    setWidth(voidFill, clamp(1 - hexes / 24, 0, 1) * 100);
    setText(voidDist, `${hexes.toFixed(1)} hex`);
    toggleClass(voidEl, 'rv-near', hexes < 4);
    toggleClass(voidEl, 'rv-shiver', hexes < 3 && !ui.reducedMotion());
    toggleClass(voidEl, 'rv-critical', hexes < 2 && !ui.reducedMotion());
    setAttr(voidEl, 'aria-valuenow', hexes.toFixed(1));
  }

  function updateWarning(s: SimState): void {
    const w = s.director?.warning ?? null;
    if (w) {
      const name = ENEMY_DEFS[w.type]?.name ?? w.type;
      const secs = Math.max(0, Math.ceil(w.in));
      setText(warnText, `⚠ ${name}s approaching from the ${String(w.from).toUpperCase()} — `);
      setText(warnSecs, `${secs}s`);
      show(warningEl, true);
      if (!warnShown) { warnShown = true; gsap.fromTo(warningEl, { y: -28, opacity: 0 }, { y: 0, opacity: 1, duration: D(0.5), ease: 'back.out(1.6)', clearProps: 'transform,opacity' }); }
      else if (secs !== lastSecs && !isReduced()) gsap.fromTo(warnSecs, { scale: 1.6, color: '#fff' }, { scale: 1, color: '', duration: 0.35, ease: 'power2.out', clearProps: 'transform,color' });
      lastSecs = secs;
    } else { show(warningEl, false); warnShown = false; lastSecs = -1; }
    const b = s.boss;
    let bossVisible = false;
    if (b?.active && b.enemyId) {
      const e = s.enemies.find(x => x.id === b.enemyId);
      if (e) {
        setText(bossName, `${ENEMY_DEFS[e.type]?.name ?? 'Boss'}${b.phase ? ` · phase ${b.phase}` : ''}`);
        setText(bossHp, `${Math.max(0, Math.ceil(e.hp))} / ${Math.ceil(e.maxHp)}`);
        setWidth(bossFill, e.maxHp > 0 ? (e.hp / e.maxHp) * 100 : 0);
        setAttr(bossEl, 'aria-valuenow', String(Math.round(e.hp)));
        show(bossEl, true);
        bossVisible = true;
        if (!bossShown) {
          gsap.fromTo(bossEl, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: D(0.6), ease: 'power3.out', clearProps: 'transform,opacity' });
          gsap.fromTo(bossName, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: D(0.9), delay: D(0.2), ease: 'power2.inOut', clearProps: 'clipPath' });
          gsap.fromTo(bossFill, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: D(1.1), delay: D(0.3), ease: 'power2.inOut', clearProps: 'transform' });
        }
      }
    }
    if (!bossVisible) show(bossEl, false);
    bossShown = bossVisible;
  }

  function updateRoute(s: SimState): void {
    const ahead = Math.max(0, s.route.path.length - 1 - s.train.routeIndex);
    setText(aheadV, String(ahead));
    let range = s.route.planRange;
    try { const sim = ui.sim(); if (sim) range = sim.currentPlanRange(); } catch { /* */ }
    setText(rangeV, String(range));
    const v = ui.view();
    const following = v ? v.isFollowing() : false;
    setAttr(followBtn, 'aria-pressed', following ? 'true' : 'false');
    const rev = !!s.train.reversing;
    if (rev !== reversingShown) {
      reversingShown = rev;
      setText(reverseBtn, rev ? 'Stop' : 'Reverse');
      toggleClass(reverseBtn, 'rv-reversing', rev);
      setAttr(reverseBtn, 'aria-pressed', rev ? 'true' : 'false');
      setAttr(reverseBtn, 'aria-label', rev ? 'Stop reversing (R)' : 'Reverse down the track (R)');
      if (!isReduced()) gsap.fromTo(reverseBtn, { scale: 1.12 }, { scale: 1, duration: 0.35, ease: 'back.out(2)', clearProps: 'transform' });
    }
    const canRev = s.phase === 'running' || s.phase === 'paused';
    if (reverseBtn.disabled === canRev) reverseBtn.disabled = !canRev;
  }

  function updateStop(s: SimState): void {
    const t = s.train;
    if (s.phase === 'victory' || s.phase === 'defeat') { show(stopEl, false); return; }
    if (t.reversing) {
      setText(stopText, 'Reversing — press R or Stop to halt');
      const rc = 'rv-stop rv-panel rv-reversing';
      if (stopEl.className !== rc) stopEl.className = rc;
      show(departBtn, false); show(pressureEl, false); show(havenEl, false);
      show(stopEl, true);
      return;
    }
    if (!t.stopped || t.stopReason === 'none') { show(stopEl, false); return; }
    let text = '';
    let cls = 'rv-stop rv-panel';
    let depart = false;
    switch (t.stopReason) {
      case 'no_route': text = 'No track ahead — click a hex to plan'; cls += ' rv-no-route'; break;
      case 'settlement': {
        const p = s.route.path[Math.min(t.routeIndex, s.route.path.length - 1)];
        let name = 'Settlement';
        if (p) {
          const tile = s.tiles[p[1] * s.mapW + p[0]];
          const st = tile?.settlementId ? s.settlements.find(x => x.id === tile.settlementId) : null;
          if (st) name = st.name;
        }
        const remain = Math.max(0, Math.ceil(TRAIN.settlementStopTime - t.stopTimer));
        text = s.phase === 'shop' ? `${name} — repair yard` : `${name} — departing in ${remain}s`;
        cls += ' rv-settlement';
        depart = s.phase !== 'shop';
        break;
      }
      case 'junction': text = 'Junction — choose a branch'; cls += ' rv-junction'; break;
      case 'boss': text = 'Boss blocks the line — fight or find a way around'; cls += ' rv-boss'; break;
      case 'derailed': text = 'Derailed'; cls += ' rv-no-route'; break;
    }
    setText(stopText, text);
    if (stopEl.className !== cls) stopEl.className = cls;
    show(departBtn, depart);
    // settlements are havens (no waves, militia); stop pressure only builds in the wild
    const haven = t.stopReason === 'settlement';
    show(havenEl, haven);
    show(pressureEl, !haven);
    if (!haven) setWidth(pressureFill, clamp(t.stopPressure, 0, 1) * 100);
    show(stopEl, true);
  }

  function updateLog(s: SimState): void {
    const entries = s.log.slice(-5);
    const keys = entries.map(e => `${e.t}|${e.text}`);
    let changed = keys.length !== logLines.length;
    if (!changed) for (let i = 0; i < keys.length; i++) if (logLines[i].key !== keys[i]) { changed = true; break; }
    if (changed) {
      logLines.length = 0;
      const fresh: HTMLElement[] = [];
      logEl.replaceChildren(...entries.map((e) => {
        const key = `${e.t}|${e.text}`;
        const line = el('div', { class: 'rv-log-line rv-k-' + e.kind }, el('span', { class: 'rv-log-t', text: fmtTime(e.t) }), e.text);
        logLines.push({ el: line, key, t: e.t });
        if (!logSeen.has(key)) { logSeen.add(key); fresh.push(line); }
        return line;
      }));
      if (logSeen.size > 200) logSeen.clear();
      if (fresh.length) gsap.fromTo(fresh, { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: D(0.35), ease: 'power3.out', stagger: D(0.06), clearProps: 'transform' });
    }
    for (const l of logLines) {
      const age = s.time - l.t;
      const op = age < 10 ? 1 : clamp(1 - (age - 10) / 14, 0.18, 1);
      const v = op.toFixed(2);
      if (l.el.style.opacity !== v) l.el.style.opacity = v;
    }
  }

  function update(s: SimState, _now: number): void {
    updateResources(s);
    updateStatus(s);
    updateSpeed(s);
    updateVoid(s);
    updateWarning(s);
    updateRoute(s);
    updateStop(s);
    updateLog(s);
  }

  function reset(): void {
    lastResSig = ''; lastPhase = ''; lastSpeed = -1; lastHover = '';
    warnShown = false; bossShown = false; lastSecs = -1; logSeen.clear(); reversingShown = false;
    setText(reverseBtn, 'Reverse'); toggleClass(reverseBtn, 'rv-reversing', false);
    for (const k of Object.keys(pending) as ResourceKey[]) delete pending[k];
    logLines.length = 0; logEl.replaceChildren();
    show(warningEl, false); show(bossEl, false); show(stopEl, false);
    setHover({ col: -1, row: -1, cost: 0, free: false, plannable: false });
  }

  const anchors: Record<string, HTMLElement> = { resources: chipsEl, void: voidEl, status: statusEl, speed: speedEl, menu: menuBtn, route: routeEl, stop: stopEl, log: logEl, hud: root };
  return { el: root, update, setHover, flashResource, anchors, reset, enter, hide };
}
