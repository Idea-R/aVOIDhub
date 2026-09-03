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
import { createLayout } from './layout';
import { createHoverCards } from './hovercards';
import { createRelicModal } from './relics';
import { createBountyTracker } from './bounties';
import { createCrewPicker } from './crewPicker';
import { createExpedition } from './expedition';
import { createAnnouncer } from './announce';
import { relicDef } from '../core/relics';
import { eventById } from '../core/passengerEvents';
import { nodeMeta } from './nodes';
import { ROMAN } from './levels';
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
  const hud = createHud(ui, {
    openPause: () => openPause(), toggleReverse: () => toggleReverse(),
    // first junction of a run: the chooser docks and the announcement card explains it once
    firstJunction: () => { if (ui.runActive()) announcer.announce({ cat: 'Junction', title: 'Choose your line', body: 'Each line has its own character. Click a branch, press 1-3, or A / B / X on a pad.', tone: 'gold', hold: 3.2 }); },
  });
  const layout = createLayout(ui, hud.zones);
  const cards = createHoverCards(ui, layout);
  const strip = createStrip(ui, { hover: (i, x, y) => cards.showCar(i, x, y), leave: () => cards.hideCar() });
  hud.zones.dock.appendChild(strip.el);
  const inspector = createInspector(ui);
  const shop = createShop(ui);
  const bounties = createBountyTracker(ui);
  hud.zones.left.insertBefore(bounties.el, hud.anchors.log);
  const announcer = createAnnouncer(ui);
  const relics = createRelicModal(ui, { relicBarAnchor: () => hud.anchors.relics ?? null });
  const expedition = createExpedition(ui);
  const tutorial = createTutorial(ui, (step) => {
    const a = hud.anchors;
    // steps anchored above the strip sit above the stop pill instead when it is showing, so the two never overlap
    const aboveStrip = a.junction && !a.junction.hidden ? a.junction : a.stop && !a.stop.hidden ? a.stop : strip.el;
    const map: Array<{ el: HTMLElement; side: 'below' | 'above' }> = [
      { el: a.route, side: 'below' }, { el: a.route, side: 'below' }, { el: a.mission, side: 'below' },
      { el: aboveStrip, side: 'above' }, { el: strip.el, side: 'above' }, { el: strip.el, side: 'above' },
      { el: strip.el, side: 'above' }, { el: a.junction, side: 'above' }, { el: strip.el, side: 'above' },
      { el: strip.el, side: 'above' },
    ];
    return map[step] ?? { el: a.status, side: 'below' };
  }, () => layout.freeZone());
  const cine = createCinematic(ui, {
    hideHud: () => { hud.hide(); tutorial.el.classList.add('rv-hud-off'); announcer.hold(true); },
    showHud: () => { tutorial.el.classList.remove('rv-hud-off'); announcer.hold(false); if (ui.runActive()) hud.enter(); },
    moodReset: () => mood.reset(),
  });
  const title = createTitle(ui, {
    newRun: (seed) => { ctx.newRun(seed); },
    // "Watch intro": a fresh run that plays the scripted opening (main.ts checks meta.introSeen on run:start)
    watchIntro: (seed) => { ctx.settings.setMeta({ introSeen: false }); ctx.newRun(seed); },
    continueRun: () => { if (!ctx.continueRun()) ui.notify('No save found.', 'warn'); },
    howto: () => ui.open('howto'),
    settings: () => ui.open('settings'),
  });
  const howto = createHowto(ui);
  const settings = createSettings(ui);
  const eventModal = createEventModal(ui);
  const crewPicker = createCrewPicker(ui, {
    // the sim keeps the site event active after "Send an expedition": cancelling returns to the site card
    onCancel: () => { const s = ui.state(); if (s && s.phase === 'event' && s.activeEvent?.defId === 'node_site') eventModal.show('node_site'); },
  });
  const pause = createPause(ui, {
    restart: () => { const s = ui.state(); ctx.newRun(s ? s.seed : undefined); },
    newSeed: () => ctx.newRun(),
    // AppContext owns the title transition. Calling showTitle() again here used to
    // race the side-panel close animation and could strand an empty yard over the title.
    quit: () => ctx.quitToTitle(),
  });
  const results = createResults(ui, {
    again: (seed) => ctx.newRun(seed),
    newRun: () => ctx.newRun(),
    title: () => ctx.quitToTitle(),
  });
  const input = createInput(ui, {
    togglePause: () => togglePause(),
    escape: () => onEscape(),
    toggleInspector: () => toggleInspector(),
    howto: () => { if (ui.isOpen('howto')) ui.close('howto'); else ui.open('howto'); },
    toggleMute: () => { const m = !ui.settings().muted; ctx.settings.set({ muted: m }); ctx.audio.setMuted(m); ui.notify(m ? 'Audio muted' : 'Audio on', 'info', 2500, 'audio'); },
    detachLast: () => detachLast(),
    toggleReverse: () => toggleReverse(),
    departOrClose: () => { const s = ui.state(); const sim = ui.sim(); if (!s || !sim) return; if (s.phase === 'shop') sim.closeShop(); else if (s.train.stopped && s.train.stopReason === 'settlement') sim.depart(); },
    junctionButton: (b) => hud.junctionGamepad(b),
    modalButton: (b) => {
      const top = ui.topModal();
      if (top === 'expedition') return expedition.gamepad(b);
      if (top === 'relic') return relics.gamepad(b);
      if (top === 'crewpick') return crewPicker.gamepad(b);
      return false;
    },
  });
  const mood = createMoodDriver(ui);

  ui.registerPanel('title', { el: title.el, modal: true, escClosable: false, anim: 'none', onOpen: () => title.onOpen(), onClose: () => title.onClose() });
  ui.registerPanel('gamepad', { el: input.overlay, modal: false });

  // DOM order = stacking order
  root.append(hud.el, shop.el, inspector.el, tutorial.el, announcer.el, cine.el, title.el, eventModal.el, crewPicker.el, expedition.el, relics.el, pause.el, settings, howto, results.el, input.overlay, cards.el);
  // toasts + confirm were created by UiShared; move them on top
  for (const cls of ['.rv-toasts', '.rv-overlay[aria-label="Confirm"]']) { const n = root.querySelector(cls); if (n) root.appendChild(n); }
  hud.el.hidden = true;

  // ---------- settings ----------
  applySettings(ui, ctx.settings.get());
  const unsubSettings = ctx.settings.onChange(s => { applySettings(ui, s); if (ui.isOpen('title')) title.refresh(); layout.measure(); });
  const onViewReady = () => { applySettings(ui, ctx.settings.get()); ctx.view?.resize(); };
  window.addEventListener('railavoid:viewready', onViewReady);
  const onResize = () => { layout.measure(); tutorial.reposition(); };
  window.addEventListener('resize', onResize);

  // ---------- flow helpers ----------
  let resultsShownFor = '';
  let lastPhase = '';

  function beginRun(): void {
    ui.root.classList.remove('rv-title-mode');
    ui.runActiveFlag = true;
    ui.closeAll();
    hud.reset(); strip.reset(); inspector.reset(); shop.reset(); mood.reset(); bounties.reset(); announcer.reset();
    pendingExpeditionEnd = null;
    tutorial.hide();
    ui.selectCar(-1);
    hud.el.hidden = false;
    hud.enter(0.12);
    layout.measure();
    resultsShownFor = '';
    lastPhase = '';
    ctx.audio.unlock();
    title.refresh();
  }
  function showTitle(): void {
    ui.runActiveFlag = false;
    // Title is an exclusive application mode. Apply the visual fence before animated
    // panels begin closing so no gameplay chrome can flash or become stranded over it.
    ui.root.classList.add('rv-title-mode');
    ui.closeAll();
    tutorial.hide();
    hud.el.hidden = true;
    ui.selectCar(-1);
    shop.reset();
    inspector.reset();
    ui.root.classList.remove('rv-shop-open', 'rv-inspector-open');
    mood.reset();
    announcer.reset();
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
    if (hud.closePopovers()) { ui.audio().ui('close'); return; }
    if (!ui.runActive()) {
      if (ui.topModal() && ui.topModal() !== 'title') ui.closeTop();
      return;
    }
    const top = ui.topModal();
    if (top === 'pause' || top === 'settings' || top === 'howto' || top === 'confirm' || top === 'crewpick') { ui.closeTop(); ui.audio().ui('close'); return; }
    if (top === 'event' || top === 'results' || top === 'relic' || top === 'expedition') return;
    if (ui.isOpen('inspector') && top !== 'shop') { ui.selectCar(-1); ui.audio().ui('close'); return; }
    if (ui.isOpen('inspector') && top === 'shop') { ui.selectCar(-1); ui.audio().ui('close'); return; }
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
      case 'shop': { const s = ui.state(); if (ui.runActive() && s && s.phase === 'shop') ui.open('shop'); else if (ui.runActive()) ui.notify('The shop is only open at repair yards.', 'warn'); break; }
      case 'settings': ui.open('settings'); break;
      case 'pause': openPause(); break;
      case 'none': for (const n of ['pause', 'settings', 'howto', 'confirm', 'inspector'] as PanelName[]) ui.close(n); ui.selectCar(-1); break;
    }
  }

  // ---------- bus ----------
  const bus = ctx.bus;
  const unsubs: Array<() => void> = [];
  const note = (text: string, kind: 'info' | 'warn' | 'good' | 'bad' = 'info', ttl?: number, group?: string): void => { if (ui.runActive()) ui.notify(text, kind, ttl, group); };
  const fmtRewards = (r: Partial<Record<ResourceKey, number>> | undefined): string =>
    r ? Object.entries(r).filter(([, v]) => (v ?? 0) !== 0).map(([k, v]) => `${(v ?? 0) > 0 ? '+' : ''}${Math.round(v ?? 0)} ${k}`).join(', ') : '';
  // everything that happens at one settlement (rewards, boarding, crew, deliveries) folds into a single toast
  let lastSettlement = '';
  let lastSettlementAt = 0;
  const settlementGroup = (): string | undefined => (performance.now() - lastSettlementAt < 2500 ? 'settlement:' + lastSettlement : undefined);
  // optional events from contracts that may land later (upgrades)
  const loose = bus as unknown as { on(name: string, h: (p: any) => void): () => void };
  // announcements: the big notices; small toasts stay for minor resource lines
  const say = (cat: string, title: string, body?: string, tone?: 'gold' | 'void' | 'good' | 'bad' | 'info', hold?: number): void => { if (ui.runActive()) announcer.announce({ cat, title, body, tone, hold }); };
  const CREW_LINE: Record<string, string> = {
    conductor: 'Leads the train and every expedition.', engineer: '+2 train power; stronger still on a generator.', gunner: '+35% fire rate and +15% range on a weapon.',
    medic: 'Heals the whole crew while posted.', surveyor: '+2 planning range and safer routes while posted.', mechanic: 'Repairs the assigned car continuously.',
    quartermaster: '+30% capacity for every resource while posted.',
  };
  let pendingExpeditionEnd: { outcome: string; summary: string; rounds: number } | null = null;
  const cinematicSoon = (fn: () => void): void => { window.setTimeout(() => { const v = ui.view(); if (v && v.isCinematicPlaying()) return; fn(); }, 220); };
  const fmtBountyReward = (r: { marks: number; rails: number; scrap: number }): string => [r.marks ? `◆ ${r.marks} marks` : '', r.rails ? `+${r.rails} rails` : '', r.scrap ? `+${r.scrap} scrap` : ''].filter(Boolean).join(' · ');
  unsubs.push(
    bus.on('relic:offer', () => { if (ui.runActive()) relics.show(); }),
    bus.on('relic:taken', ({ id }) => { const d = relicDef(id); say('Relic', d?.name ?? id, d?.desc ?? '', 'void'); }),
    bus.on('marks:change', ({ delta, why }) => {
      hud.popMarks(delta);
      if (delta >= 4) say('Rare salvage', `+${Math.round(delta)} Void Marks`, why === 'elite' ? 'An elite falls and leaves something the void wanted.' : why === 'bounty' ? 'A bounty paid in the only coin the void respects.' : why === 'expedition' ? 'Carried back from the ruins.' : 'The rare currency. Markets sell relics for it.', 'void');
    }),
    bus.on('loot:pickup', ({ kind, amount }) => { if (ui.runActive()) hud.flashLoot(kind, amount); }),
    bus.on('bounty:new', ({ id }) => { const b = ui.state()?.bounties.find(x => x.id === id); if (b) say('Bounty', b.title, `${b.fromName}: ${b.desc} Reward ${fmtBountyReward(b.reward)}.`, 'gold'); }),
    bus.on('bounty:progress', ({ id }) => bounties.pulse(id)),
    bus.on('bounty:done', ({ id, title, reward }) => { bounties.flash(id, 'done'); say('Bounty complete', title, `Paid in full: ${fmtBountyReward(reward)}.`, 'good'); }),
    bus.on('bounty:failed', ({ id, title }) => { bounties.flash(id, 'failed'); say('Bounty failed', title, 'The poster will not be paying.', 'bad'); }),
    bus.on('expedition:end', (p) => { pendingExpeditionEnd = p; }),
    bus.on('event:resolved', ({ defId, option, summary }) => {
      if (defId === 'node_site' && option === 0) { if (ui.runActive()) crewPicker.open(); return; }
      const def = eventById(defId);
      if (summary) say('Event', def?.title ?? 'Aboard the train', summary, def?.negative ? 'bad' : 'gold');
    }),
  );
  unsubs.push(
    bus.on('run:start', () => beginRun()),
    bus.on('run:loaded', () => beginRun()),
    bus.on('run:victory', () => showResults('victory')),
    bus.on('run:defeat', () => showResults('defeat')),
    bus.on('phase:change', ({ phase }) => handlePhase(phase)),
    bus.on('event:show', ({ defId }) => { if (ui.runActive()) eventModal.show(defId); }),
    bus.on('tutorial:step', ({ step, text }) => { if (ui.runActive()) tutorial.show(step, text); }),
    bus.on('ui:notify', ({ text, kind }) => note(text, kind)),
    bus.on('wave:warning', ({ type, from, in: secs }) => { const n = ENEMY_DEFS[type]?.name ?? type; note(`${n}s incoming from the ${String(from).toUpperCase()} in ${Math.ceil(secs)}s`, 'warn', 3000, 'wave'); }),
    bus.on('boss:spawn', ({ type, name }) => cinematicSoon(() => say('Boss', name, type === 'boss_wagon' ? 'Armoured target: cannon shells hit hardest. Keep moving while it lines up a ram.' : 'It blocks the line. Fight it or find a way around.', 'bad', 4.2))),
    bus.on('boss:died', ({ type }) => say('Boss', `${ENEMY_DEFS[type]?.name ?? 'Boss'} destroyed`, 'The line ahead is clear.', 'good')),
    bus.on('settlement:reached', ({ id, name, type, rewards, passengers, crew }) => {
      lastSettlement = id; lastSettlementAt = performance.now();
      const m = nodeMeta(type);
      const parts = [fmtRewards(rewards), passengers ? `${passengers} passengers` : '', crew ? `a ${crew}` : ''].filter(Boolean).join(' · ');
      if (type === 'yard' || type === 'shrine' || type === 'market' || type === 'site') say(m.label, name, parts || m.blurb || 'The train stops.', 'gold');
      else note(`${m.icon} ${name} (${m.label})${parts ? ' — ' + parts : ''}`, 'good', 5000, 'settlement:' + id);
    }),
    bus.on('settlement:consumed', ({ name, hadPassengers }) => note(`${name} was taken by the void${hadPassengers ? ` with ${hadPassengers} people` : ''}`, 'bad', 5000)),
    bus.on('region:enter', ({ region, name }) => cinematicSoon(() => say('Region', name || REGION_NAMES[region] || 'A new region', `Region ${region + 1} of 4. The void follows.`, 'info'))),
    bus.on('ui:selectCar', ({ index }) => ui.selectCar(index, index >= 0)),
    bus.on('ui:selectSettlement', ({ id }) => {
      if (!id) return;
      const st = ui.sim()?.settlementById(id);
      if (!st) return;
      const m = nodeMeta(st.type);
      const off = fmtRewards(st.offers);
      const status = st.consumed ? 'lost to the void' : st.visited ? 'visited' : `void in ${Math.max(0, Math.floor(st.deadline - (ui.state()?.time ?? 0)))}s`;
      note(`${m.icon} ${st.name} — ${m.label}${off ? ' · ' + off : ''}${st.passengers ? ` · ${st.passengers} waiting` : ''}${st.crew ? ` · ${st.crew}` : ''} · ${status}`, 'info', 5000, 'select');
    }),
    bus.on('ui:openPanel', ({ panel }) => openPanel(panel)),
    bus.on('resource:change', ({ key, delta }) => hud.flashResource(key, delta)),
    bus.on('resource:empty', ({ key }) => note(`Out of ${key}!`, 'bad', 4200, 'empty:' + key)),
    bus.on('crew:joined', ({ specialty, name }) => say('Crew ready', `${name} · ${specialty}`, `${CREW_LINE[specialty] ?? 'Another pair of hands on the line.'} Use the CREW READY ticket to post them.`, 'good')),
    bus.on('passengers:board', ({ count }) => { if (count >= 6) say('Passengers', `${count} passengers board`, 'Find them food, and a yard to deliver them to.', 'info'); else note(`${count} passengers boarded`, 'info', 4200, settlementGroup()); }),
    bus.on('passengers:delivered', ({ count, reward }) => note(`${count} passengers delivered — ${fmtRewards(reward) || 'thanks'}`, 'good', 5000, settlementGroup())),
    bus.on('passengers:lost', ({ count, cause }) => note(`${count} passengers lost (${cause})`, 'bad')),
    bus.on('gate:open', () => say('The last gate', 'The Gate Is Open', 'Drive through. Nothing behind you is worth turning for.', 'gold', 4)),
    bus.on('train:split', ({ atIndex, lost }) => note(`Train split at car ${atIndex + 1} — ${lost} car${lost === 1 ? '' : 's'} lost`, 'bad', 6000)),
    bus.on('car:destroyed', ({ type }) => { note(`${CAR_DEFS[type]?.name ?? type} destroyed`, 'bad'); strip.update(ui.state() as SimState, true); }),
    bus.on('train:damage', ({ carIndex }) => { if (ui.runActive()) strip.hit(carIndex); }),
    bus.on('sapper:planted', () => note('A sapper planted a charge on your track!', 'warn', 5000, 'sapper')),
    bus.on('sapper:defused', () => note('Sapper charge defused', 'good', 4200, 'sapper')),
    bus.on('track:blocked', ({ reason }) => { if (/plan range/i.test(reason || '')) hud.shakeRoute(); else note(reason || 'Track blocked', 'warn', 4200, 'track'); }),
    bus.on('day:phase', ({ night }) => note(night ? 'Night falls — enemies grow bolder' : 'Dawn breaks', 'info', 3000, 'day')),
    bus.on('rift:open', () => note('A void rift opened ahead!', 'bad', 5000, 'rift')),
    loose.on('car:upgraded', (p: { carIndex?: number; level?: number }) => {
      const s = ui.state(); const car = s?.train.cars[p?.carIndex ?? -1];
      const name = car ? CAR_DEFS[car.type]?.name ?? car.type : 'Car';
      note(`${name} upgraded to level ${ROMAN[p?.level ?? 0] ?? p?.level}`, 'good', 4200, 'upgrade');
      strip.update(ui.state() as SimState, true);
    }),
    loose.on('loco:upgraded', (p: { kind?: string; level?: number }) => note(`Locomotive ${p?.kind ?? 'upgrade'} → level ${ROMAN[p?.level ?? 0] ?? p?.level}`, 'good', 4200, 'upgrade')),
  );

  function handlePhase(phase: string): void {
    if (!ui.runActive()) return;
    if (phase === 'shop') {
      // The yard already contains the full consist and every car action. Close the
      // inspector before opening it so a second train surface cannot hide underneath.
      ui.selectCar(-1);
      ui.open('shop');
    } else if (ui.isOpen('shop')) ui.close('shop');
    if (phase === 'event') eventModal.show(); else if (ui.isOpen('event')) ui.close('event');
    if (phase === 'relic') relics.show(); else if (ui.isOpen('relic')) ui.close('relic');
    if (phase === 'expedition') expedition.show();
    else if (ui.isOpen('expedition')) {
      ui.close('expedition');
      const p = pendingExpeditionEnd; pendingExpeditionEnd = null;
      if (p) say('Expedition', p.outcome === 'won' ? 'Victory in the ruins' : p.outcome === 'lost' ? 'Beaten back' : 'The crew withdraws', p.summary, p.outcome === 'won' ? 'good' : p.outcome === 'lost' ? 'bad' : 'info');
    }
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
      if (now - hudAt >= 100) { hudAt = now; hud.update(s, now); layout.update(s); cards.update(); if (ui.isOpen('expedition')) expedition.update(s); }
      if (now - stripAt >= 200) { stripAt = now; strip.update(s); bounties.update(s); if (ui.isOpen('inspector')) inspector.update(s); }
      if (now - panelsAt >= 250) {
        panelsAt = now;
        if (ui.isOpen('shop')) shop.update(s);
        if (ui.isOpen('event')) eventModal.update(s);
        if (ui.isOpen('relic')) relics.update(s);
        if (tutorial.visible()) tutorial.reposition();
      }
    }
    mood.update(now);
  }

  function destroy(): void {
    for (const u of unsubs) u();
    unsubSettings();
    input.destroy();
    expedition.destroy();
    announcer.destroy();
    cine.destroy();
    layout.destroy();
    cards.destroy();
    window.removeEventListener('railavoid:viewready', onViewReady);
    window.removeEventListener('resize', onResize);
    ctx.audio.setEngine(0, 0);
    root?.replaceChildren();
  }

  return { update, showTitle, showResults, openPanel, destroy };
}
