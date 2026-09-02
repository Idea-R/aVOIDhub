/**
 * In-run HUD laid out as fixed safe zones:
 *   top bar   — resources (left) · region/clock/boss (centre) · speaker/speed/menu (right)
 *   left rail — route panel (collapses to a 44 px icon strip while the plan is fine) + optional log feed
 *   dock      — wave banner → stop pill → train strip (appended by index.ts), centred in the remaining width
 * The right rail (inspector / shop) lives outside this element; layout.ts publishes the zone sizes.
 */
import { el, btn, setText, setWidth, toggleClass, show, setAttr, fmtTime, clamp } from './dom';
import type { UiShared } from './shared';
import type { SimState, ResourceKey } from '../core/types';
import { HEX_R, REGION_NAMES, TRAIN } from '../core/config';
import { ENEMY_DEFS } from '../core/enemies';
import { gsap, D, isReduced, floatLabel, shake } from './motion';
import { createVolumePopover } from './volume';
import { nodeMeta } from './nodes';

export interface Hud {
  el: HTMLElement;
  /** Zones for the layout controller. */
  zones: { top: HTMLElement; left: HTMLElement; dock: HTMLElement };
  update(s: SimState, now: number): void;
  flashResource(key: ResourceKey, delta: number): void;
  /** Subtle "plan range reached" feedback instead of a toast. */
  shakeRoute(): void;
  /** Close transient popovers (volume). Returns true when one was open. */
  closePopovers(): boolean;
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
  // passengers + crew merged into one chip: ⚇ 12/20 · ⚒ 3 · ☺ 80
  const paxV = el('span', { class: 'rv-chip-v', text: '0' });
  const paxCap = el('span', { class: 'rv-chip-cap', text: '/0' });
  const crewV = el('span', { class: 'rv-chip-v rv-chip-crew', text: '0' });
  const morale = el('span', { class: 'rv-morale', text: '' });
  const peopleChip = el('div', { class: 'rv-chip rv-chip-people', title: 'Passengers aboard / capacity · crew specialists (posted) · morale', 'aria-label': 'Passengers and crew' },
    el('span', { class: 'rv-chip-ico', 'aria-hidden': 'true', text: '⚇' }), el('span', { class: 'rv-chip-k', text: 'Pax' }), paxV, paxCap,
    el('span', { class: 'rv-chip-sep', 'aria-hidden': 'true', text: '·' }),
    el('span', { class: 'rv-chip-ico', 'aria-hidden': 'true', text: '⚒' }), el('span', { class: 'rv-chip-k', text: 'Crew' }), crewV, morale);
  chipsEl.appendChild(peopleChip);

  // void meter
  const voidFill = el('i');
  const voidDist = el('span', { class: 'rv-void-dist', text: '—' });
  const voidEl = el('div', { class: 'rv-void rv-panel', role: 'meter', 'aria-label': 'Distance to the void front', 'aria-valuemin': '0', 'aria-valuemax': '24' },
    el('span', { class: 'rv-label', text: 'Void' }), el('div', { class: 'rv-bar' }, voidFill), voidDist);
  const tl = el('div', { class: 'rv-hud-tl' }, chipsEl, voidEl);

  // ---------- top-centre: status + boss ----------
  const regionEl = el('span', { class: 'rv-region', text: '' });
  const dialHand = el('i');
  const dial = el('span', { class: 'rv-dial', 'aria-hidden': 'true' }, dialHand);
  const dayLbl = el('span', { class: 'rv-daylbl', text: '☀' });
  const weatherEl = el('span', { class: 'rv-weather', text: '' });
  const forecastEl = el('span', { class: 'rv-forecast', text: '' });
  const clockEl = el('span', { class: 'rv-clock', text: '00:00' });
  const statusEl = el('div', { class: 'rv-status rv-panel', role: 'status', 'aria-label': 'Region, time of day, weather and clock' }, regionEl, dial, dayLbl, weatherEl, forecastEl, clockEl);
  const bossName = el('span', { text: '' });
  const bossHp = el('span', { text: '' });
  const bossFill = el('i');
  const bossEl = el('div', { class: 'rv-boss rv-panel', role: 'meter', 'aria-label': 'Boss health' },
    el('div', { class: 'rv-bossname' }, bossName, bossHp), el('div', { class: 'rv-bar' }, bossFill));
  bossEl.hidden = true;
  const tc = el('div', { class: 'rv-hud-tc' }, statusEl, bossEl);

