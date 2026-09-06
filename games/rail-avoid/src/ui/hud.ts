/**
 * In-run HUD laid out as fixed safe zones:
 *   top bar   — resources (left) · region/clock/boss (centre) · speaker/speed/menu (right)
 *   left rail — route panel (collapses to a 44 px icon strip while the plan is fine) + optional log feed
 *   dock      — wave banner → stop pill → train strip (appended by index.ts), centred in the remaining width
 * The right rail (inspector / shop) lives outside this element; layout.ts publishes the zone sizes.
 */
import { el, btn, append, setText, setWidth, toggleClass, show, setAttr, fmtTime, clamp } from './dom';
import type { UiShared } from './shared';
import type { SimState, ResourceKey } from '../core/types';
import { HEX_R, MAP_W, REGION_NAMES, TRAIN, WEATHER } from '../core/config';
import { hexToWorld } from '../core/hex';
import { ENEMY_DEFS } from '../core/enemies';
import { gsap, D, isReduced, floatLabel, shake } from './motion';
import { createVolumePopover } from './volume';
import { nodeMeta } from './nodes';
import { relicDef } from '../core/relics';
import { LINE_NAMES } from '../core/config';
import { readJunctionOptions, currentLine, lineName, lineFlavour, lineCss, lineKey, LINE_BUILT, LINE_UNKNOWN, type JunctionOption } from './lines';

export interface Hud {
  el: HTMLElement;
  /** Zones for the layout controller. */
  zones: { top: HTMLElement; left: HTMLElement; dock: HTMLElement };
  update(s: SimState, now: number): void;
  flashResource(key: ResourceKey, delta: number): void;
  /** Salvage picked up in the world: the coalesced delta float reads "+4 scrap" in gold instead of a bare number. */
  flashLoot(kind: ResourceKey | 'marks', amount: number): void;
  /** Void Marks changed: pop the ◆ chip with a floating delta. */
  popMarks(delta: number): void;
  /** Subtle "plan range reached" feedback instead of a toast. */
  shakeRoute(): void;
  /** Close transient popovers (volume). Returns true when one was open. */
  closePopovers(): boolean;
  /** True while the junction chooser is docked (the train waits at a branch). */
  junctionVisible(): boolean;
  /** Pick junction option `i` (0-based). Returns true when an option was chosen. */
  chooseJunction(i: number): boolean;
  /** Gamepad button routed from input.ts while the chooser shows (A/B/X → options 1-3). Returns true when consumed. */
  junctionGamepad(button: number): boolean;
  anchors: Record<string, HTMLElement>;
  reset(): void;
  /** Staggered slide-in of every HUD group (run start, after a cinematic). */
  enter(delay?: number): void;
  /** Fade the HUD out (cinematics). */
  hide(): void;
}

const RES: Array<{ key: ResourceKey; label: string; icon: string; help: string }> = [
  { key: 'rails', label: 'Rails', icon: '═', help: 'Spent to lay new track. Existing railway is free.' },
  { key: 'scrap', label: 'Scrap', icon: '⚙', help: 'Repairs hulls and buys or upgrades cars at yards.' },
  { key: 'coal', label: 'Coal', icon: '⬢', help: 'Fuel burned as the train moves. Heavy trains use more.' },
  { key: 'ammo', label: 'Ammo', icon: '➤', help: 'Consumed by guns. Weapons also need a supplier within two cars.' },
  { key: 'food', label: 'Food', icon: '✿', help: 'Feeds passengers and protects morale during long runs.' },
];
const WEATHER_ICON: Record<string, string> = { clear: '○', rain: '☂', fog: '≋', storm: '⚡', ashfall: '☁' };

