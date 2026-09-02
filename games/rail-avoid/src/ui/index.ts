/**
 * RAILaVOID DOM UI. createUI(ctx) builds every screen inside #ui and returns the UiApi main.ts drives.
 * State is read fresh from ctx.sim each frame (the sim instance may be swapped at any time).
 */
import './styles.css';
import type { AppContext } from '../app';
import type { SimState, ResourceKey } from '../core/types';
import { UiShared, type PanelName } from './shared';
import { el } from './dom';
import { createTitle } from './title';
import { createHowto } from './howto';
import { createSettings, applySettings, createColorFilters } from './settings';
import { createHud } from './hud';
import { createStrip } from './strip';
import { createInspector } from './inspector';
import { createShop } from './shop';
import { createEventModal } from './eventModal';
import { createPause } from './pause';
import { createResults } from './results';
import { createTutorial } from './tutorial';
import { createInput } from './input';
import { createMoodDriver } from './mood';
import { createCinematic } from './cinematic';
import { CAR_DEFS } from '../core/cars';
import { ENEMY_DEFS } from '../core/enemies';
import { REGION_NAMES } from '../core/config';

export interface UiApi {
  update(dt: number): void;
  showTitle(): void;
  showResults(kind: 'victory' | 'defeat'): void;
  openPanel(p: 'train' | 'shop' | 'settings' | 'pause' | 'none'): void;
  destroy(): void;
}