  // ---------- top-right: speaker + speed + menu ----------
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
  const volume = createVolumePopover(ui);
  const menuBtn = btn('Menu', () => { ui.audio().ui('open'); actions.openPause(); }, { aria: 'Open menu (Esc)' });
  const tr = el('div', { class: 'rv-hud-tr' }, el('div', { class: 'rv-row' }, volume.button, speedEl, menuBtn), volume.pop);

  const top = el('div', { class: 'rv-hud-top' }, tl, tc, tr);

  // ---------- left rail: route panel (+ log) ----------
  const aheadV = el('b', { text: '0' });
  const rangeV = el('b', { text: '0' });
  const railBtn = (icon: string, label: string, onClick: () => void, opts: { aria: string; cls?: string }) => {
    const b = btn('', onClick, { class: 'rv-small rv-railbtn' + (opts.cls ? ' ' + opts.cls : ''), aria: opts.aria, title: opts.aria });
    b.append(el('span', { class: 'rv-rb-ico', 'aria-hidden': 'true', text: icon }), el('span', { class: 'rv-rb-lbl', text: label }));
    return b;
  };
  const followBtn = railBtn('◎', 'Follow', () => { const v = ui.view(); if (!v) return; ui.audio().ui('click'); v.setFollow(!v.isFollowing()); }, { aria: 'Toggle camera follow' });
  const reverseBtn = railBtn('◀', 'Reverse', () => actions.toggleReverse(), { aria: 'Reverse down the track (R)', cls: 'rv-reverse' });
  const logBtn = railBtn('≡', 'Log', () => { const on = !ui.settings().showLog; ui.audio().ui('click'); ui.app.settings.set({ showLog: on }); }, { aria: 'Toggle the event log feed' });
  let reversingShown = false;
  const routeEl = el('div', { class: 'rv-route rv-panel', role: 'group', 'aria-label': 'Route planning', tabindex: '-1' },
    el('div', { class: 'rv-route-head' }, el('span', { class: 'rv-route-ico', 'aria-hidden': 'true', text: '⌖' }), el('span', { class: 'rv-label', text: 'Route' })),
    el('div', { class: 'rv-kv rv-ahead' }, el('span', { text: 'Planned ahead' }), el('span', null, aheadV, ' hex')),
    el('div', { class: 'rv-kv rv-range' }, el('span', { text: 'Plan range' }), el('span', null, rangeV, ' hex')),
    el('div', { class: 'rv-route-btns' },
      railBtn('↶', 'Undo', () => { const sim = ui.sim(); if (!sim) return; const r = sim.unplanLast(); ui.audio().ui(r.ok ? 'click' : 'error'); if (!r.ok && r.reason) ui.notify(r.reason, 'warn'); }, { aria: 'Undo last planned hex (Backspace)' }),
      railBtn('✕', 'Clear', () => { const sim = ui.sim(); if (!sim) return; ui.audio().ui('click'); sim.clearPlan(); }, { aria: 'Clear planned route' }),
      railBtn('⌂', 'Center', () => { ui.audio().ui('click'); ui.view()?.centerOnTrain(); }, { aria: 'Center camera on train (F)' }),
      followBtn,
      reverseBtn,
      logBtn,
    ),
  );
  const logEl = el('div', { class: 'rv-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Event log' });
  const logLines: Array<{ el: HTMLElement; key: string; t: number }> = [];
  const left = el('div', { class: 'rv-left' }, routeEl, logEl);

  // ---------- dock: wave banner → stop pill → strip ----------
  const warnText = el('span');
  const warnSecs = el('b', { class: 'rv-warn-secs' });
  const warningEl = el('div', { class: 'rv-warning rv-panel', role: 'alert' }, warnText, warnSecs);
  warningEl.hidden = true;
  const stopIco = el('span', { class: 'rv-stop-ico', 'aria-hidden': 'true', text: '' });
  const stopText = el('div', { class: 'rv-stop-text', text: '' });
  const stopType = el('span', { class: 'rv-stop-type', text: '' });
  const departBtn = btn('Depart now', () => { ui.audio().ui('confirm'); ui.sim()?.depart(); }, { class: 'rv-small rv-primary', aria: 'Depart the settlement now' });
  const pressureFill = el('i');
  const pressureEl = el('div', { class: 'rv-pressure' }, el('span', { text: 'Stop pressure' }), el('div', { class: 'rv-bar' }, pressureFill));
  const havenEl = el('span', { class: 'rv-haven-tag', title: 'Safe haven: no waves spawn and the militia defends while you are stopped here', text: 'Haven' });
  const stopEl = el('div', { class: 'rv-stop rv-panel', role: 'status' },
    el('span', { class: 'rv-stop-arrow', 'aria-hidden': 'true', text: '▲' }),
    el('div', { class: 'rv-stop-main' }, stopIco, stopText, stopType, havenEl, departBtn),
    pressureEl);
  stopEl.hidden = true;
  const dock = el('div', { class: 'rv-dock' }, warningEl, stopEl);