export function createHud(ui: UiShared, actions: { openPause(): void; toggleReverse(): void }): Hud {
  // ---------- mission ticket: the run's north star ----------
  const missionSub = el('span', { class: 'rv-mission-sub', text: 'Region 1 / 4' });
  const missionFill = el('i');
  const missionEl = el('div', { class: 'rv-mission rv-panel', role: 'status', 'aria-label': 'Objective: reach the Last Gate to the east' },
    el('div', { class: 'rv-mission-head' },
      el('span', { class: 'rv-mission-roundel', 'aria-hidden': 'true', text: 'RA' }),
      el('span', { class: 'rv-mission-k', text: 'Eastbound directive' }),
      el('span', { class: 'rv-mission-live', text: 'Live run' })),
    el('strong', { text: 'Reach the Last Gate' }),
    el('div', { class: 'rv-mission-foot' }, missionSub, el('span', { class: 'rv-mission-track', 'aria-hidden': 'true' }, missionFill)),
  );

  // ---------- top-left: resources ----------
  const chips: Record<string, { el: HTMLElement; v: HTMLElement; cap: HTMLElement; fill: HTMLElement; flashTimer: number }> = {};
  const chipsEl = el('div', { class: 'rv-chips', role: 'group', 'aria-label': 'Resources' });
  for (const r of RES) {
    const v = el('span', { class: 'rv-chip-v', text: '0' });
    const capEl = el('span', { class: 'rv-chip-cap', text: '/0' });
    const fill = el('i');
    const chip = el('div', { class: 'rv-chip', 'data-key': r.key, 'aria-label': r.label, title: `${r.label}: ${r.help}`, tabindex: '0' },
      el('span', { class: 'rv-chip-top' },
        el('span', { class: 'rv-chip-ico', 'aria-hidden': 'true', text: r.icon }),
        el('span', { class: 'rv-chip-k', text: r.label })),
      el('span', { class: 'rv-chip-readout' }, v, capEl),
      el('span', { class: 'rv-chip-bar', 'aria-hidden': 'true' }, fill),
      el('span', { class: 'rv-chip-help', role: 'tooltip', text: r.help }));
    chips[r.key] = { el: chip, v, cap: capEl, fill, flashTimer: 0 };
    chipsEl.appendChild(chip);
  }
  // passengers + crew merged into one chip: ⚇ 12/20 · ⚒ 3 · ☺ 80
  const paxV = el('span', { class: 'rv-chip-v', text: '0' });
  const paxCap = el('span', { class: 'rv-chip-cap', text: '/0' });
  const crewV = el('span', { class: 'rv-chip-v rv-chip-crew', text: '0' });
  const morale = el('span', { class: 'rv-morale', text: '' });
  const peopleChip = el('div', { class: 'rv-chip rv-chip-people', title: 'Passengers, morale and crew. Activate to open crew assignment.', 'aria-label': 'Passengers and crew', tabindex: '0', role: 'button' },
    el('span', { class: 'rv-chip-top' }, el('span', { class: 'rv-chip-ico', 'aria-hidden': 'true', text: '⚇' }), el('span', { class: 'rv-chip-k', text: 'People' })),
    el('span', { class: 'rv-people-readout' },
      el('span', { class: 'rv-people-stat' }, el('small', { text: 'Passengers' }), paxV, paxCap),
      el('span', { class: 'rv-chip-sep', 'aria-hidden': 'true', text: '/' }),
      el('span', { class: 'rv-people-stat' }, el('small', { text: 'Crew' }), crewV), morale),
    el('span', { class: 'rv-chip-help', role: 'tooltip', text: 'Click to post an available specialist to a car. Passengers consume food; low morale puts them at risk.' }));
  const openCrewAssignment = (): void => {
    const s = ui.state();
    if (!s || !s.train.cars.length) return;
    const ready = s.train.crew.some(c => c.carIndex < 0);
    let target = s.train.cars.findIndex((c, i) => i > 0 && !c.crewId && c.hp > 0);
    if (target < 0) target = s.train.cars.length > 1 ? 1 : 0;
    ui.audio().ui('open');
    ui.selectCar(target, true);
    ui.notify(ready ? 'Crew ready: choose a specialist in the highlighted Crew Slot.' : 'Crew roster opened. Select any car to change its posting.', 'info', 4200, 'crew-help');
    window.setTimeout(() => {
      const choice = ui.root.querySelector<HTMLElement>('.rv-crew-choice:not(:disabled)');
      choice?.scrollIntoView({ block: 'nearest' });
      choice?.focus({ preventScroll: true });
    }, 260);
  };
  peopleChip.addEventListener('click', openCrewAssignment);
  peopleChip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCrewAssignment(); } });
  // Void Marks: the rare currency (markets sell relics for it, shrines take it)
  const marksV = el('span', { class: 'rv-chip-v', text: '0' });
  const marksChip = el('div', { class: 'rv-chip rv-chip-marks', title: 'Void Marks — rare currency from elites, bounties and expeditions. Markets sell relics for marks.', 'aria-label': 'Void Marks', tabindex: '0' },
    el('span', { class: 'rv-chip-top' }, el('span', { class: 'rv-chip-ico', 'aria-hidden': 'true', text: '◆' }), el('span', { class: 'rv-chip-k', text: 'Marks' })),
    el('span', { class: 'rv-chip-readout' }, marksV),
    el('span', { class: 'rv-chip-help', role: 'tooltip', text: 'Rare currency earned from elites, bounties and expeditions. Spend it at markets.' }));

  // relic bar: one icon chip per relic owned this run, with a hover / focus tooltip
  const relicsEl = el('div', { class: 'rv-relics', role: 'group', 'aria-label': 'Relics' });
  relicsEl.hidden = true;
  let relicSig = '';
  function updateRelics(s: SimState): void {
    const ids = s.train.relics ?? [];
    const sig = ids.join(',');
    if (sig === relicSig) return;
    const fresh = ids.slice(relicSig ? relicSig.split(',').length : 0);
    relicSig = sig;
    relicsEl.replaceChildren(
      el('span', { class: 'rv-relics-ico', 'aria-hidden': 'true', text: '✦' }),
      ...ids.map((id) => {
        const def = relicDef(id);
        const chip = el('button', { class: 'rv-relic-chip rv-r-' + (def?.rarity ?? 'common'), type: 'button', 'aria-label': `${def?.name ?? id}: ${def?.desc ?? ''}`, 'data-relic': id },
          el('span', { class: 'rv-relic-glyph', 'aria-hidden': 'true', text: def?.icon ?? '✦' }),
          el('span', { class: 'rv-relic-tip', role: 'tooltip' },
            el('b', { text: def?.name ?? id }),
            el('i', { class: 'rv-relic-rarity', text: def?.rarity ?? '' }),
            el('span', { text: def?.desc ?? '' })),
        );
        return chip;
      }),
    );
    show(relicsEl, ids.length > 0);
    if (fresh.length && !isReduced()) {
      const chips = Array.from(relicsEl.querySelectorAll<HTMLElement>('.rv-relic-chip')).slice(-fresh.length);
      gsap.fromTo(chips, { scale: 0, rotate: -40, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.55, ease: 'back.out(2)', stagger: 0.08, clearProps: 'transform,opacity' });
    }
  }

  // void meter
  const voidFill = el('i');
  const voidDist = el('span', { class: 'rv-void-dist', text: '—' });
  const voidEl = el('div', { class: 'rv-void rv-panel', role: 'meter', 'aria-label': 'Distance to the void front', 'aria-valuemin': '0', 'aria-valuemax': '24' },
    el('span', { class: 'rv-label', text: 'Void' }), el('div', { class: 'rv-bar' }, voidFill), voidDist);
  const operationsEl = el('div', { class: 'rv-deck-operations', 'aria-label': 'People, danger and relics' }, peopleChip, marksChip, voidEl, relicsEl);
  const tl = el('section', { class: 'rv-hud-tl', 'aria-label': 'Train manifest' },
    el('div', { class: 'rv-deck-heading' },
      el('span', { class: 'rv-deck-kicker', text: 'Train manifest' }),
      el('span', { class: 'rv-deck-rule', 'aria-hidden': 'true' })),
    el('div', { class: 'rv-deck-stack' }, chipsEl, operationsEl));

  // ---------- top-centre: status + boss ----------
  const regionEl = el('span', { class: 'rv-region', text: '' });
  const dialHand = el('i');
  const dial = el('span', { class: 'rv-dial', 'aria-hidden': 'true' }, dialHand);
  const dayLbl = el('span', { class: 'rv-daylbl', text: '☀' });
  const weatherEl = el('span', { class: 'rv-weather', text: '' });
  const weatherEffectEl = el('span', { class: 'rv-weather-effect', text: '' });
  const forecastEl = el('span', { class: 'rv-forecast', text: '' });
  const clockEl = el('span', { class: 'rv-clock', text: '00:00' });
  const statusEl = el('div', { class: 'rv-status rv-panel', role: 'status', 'aria-label': 'Region, time of day, weather and clock' },
    el('span', { class: 'rv-status-kicker', text: 'Line conditions' }),
    el('span', { class: 'rv-status-main' }, regionEl, dial, dayLbl, weatherEl, forecastEl, clockEl),
    weatherEffectEl);
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
  const tr = el('div', { class: 'rv-hud-tr' },
    el('div', { class: 'rv-deck-heading' },
      el('span', { class: 'rv-deck-kicker', text: 'Time controls' }),
      el('span', { class: 'rv-deck-rule', 'aria-hidden': 'true' })),
    el('div', { class: 'rv-row rv-command-actions' }, volume.button, speedEl, menuBtn), volume.pop);

  const top = el('div', { class: 'rv-hud-top' }, missionEl, tl, tc, tr);

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
  // current line: the edge behind the loco looked up in railLines ("Your track" on built rail)
  const onLineSw = el('i', { class: 'rv-line-sw', 'aria-hidden': 'true' });
  const onLineV = el('b', { text: '—' });
  const onLineEl = el('div', { class: 'rv-kv rv-online' }, el('span', { text: 'On' }), el('span', { class: 'rv-online-v' }, onLineSw, onLineV));
  // three-swatch legend; hovering / focusing expands each swatch to its one-line flavour
  const legendEl = el('div', { class: 'rv-line-legend', role: 'list', 'aria-label': 'Rail lines' },
    ...[0, 1, 2].map((id) => el('span', { class: 'rv-line-item rv-line-' + lineKey(id), role: 'listitem', tabindex: '0', style: `--line:${lineCss(id)}`, title: `${LINE_NAMES[id]} — ${lineFlavour(id)}` },
      el('i', { class: 'rv-line-sw', 'aria-hidden': 'true' }),
      el('span', { class: 'rv-line-name', text: (LINE_NAMES[id] ?? '').replace(/ Line$/, '') }),
      el('span', { class: 'rv-line-fl', text: lineFlavour(id) }))));
  const routeToggle = btn('⌖ Route', () => {
    const open = ui.root.classList.toggle('rv-route-open');
    setAttr(routeToggle, 'aria-expanded', String(open));
    ui.audio().ui(open ? 'open' : 'click');
  }, { class: 'rv-small rv-route-toggle', aria: 'Route tools' });
  setAttr(routeToggle, 'aria-expanded', 'false');
  setAttr(routeToggle, 'aria-controls', 'rv-route-tools');
  const routeEl = el('div', { class: 'rv-route rv-panel', role: 'group', 'aria-label': 'Route planning', tabindex: '-1' },
    routeToggle,
    el('div', { class: 'rv-route-head' }, el('span', { class: 'rv-route-ico', 'aria-hidden': 'true', text: '⌖' }), el('span', { class: 'rv-label', text: 'Route' })),
    el('div', { class: 'rv-route-details', id: 'rv-route-tools' },
      onLineEl,
      el('div', { class: 'rv-kv rv-ahead' }, el('span', { text: 'Planned ahead' }), el('span', null, aheadV, ' hex')),
      el('div', { class: 'rv-kv rv-range' }, el('span', { text: 'Plan range' }), el('span', null, rangeV, ' hex')),
      legendEl,
      el('div', { class: 'rv-route-btns' },
        railBtn('↶', 'Undo', () => { const sim = ui.sim(); if (!sim) return; const r = sim.unplanLast(); ui.audio().ui(r.ok ? 'click' : 'error'); if (!r.ok && r.reason) ui.notify(r.reason, 'warn'); }, { aria: 'Undo last planned hex (Backspace)' }),
        railBtn('✕', 'Clear', () => { const sim = ui.sim(); if (!sim) return; ui.audio().ui('click'); sim.clearPlan(); }, { aria: 'Clear planned route' }),
        railBtn('⌂', 'Center', () => { ui.audio().ui('click'); ui.view()?.centerOnTrain(); }, { aria: 'Center camera on train (F)' }),
        followBtn,
        reverseBtn,
        logBtn,
      ),
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
  const resumeBtn = btn('Resume journey', () => { ui.audio().ui('confirm'); ui.sim()?.resume(); }, { class: 'rv-small rv-primary', aria: 'Resume the journey (Space)' });
  const pausedEl = el('div', { class: 'rv-paused-callout rv-panel', role: 'status', 'aria-label': 'Journey paused' },
    el('span', { class: 'rv-paused-icon', 'aria-hidden': 'true', text: 'Ⅱ' }),
    el('span', { class: 'rv-paused-copy' }, el('b', { text: 'Journey paused' }), el('span', { text: 'Time and threats are stopped.' })),
    resumeBtn);
  pausedEl.hidden = true;

  // ---------- junction chooser: replaces the stop pill while the train waits at a branch ----------
  const junctionBtns = el('div', { class: 'rv-junction-opts', role: 'group', 'aria-label': 'Branches' });
  const junctionMap = el('div', { class: 'rv-junction-map', 'aria-label': 'Map-aligned branch dial' },
    el('span', { class: 'rv-jm-center', 'aria-hidden': 'true', text: '◎' }));
  const junctionEl = el('div', { class: 'rv-junction rv-route-overlay', role: 'group', 'aria-label': 'Junction — choose your line' },
    el('div', { class: 'rv-junction-head' },
      el('span', { class: 'rv-junction-ico', 'aria-hidden': 'true', text: '⑂' }),
      el('span', { class: 'rv-junction-title', text: 'Choose your route' }),
      el('span', { class: 'rv-junction-sub', text: 'Train held · choose to continue' }),
      el('span', { class: 'rv-junction-keys', 'aria-hidden': 'true', text: 'Click a numbered stop · or press 1–3' })),
    junctionMap);
  junctionEl.hidden = true;
  let junctionOpts: JunctionOption[] = [];
  let junctionSig = '';
  const KEY_HINT = ['1', '2', '3', '4', '5', '6'];
  function optionLabel(o: JunctionOption): string {
    const n = o.next;
    return n ? `${o.lineName} to ${n.name} (${nodeMeta(n.type).label}), ${n.distance} hex` : `${o.lineName}, dead end`;
  }
  function orderedJunction(opts: JunctionOption[]): JunctionOption[] {
    const s = ui.state();
    const end = s?.route.path[s.route.path.length - 1];
    if (!end) return [...opts];
    // Controls read left-to-right exactly as the branch endpoints appear on the map.
    return [...opts].sort((a, b) => {
      const ap = hexToWorld(a.col, a.row), bp = hexToWorld(b.col, b.row);
      return ap.x - bp.x || ap.y - bp.y;
    });
  }
  function buildJunction(opts: JunctionOption[]): void {
    const s = ui.state();
    const end = s?.route.path[s.route.path.length - 1];
    if (!end) return;
    setText(junctionEl.querySelector('.rv-junction-keys'), `Click a numbered stop · or press ${opts.map((_, i) => KEY_HINT[i]).join(' / ')}`);
    const width = junctionMap.clientWidth || 720, height = junctionMap.clientHeight || 400;
    // One uniform projection for every branch: preserve the rail bends and orientation.
    // Preview six edges; the destination label still reports the full distance.
    const traces = opts.map(o => (o.trace ?? [end, [o.col, o.row] as [number, number]]).slice(0, 7)
      .map(([c, r]) => { const p = hexToWorld(c, r); return { x: p.x, y: p.y * 0.62 }; }));
    const points = traces.flat();
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
    const marginX = Math.min(112, width * 0.24), marginY = Math.min(100, height * 0.27);
    const scale = Math.max(0.01, Math.min((width - marginX * 2) / Math.max(1, maxX - minX), (height - marginY * 2) / Math.max(1, maxY - minY)));
    const project = (p: { x: number; y: number }) => ({
      x: width / 2 + (p.x - (minX + maxX) / 2) * scale,
      y: height / 2 + (p.y - (minY + maxY) / 2) * scale,
    });
    const paths = traces.map(t => t.map(project));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.classList.add('rv-junction-rails');
    svg.setAttribute('aria-hidden', 'true');
    paths.forEach((path, i) => {
      const d = path.map((p, j) => `${j ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
      const group = document.createElementNS(svg.namespaceURI, 'g');
      group.setAttribute('data-branch', String(i));
      group.setAttribute('style', `--line:${lineCss(opts[i].line)}`);
      for (const cls of ['rv-rail-bed', 'rv-rail-ties', 'rv-rail-ink']) {
        const rail = document.createElementNS(svg.namespaceURI, 'path');
        rail.setAttribute('class', cls);
        rail.setAttribute('d', d);
        group.appendChild(rail);
      }
      group.setAttribute('data-trace', JSON.stringify((opts[i].trace ?? [end, [opts[i].col, opts[i].row]]).slice(0, 7)));
      svg.appendChild(group);
    });
    const origin = paths[0]?.[0] ?? { x: width / 2, y: height / 2 };
    const center = el('span', { class: 'rv-jm-center', 'aria-hidden': 'true', text: '◎', style: `left:${origin.x}px;top:${origin.y}px` },
      el('span', { class: 'rv-jm-you', text: 'Your train' }));
    junctionBtns.replaceChildren(...opts.map((o, i) => {
      const at = paths[i][paths[i].length - 1];
      const n = o.next;
      const b = btn('', () => chooseJunction(i), { class: 'rv-junction-opt rv-jm-endpoint', aria: `Branch ${KEY_HINT[i]}: ${optionLabel(o)}. Choose to continue.` });
      b.style.cssText = `--line:${lineCss(o.line)};left:${at.x}px;top:${at.y}px`;
      b.dataset.branch = String(i); b.dataset.col = String(o.col); b.dataset.row = String(o.row);
      b.dataset.traceLength = String(paths[i].length);
      b.append(el('span', { class: 'rv-jm-number', text: KEY_HINT[i] ?? '' }));
      const label = el('span', { class: 'rv-jm-label' },
        el('b', { text: n?.name ?? 'Track ends' }),
        el('span', { text: n ? `${nodeMeta(n.type).label} · ${n.distance} hex` : 'No known stop ahead' }),
        el('small', { text: o.lineName }));
      // Put northern labels above their node; southern labels below. No direction button tray.
      if (at.y < origin.y - 20) b.classList.add('rv-node-north');
      b.append(label);
      b.addEventListener('pointerenter', () => highlightBranch(i));
      b.addEventListener('pointerleave', () => highlightBranch(-1));
      b.addEventListener('focus', () => highlightBranch(i));
      b.addEventListener('blur', () => highlightBranch(-1));
      return b;
    }));
    junctionMap.replaceChildren(svg, center, junctionBtns);
    // Labels may move around their fixed node; rail geometry and node positions never do.
    const occupied = paths.map(p => { const a = p[p.length - 1]; return { x: a.x - 26, y: a.y - 26, w: 52, h: 52 }; });
    occupied.push({ x: origin.x - 42, y: origin.y - 24, w: 84, h: 70 });
    const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => Math.max(0, Math.min(a.x+a.w, b.x+b.w)-Math.max(a.x,b.x)) * Math.max(0, Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    Array.from(junctionBtns.children).forEach((button, i) => {
      const label = button.querySelector<HTMLElement>('.rv-jm-label')!;
      const at = paths[i][paths[i].length - 1];
      const w = label.offsetWidth, h = label.offsetHeight;
      const above = { x: at.x - w / 2, y: at.y - 32 - h, w, h };
      const below = { x: at.x - w / 2, y: at.y + 32, w, h };
      const candidates = at.y < origin.y - 20 ? [above, below] : [below, above];
      candidates.push({ x: at.x + 32, y: at.y-h/2, w, h }, { x: at.x-32-w, y: at.y-h/2, w, h });
      const scored = candidates.map((c, index) => {
        const box = { ...c, x: clamp(c.x, 0, Math.max(0, width-w)), y: clamp(c.y, 0, Math.max(0, height-h)) };
        return { box, score: occupied.reduce((sum, other) => sum + overlap(box, other), 0) + index };
      }).sort((a,b) => a.score-b.score);
      const best = scored[0].box;
      label.style.cssText = `left:${best.x-at.x+20}px;top:${best.y-at.y+20}px;bottom:auto;transform:none`;
      occupied.push({ x: best.x-4, y: best.y-4, w: w+8, h: h+8 });
    });
  }
  let junctionResizeFrame = 0;
  const junctionObserver = new ResizeObserver(() => {
    if (junctionResizeFrame || junctionEl.hidden) return;
    junctionResizeFrame = requestAnimationFrame(() => {
      junctionResizeFrame = 0;
      if (!junctionEl.hidden) buildJunction(junctionOpts);
    });
  });
  junctionObserver.observe(junctionMap);
  function highlightBranch(index: number): void {
    junctionEl.querySelectorAll<HTMLElement>('[data-branch]').forEach(node => {
      node.classList.toggle('rv-branch-highlight', Number(node.dataset.branch) === index);
    });
  }
  function chooseJunction(i: number): boolean {
    const o = junctionOpts[i];
    const sim = ui.sim();
    if (!o || !sim || junctionEl.hidden) return false;
    let r: { ok: boolean; reason?: string } = { ok: false };
    try { r = sim.planTile(o.col, o.row); } catch (e) { r = { ok: false, reason: e instanceof Error ? e.message : String(e) }; }
    ui.audio().ui(r.ok ? 'confirm' : 'error');
    if (!r.ok) { if (r.reason) ui.notify(r.reason, 'warn', 4200, 'junction'); return false; }
    // Picking a route is an explicit continue action; do not leave the player silently paused.
    if (ui.state()?.phase === 'paused') sim.resume();
    const b = junctionBtns.children[i] as HTMLElement | undefined;
    if (b && !isReduced()) gsap.fromTo(b, { scale: 1.06 }, { scale: 1, duration: 0.25, ease: 'power2.out', clearProps: 'transform' });
    return true;
  }
  function junctionGamepad(button: number): boolean {
    if (junctionEl.hidden) return false;
    const idx = button === 0 ? 0 : button === 1 ? 1 : button === 2 ? 2 : -1;
    if (idx < 0 || idx >= junctionOpts.length) return false;
    return chooseJunction(idx);
  }
  // keys 1-3 pick a branch while the chooser shows (they normally set the sim speed): capture phase so input.ts never sees them
  const onJunctionKey = (e: KeyboardEvent): void => {
    if (junctionEl.hidden || ui.anyModal() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const idx = KEY_HINT.indexOf(e.key);
    if (idx < 0 || idx >= junctionOpts.length) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    chooseJunction(idx);
  };
  document.addEventListener('keydown', onJunctionKey, true);

  const dock = el('div', { class: 'rv-dock' }, warningEl, pausedEl, stopEl);

  const root = el('div', { class: 'rv-hud' }, top, left, dock, junctionEl);

  // ---------- state caches ----------
  let lastResSig = '';
  let lastPhase = '';
  let lastSpeed = -1;
  let warnShown = false, bossShown = false, lastSecs = -1;
  let lastStopSig = '';
  const logSeen = new Set<string>();

  // Coalesce deltas for 400 ms: colour feedback and a stationary positive receipt.
  const pending: Partial<Record<ResourceKey, number>> = {};
  let flushTimer = 0;
  function flashResource(key: ResourceKey, delta: number): void {
    if (!chips[key]) return;
    pending[key] = (pending[key] ?? 0) + delta;
    if (!flushTimer) flushTimer = window.setTimeout(flushDeltas, 400);
  }
  const lootKeys = new Set<ResourceKey>();
  function flushDeltas(): void {
    flushTimer = 0;
    for (const k of Object.keys(pending) as ResourceKey[]) {
      const d = pending[k] ?? 0;
      delete pending[k];
      const c = chips[k];
      const loot = lootKeys.delete(k);
      if (!c || Math.abs(d) < 0.5) continue;
      const up = d > 0;
      c.el.classList.remove('rv-flash-up', 'rv-flash-down', 'rv-flash-loot');
      void c.el.offsetWidth;
      c.el.classList.add(loot && up ? 'rv-flash-loot' : up ? 'rv-flash-up' : 'rv-flash-down');
      if (c.flashTimer) clearTimeout(c.flashTimer);
      c.flashTimer = window.setTimeout(() => { c.el.classList.remove('rv-flash-up', 'rv-flash-down', 'rv-flash-loot'); c.flashTimer = 0; }, 500);
      if (isReduced()) continue;
      const n = Math.round(Math.abs(d));
      if (up) floatLabel(c.el, loot ? `+${n} ${k}` : `+${n}`, loot ? 'rv-gold rv-float-loot' : 'rv-good-text');
    }
    lootKeys.clear();
  }
  function flashLoot(kind: ResourceKey | 'marks', amount: number): void {
    if (kind === 'marks') return; // marks:change pops the ◆ chip
    if (!chips[kind]) return;
    lootKeys.add(kind);
    // the matching resource:change lands in the same flush; make sure a float happens even if it was filtered
    if (pending[kind] === undefined) { pending[kind] = 0; if (!flushTimer) flushTimer = window.setTimeout(flushDeltas, 400); }
    void amount;
  }
  let marksTimer = 0;
  function popMarks(delta: number): void {
    if (Math.abs(delta) < 0.5) return;
    const up = delta > 0;
    marksChip.classList.remove('rv-flash-loot', 'rv-flash-down');
    void marksChip.offsetWidth;
    marksChip.classList.add(up ? 'rv-flash-loot' : 'rv-flash-down');
    if (marksTimer) clearTimeout(marksTimer);
    marksTimer = window.setTimeout(() => { marksChip.classList.remove('rv-flash-loot', 'rv-flash-down'); marksTimer = 0; }, 600);
    if (isReduced()) return;
    floatLabel(marksChip, `${up ? '+' : '−'}${Math.round(Math.abs(delta))} ◆`, up ? 'rv-void-text rv-float-loot' : 'rv-danger-text');
  }

  const groups = (): HTMLElement[] => [missionEl, tl, tc, tr, routeEl, logEl, ...(Array.from(dock.children) as HTMLElement[])];
  function enter(delay = 0): void {
    root.classList.remove('rv-hud-off');
    groups().forEach(e => {
      gsap.killTweensOf(e);
      gsap.fromTo(e, { opacity: 0 }, { opacity: 1, duration: D(0.22), delay: D(delay), clearProps: 'opacity' });
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
    const marks = Math.max(0, Math.round(t.marks ?? 0));
    const sig = RES.map(r => `${Math.floor(t.resources[r.key])}/${Math.floor(t.capacity[r.key])}`).join('|') + `|${t.passengers}/${t.passengerCap}|${Math.round(t.morale)}|${t.crew.length}|${assigned}|${marks}`;
    if (sig === lastResSig) return;
    lastResSig = sig;
    setText(marksV, String(marks));
    setAttr(marksChip, 'aria-label', `Void Marks ${marks}`);
    toggleClass(marksChip, 'rv-has', marks > 0);
    for (const r of RES) {
      const c = chips[r.key];
      const v = Math.floor(t.resources[r.key] ?? 0), capV = Math.floor(t.capacity[r.key] ?? 0);
      setText(c.v, String(v));
      setText(c.cap, '/' + capV);
      setWidth(c.fill, capV > 0 ? clamp(v / capV, 0, 1) * 100 : 0);
      const low = capV > 0 ? v <= Math.max(3, capV * 0.15) : v <= 3;
      toggleClass(c.el, 'rv-low', low);
      toggleClass(c.el, 'rv-full', capV > 0 && v >= capV);
      setAttr(c.el, 'aria-label', `${r.label} ${v} of ${capV}${low ? ', low' : ''}. ${r.help}`);
    }
    setText(paxV, String(t.passengers));
    setText(paxCap, '/' + t.passengerCap);
    const m = Math.round(t.morale);
    setText(morale, t.passengers > 0 ? `☺ ${m}` : '');
    setText(crewV, t.crew.length ? `${assigned}/${t.crew.length}` : '0');
    setAttr(crewV, 'title', t.crew.length ? `${assigned} of ${t.crew.length} specialists posted to cars` : 'No crew specialists yet');
    toggleClass(peopleChip, 'rv-low', t.passengers > 0 && m < 30);
    toggleClass(peopleChip, 'rv-action', t.crew.some(c => c.carIndex < 0));
    setAttr(peopleChip, 'aria-label', `Passengers ${t.passengers} of ${t.passengerCap}, morale ${m}, crew ${t.crew.length} (${assigned} posted)`);
  }

  function updateMission(s: SimState): void {
    const p = s.route.path[Math.min(s.train.routeIndex, s.route.path.length - 1)];
    const col = p?.[0] ?? 0;
    const left = Math.max(0, MAP_W - 1 - col);
    setText(missionSub, `Region ${clamp(s.region + 1, 1, 4)} / 4 · ${left} hex east`);
    setWidth(missionFill, clamp(col / (MAP_W - 1), 0, 1) * 100);
    setAttr(missionEl, 'aria-label', `Objective: reach the Last Gate. Region ${s.region + 1} of 4, about ${left} hex east.`);
  }

  function updateStatus(s: SimState): void {
    setText(regionEl, REGION_NAMES[clamp(s.region, 0, 3)] ?? '');
    const deg = Math.round((s.dayTime ?? 0) * 360);
    const tf = `rotate(${deg}deg)`;
    if (dialHand.style.transform !== tf) dialHand.style.transform = tf;
    setText(dayLbl, s.isNight ? '☾ night' : '☀ day');
    const w = s.weather;
    setText(weatherEl, `${WEATHER_ICON[w.kind] ?? '○'} ${w.kind}`);
    const wd = WEATHER[w.kind];
    const intensity = clamp(w.intensity ?? 1, 0, 1);
    const speedMul = 1 - (1 - wd.speedMul) * intensity;
    const rangeMul = 1 - (1 - wd.rangeMul) * intensity;
    const cooling = wd.cooling * intensity;
    const weatherHelp = `${w.kind}: speed ${Math.round(speedMul * 100)}%, weapon range ${Math.round(rangeMul * 100)}%, ${cooling >= 0 ? '+' : ''}${Number(cooling.toFixed(1))} cooling`;
    const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))}%`;
    setText(weatherEffectEl, w.kind === 'clear' ? 'No weather penalties' : `Speed ${pct(speedMul - 1)} · Range ${pct(rangeMul - 1)} · Cooling ${cooling >= 0 ? '+' : ''}${Number(cooling.toFixed(1))}`);
    setAttr(weatherEl, 'title', weatherHelp);
    setAttr(statusEl, 'aria-label', `${REGION_NAMES[clamp(s.region, 0, 3)] ?? ''}, ${s.isNight ? 'night' : 'day'}, ${weatherHelp}, ${fmtTime(s.time)}`);
    const hasSignal = s.train.cars.some(c => c.type === 'signal' && c.hp > 0 && !c.disabled);
    setText(forecastEl, hasSignal && w.next && w.next !== w.kind ? `next: ${w.next} in ${Math.max(0, Math.ceil(w.timer))}s` : '');
    setText(clockEl, fmtTime(s.time));
    setAttr(dial, 'title', `Day ${Math.round((s.dayTime ?? 0) * 100)}%`);
  }

  function updateSpeed(s: SimState): void {
    const key = s.phase === 'paused' ? 0 : s.speedMul;
    // Modal state can change without phase/speed changing, so keep this outside the
    // render-signature early return. The callout must never linger behind a modal.
    show(pausedEl, s.phase === 'paused' && !ui.anyModal() && junctionEl.hidden);
    if (key === lastSpeed && s.phase === lastPhase) return;
    lastSpeed = key; lastPhase = s.phase;
    for (const { mul, b } of speedBtns) {
      const pressed = mul === 0 ? s.phase === 'paused' || s.speedMul === 0 : (s.phase !== 'paused' && s.speedMul === mul);
      setAttr(b, 'aria-pressed', pressed ? 'true' : 'false');
      if (mul === 0) {
        const paused = s.phase === 'paused';
        setText(b, paused ? '▶' : '⏸');
        setAttr(b, 'aria-label', paused ? 'Resume journey (Space)' : 'Pause journey (Space)');
        setAttr(b, 'title', paused ? 'Resume journey (Space)' : 'Pause journey (Space)');
      }
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
    updateLine(s);
  }

  let lastLine: number | null | undefined;
  function updateLine(s: SimState): void {
    let id: number | null = null;
    try { id = currentLine(s); } catch { id = null; }
    if (id === lastLine) return;
    lastLine = id;
    const known = id !== null;
    setText(onLineV, known ? lineName(id as number) : '—');
    onLineSw.style.background = known ? lineCss(id as number) : 'transparent';
    const st = known ? `--line:${lineCss(id as number)}` : '';
    if (onLineEl.getAttribute('style') !== st) onLineEl.setAttribute('style', st);
    toggleClass(onLineEl, 'rv-built', id === LINE_BUILT);
    toggleClass(onLineEl, 'rv-unknown', id === LINE_UNKNOWN);
    const fl = known ? lineFlavour(id as number) : '';
    setAttr(onLineEl, 'title', known ? `The locomotive is on the ${lineName(id as number)}${fl ? ' — ' + fl : ''}` : 'No track behind the locomotive yet');
    setAttr(onLineEl, 'aria-label', known ? `On: ${lineName(id as number)}` : 'On: no line');
  }

  /** Junction chooser: docked while the train waits at a branch with 2+ rail continuations. Returns true when it is showing. */
  let junctionAt = 0;
  let junctionPositionSig = '';
  function updateJunction(s: SimState, active: boolean): boolean {
    if (!active) {
      ui.view()?.setRouteOverlay(false);
      junctionPositionSig = '';
      ui.root.classList.remove('rv-junction-active');
      if (!junctionEl.hidden) { show(junctionEl, false); junctionSig = ''; junctionOpts = []; }
      return false;
    }
    const now = performance.now();
    const p = s.route.path;
    const end = p[p.length - 1];
    const sig = `${end ? end[0] + ',' + end[1] : ''}|${p.length}|${s.train.stopReason}|${Object.keys(s.route.railLines ?? {}).length}`;
    if (sig !== junctionPositionSig || now - junctionAt > 2000) {
      junctionPositionSig = sig;
      junctionAt = now;
      const opts = orderedJunction(readJunctionOptions(ui.sim(), s));
      const optSig = sig + '|' + opts.map(o => `${o.col},${o.row},${o.line},${o.next?.id ?? ''},${o.next?.distance ?? ''}`).join(';');
      if (optSig !== junctionSig) {
        junctionSig = optSig;
        junctionOpts = opts;
        buildJunction(opts);
      }
    }
    if (junctionOpts.length < 2) { ui.view()?.setRouteOverlay(false); ui.root.classList.remove('rv-junction-active'); if (!junctionEl.hidden) show(junctionEl, false); return false; }
    ui.view()?.setRouteOverlay(true);
    if (junctionEl.hidden) {
      ui.root.classList.add('rv-junction-active');
      if (ui.root.classList.contains('rv-map-first')) {
        ui.root.classList.remove('rv-train-open', 'rv-route-open');
        setAttr(routeToggle, 'aria-expanded', 'false');
      }
      show(junctionEl, true);
      if (!isReduced()) {
        gsap.fromTo(junctionEl, { opacity: 0 }, { opacity: 1, duration: 0.22, clearProps: 'opacity' });
      }
    }
    // A hidden→shown reset can return to the same observed size within one frame.
    // ResizeObserver need not fire, so never leave the hidden-size fallback in place.
    // Only rebuild on a real mismatch; ordinary ticks retain buttons and focus.
    const svg = junctionMap.querySelector('svg');
    const width = junctionMap.clientWidth, height = junctionMap.clientHeight;
    if (width > 0 && height > 0 && (!svg || svg.viewBox.baseVal.width !== width || svg.viewBox.baseVal.height !== height)) buildJunction(junctionOpts);
    return true;
  }

  function updateStop(s: SimState): void {
    const t = s.train;
    if (s.phase === 'victory' || s.phase === 'defeat') { show(stopEl, false); updateJunction(s, false); lastStopSig = ''; return; }
    // a branch to choose: the chooser replaces the stop pill (also when a plain 'no_route' stop sits at a fork)
    const atFork = t.stopped && !t.reversing && (t.stopReason === 'junction' || t.stopReason === 'no_route') && (s.phase === 'running' || s.phase === 'paused');
    if (updateJunction(s, atFork)) { show(stopEl, false); lastStopSig = ''; return; }
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
        case 'junction': text = 'Junction — choose a branch'; cls += ' rv-junction-stop'; ico = '⑂'; break;
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
    updateMission(s);
    updateResources(s);
    updateRelics(s);
    updateStatus(s);
    updateSpeed(s);
    updateVoid(s);
    updateWarning(s);
    updateRoute(s);
    updateStop(s);
    updateLog(s);
  }

  function reset(): void {
    ui.root.classList.remove('rv-route-open', 'rv-train-open', 'rv-junction-active');
    setAttr(routeToggle, 'aria-expanded', 'false');
    lastResSig = ''; lastPhase = ''; lastSpeed = -1; lastStopSig = '';
    warnShown = false; bossShown = false; lastSecs = -1; logSeen.clear(); reversingShown = false;
    setText(reverseBtn.querySelector('.rv-rb-lbl'), 'Reverse'); setText(reverseBtn.querySelector('.rv-rb-ico'), '◀'); toggleClass(reverseBtn, 'rv-reversing', false);
    for (const k of Object.keys(pending) as ResourceKey[]) delete pending[k];
    lootKeys.clear(); relicSig = ''; relicsEl.replaceChildren(); relicsEl.hidden = true;
    logLines.length = 0; logEl.replaceChildren();
    show(warningEl, false); show(bossEl, false); show(stopEl, false); show(pausedEl, false); show(junctionEl, false);
    junctionSig = ''; junctionOpts = []; junctionAt = 0; lastLine = undefined;
    junctionPositionSig = ''; ui.view()?.setRouteOverlay(false);
    volume.close();
  }

  const anchors: Record<string, HTMLElement> = { mission: missionEl, resources: chipsEl, people: peopleChip, void: voidEl, status: statusEl, speed: speedEl, menu: menuBtn, route: routeEl, stop: stopEl, junction: junctionEl, lines: legendEl, log: logEl, hud: root, top, dock, left, speaker: volume.button, marks: marksChip, relics: relicsEl };
  return {
    el: root, zones: { top, left, dock }, update, flashResource, flashLoot, popMarks, shakeRoute, anchors, reset, enter, hide,
    closePopovers() {
      if (volume.isOpen()) { volume.close(); return true; }
      if (ui.root.classList.contains('rv-map-first')) {
        if (ui.root.classList.contains('rv-bounties-open')) {
          ui.root.classList.remove('rv-bounties-open');
          const toggle = ui.root.querySelector<HTMLElement>('.rv-bounties-toggle');
          setAttr(toggle, 'aria-expanded', 'false'); toggle?.focus(); return true;
        }
        if (ui.root.classList.contains('rv-route-open')) {
          ui.root.classList.remove('rv-route-open'); setAttr(routeToggle, 'aria-expanded', 'false'); routeToggle.focus(); return true;
        }
        if (ui.root.classList.contains('rv-train-open')) {
          ui.root.classList.remove('rv-train-open');
          const toggle = ui.root.querySelector<HTMLElement>('.rv-train-toggle');
          setText(toggle, 'Manage train ▴'); setAttr(toggle, 'aria-expanded', 'false'); toggle?.focus(); return true;
        }
      }
      return false;
    },
    junctionVisible: () => !junctionEl.hidden,
    chooseJunction,
    junctionGamepad,
  };
}