export function createUI(ctx: AppContext): UiApi {
  let root = document.getElementById('ui');
  if (!root) { root = el('div', { id: 'ui' }); document.body.appendChild(root); }
  const ui = new UiShared(ctx, root);
  root.appendChild(createColorFilters());

  // ---------- build screens ----------
  const hud = createHud(ui, { openPause: () => openPause(), toggleReverse: () => toggleReverse() });
  const strip = createStrip(ui);
  hud.el.appendChild(strip.el);
  const inspector = createInspector(ui);
  const shop = createShop(ui);
  const tutorial = createTutorial(ui, (step) => {
    const a = hud.anchors;
    // steps anchored above the strip sit above the stop pill instead when it is showing, so the two never overlap
    const aboveStrip = a.stop && !a.stop.hidden ? a.stop : strip.el;
    const map: Array<{ el: HTMLElement; side: 'below' | 'above' }> = [
      { el: a.route, side: 'below' }, { el: a.route, side: 'below' }, { el: a.resources, side: 'below' },
      { el: aboveStrip, side: 'above' }, { el: aboveStrip, side: 'above' }, { el: a.void, side: 'below' },
      { el: a.status, side: 'below' }, { el: a.speed, side: 'below' }, { el: a.menu, side: 'below' },
    ];
    return map[step] ?? { el: a.status, side: 'below' };
  });
  const cine = createCinematic(ui, {
    hideHud: () => { hud.hide(); tutorial.el.classList.add('rv-hud-off'); },
    showHud: () => { tutorial.el.classList.remove('rv-hud-off'); if (ui.runActive()) hud.enter(); },
  });
  const title = createTitle(ui, {
    newRun: (seed) => { ctx.newRun(seed); },
    continueRun: () => { if (!ctx.continueRun()) ui.notify('No save found.', 'warn'); },
    howto: () => ui.open('howto'),
    settings: () => ui.open('settings'),
  });
  const howto = createHowto(ui);
  const settings = createSettings(ui);
  const eventModal = createEventModal(ui);
  const pause = createPause(ui, {
    restart: () => { const s = ui.state(); ctx.newRun(s ? s.seed : undefined); },
    newSeed: () => ctx.newRun(),
    quit: () => { ctx.quitToTitle(); showTitle(); },
  });
  const results = createResults(ui, {
    again: (seed) => ctx.newRun(seed),
    newRun: () => ctx.newRun(),
    title: () => { ctx.quitToTitle(); showTitle(); },
  });
  const input = createInput(ui, {
    togglePause: () => togglePause(),
    escape: () => onEscape(),
    toggleInspector: () => toggleInspector(),
    howto: () => { if (ui.isOpen('howto')) ui.close('howto'); else ui.open('howto'); },
    toggleMute: () => { const m = !ui.settings().muted; ctx.settings.set({ muted: m }); ctx.audio.setMuted(m); ui.notify(m ? 'Audio muted' : 'Audio on', 'info'); },
    detachLast: () => detachLast(),
    toggleReverse: () => toggleReverse(),
    departOrClose: () => { const s = ui.state(); const sim = ui.sim(); if (!s || !sim) return; if (s.phase === 'shop') sim.closeShop(); else if (s.train.stopped && s.train.stopReason === 'settlement') sim.depart(); },
  });
  const mood = createMoodDriver(ui);

  ui.registerPanel('title', { el: title.el, modal: true, escClosable: false, anim: 'none', onOpen: () => title.onOpen(), onClose: () => title.onClose() });
  ui.registerPanel('gamepad', { el: input.overlay, modal: false });

  // DOM order = stacking order
  root.append(hud.el, inspector.el, shop.el, tutorial.el, cine.el, title.el, eventModal.el, pause.el, settings, howto, results.el, input.overlay);
  // toasts + confirm were created by UiShared; move them on top
  for (const cls of ['.rv-toasts', '.rv-overlay[aria-label="Confirm"]']) { const n = root.querySelector(cls); if (n) root.appendChild(n); }
  hud.el.hidden = true;

  // ---------- settings ----------
  applySettings(ui, ctx.settings.get());
  const unsubSettings = ctx.settings.onChange(s => { applySettings(ui, s); if (ui.isOpen('title')) title.refresh(); });
  const onViewReady = () => { applySettings(ui, ctx.settings.get()); ctx.view?.resize(); };
  window.addEventListener('railavoid:viewready', onViewReady);
  const onResize = () => { tutorial.reposition(); };
  window.addEventListener('resize', onResize);

  // ---------- flow helpers ----------
  let resultsShownFor = '';
  let lastPhase = '';

  function beginRun(): void {
    ui.runActiveFlag = true;
    ui.closeAll();
    hud.reset(); strip.reset(); inspector.reset(); shop.reset(); mood.reset();
    tutorial.hide();
    ui.selectCar(-1);
    hud.el.hidden = false;
    hud.enter(0.12);
    resultsShownFor = '';
    lastPhase = '';
    ctx.audio.unlock();
    title.refresh();
  }
  function showTitle(): void {
    ui.runActiveFlag = false;
    ui.closeAll();
    tutorial.hide();
    hud.el.hidden = true;
    ui.selectCar(-1);
    mood.reset();
    ui.open('title');
  }
  function showResults(kind: 'victory' | 'defeat'): void {
    const s = ui.state();
    const key = `${kind}:${s?.seed ?? 0}:${Math.floor(s?.time ?? 0)}`;
    if (resultsShownFor === key) return;
    resultsShownFor = key;
    tutorial.hide();
    for (const p of ['pause', 'settings', 'howto', 'event', 'shop', 'confirm'] as PanelName[]) ui.close(p);
    // main.ts starts the victory/defeat cinematic right after this handler; let it finish before the results card.
    window.setTimeout(() => cine.onEnd(() => {
      if (resultsShownFor !== key || !ui.runActive()) return;
      results.show(kind);
      const m = ctx.settings.meta();
      if (s && s.stats && s.stats.score > m.bestScore) title.refresh();
    }), 80);
  }
  function openPause(): void {
    if (!ui.runActive()) return;
    if (ui.isOpen('pause')) return;
    ui.open('pause');
  }
  function togglePause(): void {
    const s = ui.state(); const sim = ui.sim();
    if (!s || !sim || !ui.runActive()) return;
    if (s.phase === 'running') { sim.pause(); ui.audio().ui('click'); }
    else if (s.phase === 'paused') { sim.resume(); ui.audio().ui('click'); }
  }
  function onEscape(): void {
    if (!ui.runActive()) {
      if (ui.topModal() && ui.topModal() !== 'title') ui.closeTop();
      return;
    }
    const top = ui.topModal();
    if (top === 'pause' || top === 'settings' || top === 'howto' || top === 'confirm') { ui.closeTop(); ui.audio().ui('close'); return; }
    if (top === 'event' || top === 'results') return;
    if (ui.isOpen('inspector') && top !== 'shop') { ui.selectCar(-1); ui.audio().ui('close'); return; }
    ui.audio().ui('open');
    openPause();
  }
  function toggleInspector(): void {
    const s = ui.state();
    if (!s) return;
    if (ui.isOpen('inspector')) { ui.selectCar(-1); ui.audio().ui('close'); }
    else { ui.selectCar(ui.selectedCar() >= 0 ? ui.selectedCar() : 0, true); ui.audio().ui('open'); }
  }
  async function detachLast(): Promise<void> {
    const s = ui.state(); const sim = ui.sim();
    if (!s || !sim || ui.anyModal()) return;
    const n = s.train.cars.length;
    if (n <= 1) { ui.notify('Nothing to detach — only the locomotive remains.', 'warn'); return; }
    const def = CAR_DEFS[s.train.cars[n - 1].type];
    if (await ui.confirm({ title: 'Detach last car', text: `Uncouple the ${def.name} (car ${n})? It is abandoned but lures enemies for 20 s.`, yes: 'Detach', danger: true })) {
      const ok = sim.detachFrom(n - 1);
      ui.audio().ui(ok ? 'confirm' : 'error');
      if (!ok) ui.notify('Could not detach.', 'warn');
    }
  }
  function toggleReverse(): void {
    const s = ui.state(); const sim = ui.sim();
    if (!s || !sim || !ui.runActive() || ui.anyModal()) return;
    if (s.phase !== 'running' && s.phase !== 'paused') return;
    const on = !sim.isReversing();
    sim.reverse(on);
    ui.audio().ui(on ? 'confirm' : 'click');
  }
  function openPanel(p: 'train' | 'shop' | 'settings' | 'pause' | 'none'): void {
    switch (p) {
      case 'train': toggleInspector(); break;
      case 'shop': { const s = ui.state(); if (s && s.phase === 'shop') ui.open('shop'); else ui.notify('The shop is only open at repair yards.', 'warn'); break; }
      case 'settings': ui.open('settings'); break;
      case 'pause': openPause(); break;
      case 'none': for (const n of ['pause', 'settings', 'howto', 'confirm', 'inspector'] as PanelName[]) ui.close(n); ui.selectCar(-1); break;
    }
  }

  // ---------- bus ----------
  const bus = ctx.bus;
  const unsubs: Array<() => void> = [];
  const note = (text: string, kind: 'info' | 'warn' | 'good' | 'bad' = 'info', ttl?: number): void => { if (ui.runActive()) ui.notify(text, kind, ttl); };
  const fmtRewards = (r: Partial<Record<ResourceKey, number>> | undefined): string =>
    r ? Object.entries(r).filter(([, v]) => (v ?? 0) !== 0).map(([k, v]) => `${(v ?? 0) > 0 ? '+' : ''}${Math.round(v ?? 0)} ${k}`).join(', ') : '';
  unsubs.push(
    bus.on('run:start', () => beginRun()),
    bus.on('run:loaded', () => beginRun()),
    bus.on('run:victory', () => showResults('victory')),
    bus.on('run:defeat', () => showResults('defeat')),
    bus.on('phase:change', ({ phase }) => handlePhase(phase)),
    bus.on('event:show', ({ defId }) => { if (ui.runActive()) eventModal.show(defId); }),
    bus.on('tutorial:step', ({ step, text }) => { if (ui.runActive()) tutorial.show(step, text); }),
    bus.on('ui:notify', ({ text, kind }) => note(text, kind)),
    bus.on('wave:warning', ({ type, from, in: secs }) => { const n = ENEMY_DEFS[type]?.name ?? type; note(`${n}s incoming from the ${String(from).toUpperCase()} in ${Math.ceil(secs)}s`, 'warn', 3000); }),
    bus.on('boss:spawn', ({ name }) => note(`BOSS — ${name}`, 'bad', 6000)),
    bus.on('boss:died', ({ type }) => note(`${ENEMY_DEFS[type]?.name ?? 'Boss'} destroyed!`, 'good', 6000)),
    bus.on('settlement:reached', ({ name, type, rewards, passengers, crew }) => {
      const parts = [fmtRewards(rewards), passengers ? `${passengers} passengers` : '', crew ? `a ${crew}` : ''].filter(Boolean).join(' · ');
      note(`${name} (${type})${parts ? ' — ' + parts : ''}`, 'good', 5000);
    }),
    bus.on('settlement:consumed', ({ name, hadPassengers }) => note(`${name} was taken by the void${hadPassengers ? ` with ${hadPassengers} people` : ''}`, 'bad', 5000)),
    bus.on('region:enter', ({ region, name }) => note(`Entering ${name || REGION_NAMES[region] || 'a new region'}`, 'info', 5000)),
    bus.on('ui:selectCar', ({ index }) => ui.selectCar(index, index >= 0)),
    bus.on('ui:selectSettlement', ({ id }) => {
      if (!id) return;
      const st = ui.sim()?.settlementById(id);
      if (!st) return;
      const off = fmtRewards(st.offers);
      const status = st.consumed ? 'lost to the void' : st.visited ? 'visited' : `deadline ${Math.max(0, Math.floor(st.deadline - (ui.state()?.time ?? 0)))}s`;
      note(`${st.name} — ${st.type}${off ? ' · ' + off : ''}${st.passengers ? ` · ${st.passengers} waiting` : ''}${st.crew ? ` · ${st.crew}` : ''} · ${status}`, 'info', 6000);
    }),
    bus.on('ui:openPanel', ({ panel }) => openPanel(panel)),
    bus.on('ui:hoverTile', (p) => hud.setHover(p)),
    bus.on('resource:change', ({ key, delta }) => hud.flashResource(key, delta)),
    bus.on('resource:empty', ({ key }) => note(`Out of ${key}!`, 'bad')),
    bus.on('crew:joined', ({ specialty, name }) => note(`${name} the ${specialty} joined the crew`, 'good')),
    bus.on('passengers:board', ({ count }) => note(`${count} passengers boarded`, 'info')),
    bus.on('passengers:delivered', ({ count, reward }) => note(`${count} passengers delivered — ${fmtRewards(reward) || 'thanks'}`, 'good', 5000)),
    bus.on('passengers:lost', ({ count, cause }) => note(`${count} passengers lost (${cause})`, 'bad')),
    bus.on('gate:open', () => note('THE LAST GATE IS OPEN — drive through!', 'good', 8000)),
    bus.on('train:split', ({ atIndex, lost }) => note(`Train split at car ${atIndex + 1} — ${lost} car${lost === 1 ? '' : 's'} lost`, 'bad', 6000)),
    bus.on('car:destroyed', ({ type }) => { note(`${CAR_DEFS[type]?.name ?? type} destroyed`, 'bad'); strip.update(ui.state() as SimState, true); }),
    bus.on('train:damage', ({ carIndex }) => { if (ui.runActive()) strip.hit(carIndex); }),
    bus.on('sapper:planted', () => note('A sapper planted a charge on your track!', 'warn', 5000)),
    bus.on('sapper:defused', () => note('Sapper charge defused', 'good')),
    bus.on('track:blocked', ({ reason }) => note(reason || 'Track blocked', 'warn')),
    bus.on('weather:change', ({ kind }) => note(`Weather: ${kind}`, 'info')),
    bus.on('day:phase', ({ night }) => note(night ? 'Night falls — enemies grow bolder' : 'Dawn breaks', 'info')),
    bus.on('rift:open', () => note('A void rift opened ahead!', 'bad', 5000)),
    bus.on('event:resolved', ({ summary }) => { if (summary) note(summary, 'info', 5000); }),
  );

  function handlePhase(phase: string): void {
    if (!ui.runActive()) return;
    if (phase === 'shop') ui.open('shop'); else if (ui.isOpen('shop')) ui.close('shop');
    if (phase === 'event') eventModal.show(); else if (ui.isOpen('event')) ui.close('event');
    if (phase === 'victory') showResults('victory');
    if (phase === 'defeat') showResults('defeat');
    lastPhase = phase;
  }

  // ---------- frame loop ----------
  let hudAt = 0, stripAt = 0, panelsAt = 0;
  function update(dt: number): void {
    const step = Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0.016;
    input.update(step);
    const now = performance.now();
    const s = ui.state();
    if (ui.runActive() && s) {
      if (s.phase !== lastPhase) handlePhase(s.phase);
      if (now - hudAt >= 100) { hudAt = now; hud.update(s, now); }
      if (now - stripAt >= 200) { stripAt = now; strip.update(s); if (ui.isOpen('inspector')) inspector.update(s); }
      if (now - panelsAt >= 250) {
        panelsAt = now;
        if (ui.isOpen('shop')) shop.update(s);
        if (ui.isOpen('event')) eventModal.update(s);
        if (tutorial.visible()) tutorial.reposition();
      }
    }
    mood.update(now);
  }

  function destroy(): void {
    for (const u of unsubs) u();
    unsubSettings();
    input.destroy();
    cine.destroy();
    window.removeEventListener('railavoid:viewready', onViewReady);
    window.removeEventListener('resize', onResize);
    ctx.audio.setEngine(0, 0);
    root?.replaceChildren();
  }

  return { update, showTitle, showResults, openPanel, destroy };
}