  const root = el('div', { class: 'rv-hud' }, top, left, dock);

  // ---------- state caches ----------
  let lastResSig = '';
  let lastPhase = '';
  let lastSpeed = -1;
  let warnShown = false, bossShown = false, lastSecs = -1;
  let lastStopSig = '';
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

  const groups = (): HTMLElement[] => [tl, tc, tr, routeEl, logEl, ...(Array.from(dock.children) as HTMLElement[])];
  function enter(delay = 0): void {
    root.classList.remove('rv-hud-off');
    groups().forEach((e, i) => {
      const cl = e.classList;
      const from: gsap.TweenVars = cl.contains('rv-hud-tr') ? { x: 48 } : cl.contains('rv-hud-tc') ? { y: -44 } : cl.contains('rv-hud-tl') ? { y: -32 } : cl.contains('rv-strip') ? { y: 64 } : cl.contains('rv-stop') || cl.contains('rv-warning') ? { y: 30 } : { x: -48 };
      gsap.killTweensOf(e);
      gsap.fromTo(e, { ...from, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: D(0.65), delay: D(delay + i * 0.07), ease: 'power3.out', clearProps: 'transform,opacity' });
    });
  }
  function hide(): void {
    root.classList.add('rv-hud-off');
    for (const e of groups()) { gsap.killTweensOf(e); gsap.to(e, { opacity: 0, duration: D(0.3), ease: 'power2.in' }); }
  }

  let shakeAt = 0;
  function shakeRoute(): void {
    const now = performance.now();
    if (now - shakeAt < 400) return;
    shakeAt = now;
    routeEl.classList.remove('rv-limit'); void routeEl.offsetWidth; routeEl.classList.add('rv-limit');
    window.setTimeout(() => routeEl.classList.remove('rv-limit'), 600);
    shake(routeEl, 4, 0.3);
  }

  function updateResources(s: SimState): void {
    const t = s.train;
    const assigned = t.crew.filter(c => c.carIndex >= 0).length;
    const sig = RES.map(r => `${Math.floor(t.resources[r.key])}/${Math.floor(t.capacity[r.key])}`).join('|') + `|${t.passengers}/${t.passengerCap}|${Math.round(t.morale)}|${t.crew.length}|${assigned}`;
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
    setText(morale, t.passengers > 0 ? `☺ ${m}` : '');
    setText(crewV, t.crew.length ? `${t.crew.length}` : '0');
    setAttr(crewV, 'title', t.crew.length ? `${assigned} of ${t.crew.length} specialists posted to cars` : 'No crew specialists yet');
    toggleClass(peopleChip, 'rv-low', t.passengers > 0 && m < 30);
    setAttr(peopleChip, 'aria-label', `Passengers ${t.passengers} of ${t.passengerCap}, morale ${m}, crew ${t.crew.length} (${assigned} posted)`);
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
    void s;
  }

  function updateWarning(s: SimState): void {
    const w = s.director?.warning ?? null;
    if (w) {
      const name = ENEMY_DEFS[w.type]?.name ?? w.type;
      const secs = Math.max(0, Math.ceil(w.in));
      setText(warnText, `⚠ ${name}s approaching from the ${String(w.from).toUpperCase()} — `);
      setText(warnSecs, `${secs}s`);
      show(warningEl, true);
      if (!warnShown) { warnShown = true; gsap.fromTo(warningEl, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: D(0.5), ease: 'back.out(1.6)', clearProps: 'transform,opacity' }); }
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
    setAttr(logBtn, 'aria-pressed', ui.settings().showLog ? 'true' : 'false');
    const rev = !!s.train.reversing;
    if (rev !== reversingShown) {
      reversingShown = rev;
      const lbl = reverseBtn.querySelector('.rv-rb-lbl');
      setText(lbl, rev ? 'Stop' : 'Reverse');
      setText(reverseBtn.querySelector('.rv-rb-ico'), rev ? '■' : '◀');
      toggleClass(reverseBtn, 'rv-reversing', rev);
      setAttr(reverseBtn, 'aria-pressed', rev ? 'true' : 'false');
      setAttr(reverseBtn, 'aria-label', rev ? 'Stop reversing (R)' : 'Reverse down the track (R)');
      setAttr(reverseBtn, 'title', rev ? 'Stop reversing (R)' : 'Reverse down the track (R)');
      if (!isReduced()) gsap.fromTo(reverseBtn, { scale: 1.12 }, { scale: 1, duration: 0.35, ease: 'back.out(2)', clearProps: 'transform' });
    }
    const canRev = s.phase === 'running' || s.phase === 'paused';
    if (reverseBtn.disabled === canRev) reverseBtn.disabled = !canRev;
  }

  function updateStop(s: SimState): void {
    const t = s.train;
    if (s.phase === 'victory' || s.phase === 'defeat') { show(stopEl, false); lastStopSig = ''; return; }
    let text = '', cls = 'rv-stop rv-panel', depart = false, haven = false, ico = '', type = '', color = '';
    if (t.reversing) {
      text = 'Reversing — press R or Stop to halt'; cls += ' rv-reversing'; ico = '◀';
    } else if (!t.stopped || t.stopReason === 'none') { show(stopEl, false); lastStopSig = ''; return; }
    else {
      switch (t.stopReason) {
        case 'no_route': text = 'No track ahead — click a hex to plan'; cls += ' rv-no-route'; ico = '⌖'; break;
        case 'settlement': {
          const p = s.route.path[Math.min(t.routeIndex, s.route.path.length - 1)];
          let name = 'Settlement', stType = '';
          if (p) {
            const tile = s.tiles[p[1] * s.mapW + p[0]];
            const st = tile?.settlementId ? s.settlements.find(x => x.id === tile.settlementId) : null;
            if (st) { name = st.name; stType = st.type; }
          }
          const m = nodeMeta(stType);
          const remain = Math.max(0, Math.ceil(TRAIN.settlementStopTime - t.stopTimer));
          text = s.phase === 'shop' ? name : `${name} · departing in ${remain}s`;
          type = m.label; ico = m.icon; color = m.color;
          cls += ' rv-settlement';
          depart = s.phase !== 'shop';
          haven = true;
          break;
        }
        case 'junction': text = 'Junction — choose a branch'; cls += ' rv-junction'; ico = '⑂'; break;
        case 'boss': text = 'Boss blocks the line — fight or find a way around'; cls += ' rv-boss'; ico = '☠'; break;
        case 'derailed': text = 'Derailed'; cls += ' rv-no-route'; ico = '✕'; break;
      }
    }
    const sig = [text, cls, depart, haven, ico, type, color, Math.round(t.stopPressure * 100)].join('|');
    if (sig === lastStopSig) return;
    lastStopSig = sig;
    setText(stopText, text);
    setText(stopType, type);
    setText(stopIco, ico);
    const st = color ? `--accent:${color}` : '';
    if (stopEl.getAttribute('style') !== st) stopEl.setAttribute('style', st);
    if (stopEl.className !== cls) stopEl.className = cls;
    show(departBtn, depart);
    show(stopType, !!type);
    show(havenEl, haven);
    show(pressureEl, !haven && !t.reversing);
    if (!haven) setWidth(pressureFill, clamp(t.stopPressure, 0, 1) * 100);
    show(stopEl, true);
  }

  function updateLog(s: SimState): void {
    if (!ui.settings().showLog) { if (logLines.length) { logLines.length = 0; logEl.replaceChildren(); } return; }
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
    lastResSig = ''; lastPhase = ''; lastSpeed = -1; lastStopSig = '';
    warnShown = false; bossShown = false; lastSecs = -1; logSeen.clear(); reversingShown = false;
    setText(reverseBtn.querySelector('.rv-rb-lbl'), 'Reverse'); setText(reverseBtn.querySelector('.rv-rb-ico'), '◀'); toggleClass(reverseBtn, 'rv-reversing', false);
    for (const k of Object.keys(pending) as ResourceKey[]) delete pending[k];
    logLines.length = 0; logEl.replaceChildren();
    show(warningEl, false); show(bossEl, false); show(stopEl, false);
    volume.close();
  }

  const anchors: Record<string, HTMLElement> = { resources: chipsEl, void: voidEl, status: statusEl, speed: speedEl, menu: menuBtn, route: routeEl, stop: stopEl, log: logEl, hud: root, top, dock, left, speaker: volume.button };
  return {
    el: root, zones: { top, left, dock }, update, flashResource, shakeRoute, anchors, reset, enter, hide,
    closePopovers() { if (volume.isOpen()) { volume.close(); return true; } return false; },
  };
}
