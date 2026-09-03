/**
 * Expedition scene: a full-screen side-view stage shown while state.phase === 'expedition'.
 *
 * Flow (the sim owns every number, the UI owns time):
 *   player turn → action menu → sim.expeditionAction(kind, foe) → 'expedition:pending' (turn 'player')
 *     → wind-up (~0.9 s real time) with a shrinking ring → the player presses → judged PERFECT / GOOD / MISS
 *     → sim.expeditionResolve(timing) → impact animation, floating numbers from the HP diff
 *   enemy turn → 'expedition:pending' (turn 'enemy', kind 'attack' | 'skip')
 *     → foe wind-up with a GUARD prompt, same windows → resolve; 'skip' = stunned beat → resolve('miss')
 *   outcome → result card → sim.endExpedition()
 * Pending events arrive synchronously inside resolve(); they are queued and played one at a time.
 * Timing windows use performance.now(), never gsap, so reduced motion and 4x sim speed leave them intact.
 */
import './expedition.css';
import { el, btn, setText, setWidth, toggleClass, show, cap, focusables } from './dom';
import type { UiShared, AudioCue } from './shared';
import type { SimState, ExpeditionState, ExpeditionTiming, ExpeditionActionKind } from '../core/types';
import { SPECIALS } from '../sim/expedition';
import { EXPEDITION } from '../core/config';
import { gsap, D, isReduced, shake, Particles, popIn } from './motion';
import { crewSilhouette, foeSilhouette } from './silhouettes';
import conductorCombat from '/art/crew/conductor-combat.webp?url&inline';
import ruinApproach from '/art/scenes/ruin-approach-v1.webp?url&inline';
import buriedConcourse from '/art/scenes/buried-concourse-v1.webp?url&inline';
import voidSanctum from '/art/scenes/void-sanctum-v1.webp?url&inline';
import railThug from '/art/enemies/rail-thug-v1.webp?url&inline';
import voidHound from '/art/enemies/void-hound-v1.webp?url&inline';
import voidShade from '/art/enemies/void-shade-v1.webp?url&inline';
import scrapBrute from '/art/enemies/scrap-brute-v1.webp?url&inline';

export interface ExpeditionScene {
  el: HTMLElement;
  show(): void;
  update(s: SimState): void;
  /** Gamepad button press routed from input.ts while the scene is the top modal. Returns true when consumed. */
  gamepad(button: number): boolean;
  destroy(): void;
}

const PERFECT_MS = 70;
const GOOD_MS = 180;
const WINDUP: Record<string, number> = { thug: 0.9, hound: 0.72, shade: 1.0, brute: 1.15 };
const ACTOR_COLORS: Record<string, string> = { conductor: '#e8c170', engineer: '#ff8f3a', gunner: '#e86f6f', medic: '#6fb7e8', surveyor: '#8ee29a', mechanic: '#c98a4b', quartermaster: '#d6b4f0' };
const FOE_COLORS: Record<string, string> = { thug: '#a3a8b8', hound: '#9a8cff', shade: '#d6b4f0', brute: '#c98a4b' };
const SCENE_ART: Record<string, string> = { ruin_approach: ruinApproach, buried_concourse: buriedConcourse, void_sanctum: voidSanctum };
const STAGE_NAMES: Record<string, string> = { ruin_approach: 'Outer Works', buried_concourse: 'Buried Concourse', void_sanctum: 'Void Sanctum' };
const FOE_ART: Record<string, string> = { thug: railThug, hound: voidHound, shade: voidShade, brute: scrapBrute };

interface Pending { kind: string; turn: 'player' | 'enemy'; actorIndex: number; foeIndex: number; actionKind: ExpeditionActionKind }
interface ActorCard { id: string; el: HTMLElement; fig: HTMLElement; hpFill: HTMLElement; hpText: HTMLElement; guard: HTMLElement; lane: HTMLElement; sig: string }
interface FoeCard { id: string; el: HTMLButtonElement; fig: HTMLElement; hpFill: HTMLElement; hpText: HTMLElement; stun: HTMLElement; sig: string }

type Mode = 'idle' | 'menu' | 'timing' | 'anim' | 'intermission' | 'result';

export function createExpedition(ui: UiShared): ExpeditionScene {
  // ---------- DOM ----------
  const motes = el('canvas', { class: 'rv-exp-motes', 'aria-hidden': 'true' });
  const layers = { far: el('div', { class: 'rv-exp-layer rv-exp-far', 'aria-hidden': 'true' }), mid: el('div', { class: 'rv-exp-layer rv-exp-mid', 'aria-hidden': 'true' }), near: el('div', { class: 'rv-exp-layer rv-exp-near', 'aria-hidden': 'true' }) };
  const sceneImg = el('img', { class: 'rv-exp-scene-art', alt: '', 'aria-hidden': 'true' });
  const bg = el('div', { class: 'rv-exp-bg' }, sceneImg, el('div', { class: 'rv-exp-sky' }), layers.far, motes, layers.mid, el('div', { class: 'rv-exp-ground' }), layers.near, el('div', { class: 'rv-exp-vignette' }));
  const siteEl = el('span', { class: 'rv-exp-site', text: '' });
  const stageEl = el('b', { text: '1 / 2' });
  const stageNameEl = el('span', { class: 'rv-exp-stage-name', text: 'Outer Works' });
  const roundEl = el('b', { text: '1' });
  const roundMax = el('span', { text: '/ ' + EXPEDITION.maxRounds });
  const tickerText = el('span', { class: 'rv-exp-ticker-text', text: '' });
  const ticker = el('div', { class: 'rv-exp-ticker', role: 'status', 'aria-live': 'polite' }, el('span', { class: 'rv-exp-ticker-ico', 'aria-hidden': 'true', text: '▲' }), tickerText);
  const top = el('div', { class: 'rv-exp-top' },
    el('div', { class: 'rv-exp-title' }, el('span', { class: 'rv-label', text: 'Expedition' }), siteEl),
    el('div', { class: 'rv-exp-stage-readout', 'aria-label': 'Expedition stage' }, el('span', { class: 'rv-label', text: 'Stage' }), stageEl, stageNameEl),
    el('div', { class: 'rv-exp-round', 'aria-label': 'Round' }, el('span', { class: 'rv-label', text: 'Round' }), roundEl, roundMax),
    ticker,
  );
  const crewEl = el('div', { class: 'rv-exp-crew', role: 'group', 'aria-label': 'Crew' });
  const foesEl = el('div', { class: 'rv-exp-foes', role: 'group', 'aria-label': 'Foes' });
  const fxLayer = el('div', { class: 'rv-exp-fx', 'aria-hidden': 'true' });
  const ringOuter = el('div', { class: 'rv-exp-ring-outer' });
  const ringBeat = el('div', { class: 'rv-exp-ring-beat' });
  const ringLabel = el('div', { class: 'rv-exp-ring-label', text: '' });
  const ring = el('div', { class: 'rv-exp-ring', 'aria-hidden': 'true' }, ringBeat, ringOuter, ringLabel);
  ring.hidden = true;
  const judgeEl = el('div', { class: 'rv-exp-judge', role: 'status', 'aria-live': 'assertive' });
  judgeEl.hidden = true;
  const rallyEl = el('div', { class: 'rv-exp-rally', role: 'status' }, el('span', { class: 'rv-exp-rally-ico', 'aria-hidden': 'true', text: '♪' }), el('span', { text: 'RALLIED — the crew deals +50% damage this round' }));
  rallyEl.hidden = true;
  const formationRules = el('div', { class: 'rv-exp-formation-rules' },
    el('span', { text: 'FRONT +20% strike · draws melee' }),
    el('span', { text: 'MIDDLE balanced' }),
    el('span', { text: 'REAR +20% ranged special · draws ranged' }),
  );
  const stage = el('div', { class: 'rv-exp-stage' }, formationRules, crewEl, foesEl, fxLayer, ring, judgeEl, rallyEl);
  const promptEl = el('div', { class: 'rv-exp-prompt', role: 'status' });
  promptEl.hidden = true;

  // action menu
  const menuName = el('b', { text: '' });
  const menuSpec = el('span', { class: 'rv-exp-menu-spec', text: '' });
  const targetEl = el('span', { class: 'rv-exp-target', text: '' });
  const actionBtn = (kind: ExpeditionActionKind, label: string, key: string, desc: string) => {
    const b = el('button', { class: 'rv-btn rv-exp-action rv-exp-a-' + kind, type: 'button', 'data-kind': kind, 'aria-label': `${label} (${key})` },
      el('span', { class: 'rv-exp-a-key', 'aria-hidden': 'true', text: key }),
      el('span', { class: 'rv-exp-a-label', text: label }),
      el('span', { class: 'rv-exp-a-desc', text: desc }));
    b.addEventListener('click', () => act(kind));
    return b;
  };
  const strikeBtn = actionBtn('strike', 'Strike', 'S', 'Press on impact for a perfect hit.');
  strikeBtn.dataset.autofocus = '';
  const guardBtn = actionBtn('guard', 'Guard', 'G', 'Brace: the next blow is halved.');
  const specialBtn = actionBtn('special', 'Special', 'E', '');
  const swapBtn = actionBtn('swap', 'Swap', 'W', 'Trade lines with the next ally. Ends this turn.');
  const fleeBtn = actionBtn('flee', 'Flee', 'F', 'Back to the train. No reward.');
  const menu = el('div', { class: 'rv-exp-menu rv-panel', role: 'group', 'aria-label': 'Actions' },
    el('div', { class: 'rv-exp-menu-head' }, el('span', { class: 'rv-label', text: 'Your move' }), menuName, menuSpec, targetEl),
    el('div', { class: 'rv-exp-actions' }, strikeBtn, guardBtn, specialBtn, swapBtn, fleeBtn),
    el('div', { class: 'rv-hint', text: 'Pick target 1-3 · S strike · G guard · E special · W swap · F retreat · Space/Enter on impact' }),
  );
  menu.hidden = true;
  const logEl = el('div', { class: 'rv-exp-log rv-panel', role: 'log', 'aria-live': 'polite', 'aria-label': 'Expedition log' });
  const bottom = el('div', { class: 'rv-exp-bottom' }, menu, logEl);
  const resultEl = el('div', { class: 'rv-exp-result-ov' });
  resultEl.hidden = true;
  const stageGateEl = el('div', { class: 'rv-exp-stage-gate' });
  stageGateEl.hidden = true;
  const root = el('div', { class: 'rv-exp', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Expedition' }, bg, top, stage, promptEl, bottom, stageGateEl, resultEl);

  const particles = new Particles(motes, 70, ['109,95,214', '154,140,255', '200,120,255']);

  // ---------- state ----------
  let actorCards: ActorCard[] = [];
  let foeCards: FoeCard[] = [];
  let builtFor = '';
  let mode: Mode = 'idle';
  let busy = false;
  const queue: Pending[] = [];
  let target = 0;
  let logCount = 0;
  let lastRound = 0;
  let endSummary: { outcome: string; summary: string; rounds: number } | null = null;
  let timing: { impact: number; windup: number; raf: number; done: boolean; pressed: boolean; result: ExpeditionTiming | null; onJudged: (t: ExpeditionTiming) => void; kind: 'attack' | 'guard' } | null = null;
  let driftTl: gsap.core.Timeline | null = null;
  let introUntil = 0;
  let px = 0, py = 0;

  const x = (): ExpeditionState | null => ui.state()?.expedition ?? null;
  const shakeOk = (): boolean => !!ui.settings().screenShake && !isReduced();
  const cue = (name: AudioCue): void => { try { ui.audio().cue?.(name); } catch { /* */ } };

  // ---------- build ----------
  function build(xs: ExpeditionState): void {
    sceneImg.setAttribute('src', SCENE_ART[xs.stageKey] ?? ruinApproach);
    sceneImg.dataset.scene = xs.stageKey;
    setText(stageEl, `${xs.stage} / ${xs.stageCount}`);
    setText(stageNameEl, STAGE_NAMES[xs.stageKey] ?? 'Ruin Depths');
    actorCards = xs.actors.map((a, i) => {
      const hpFill = el('i');
      const hpText = el('span', { class: 'rv-exp-hp-text', text: `${a.hp}/${a.maxHp}` });
      const guard = el('span', { class: 'rv-exp-guard', title: 'Guarding: next hit halved', text: '⛨' });
      const lane = el('span', { class: `rv-exp-lane rv-lane-${a.position}`, text: a.position });
      const fig = a.specialty === 'conductor'
        ? el('div', { class: 'rv-exp-fig rv-exp-fig-authored' }, el('img', { src: conductorCombat, alt: '', 'aria-hidden': 'true' }))
        : el('div', { class: 'rv-exp-fig', html: crewSilhouette(a.specialty, 118) });
      const card = el('div', { class: 'rv-exp-actor', style: `--accent:${ACTOR_COLORS[a.specialty] ?? '#e8c170'}`, 'data-index': String(i), 'aria-label': `${a.name}, ${a.specialty}` },
        el('span', { class: 'rv-exp-turn', 'aria-hidden': 'true', text: '▶' }),
        fig,
        el('div', { class: 'rv-exp-card' },
          el('div', { class: 'rv-exp-name' }, el('b', { text: a.name }), guard),
          el('div', { class: 'rv-exp-spec' }, el('span', { text: cap(a.specialty) }), lane),
          el('div', { class: 'rv-exp-hp' }, el('div', { class: 'rv-bar' }, hpFill), hpText),
        ),
        el('div', { class: 'rv-exp-downed', text: 'DOWN' }),
      );
      return { id: a.id, el: card, fig, hpFill, hpText, guard, lane, sig: '' };
    });
    foeCards = xs.foes.map((f, i) => {
      const hpFill = el('i');
      const hpText = el('span', { class: 'rv-exp-hp-text', text: `${f.hp}/${f.maxHp}` });
      const stun = el('span', { class: 'rv-exp-stun', title: 'Stunned: skips its next attack', text: '✦ stunned' });
      const art = FOE_ART[f.kind];
      const fig = art
        ? el('div', { class: 'rv-exp-fig rv-exp-fig-enemy' }, el('img', { src: art, alt: '', 'aria-hidden': 'true' }))
        : el('div', { class: 'rv-exp-fig', html: foeSilhouette(f.kind, 130) });
      const card = el('button', { class: 'rv-exp-foe', type: 'button', style: `--accent:${FOE_COLORS[f.kind] ?? '#a3a8b8'}`, 'data-index': String(i), 'aria-label': `Target ${f.name} (${i + 1})`, tabindex: '-1' },
        el('span', { class: 'rv-exp-key', 'aria-hidden': 'true', text: String(i + 1) }),
        el('span', { class: 'rv-exp-reticle', 'aria-hidden': 'true' }),
        fig,
        el('div', { class: 'rv-exp-card' },
          el('div', { class: 'rv-exp-name' }, el('b', { text: f.name }), stun),
          el('div', { class: 'rv-exp-hp' }, el('div', { class: 'rv-bar' }, hpFill), hpText),
          el('div', { class: 'rv-exp-tell', text: f.desc }),
        ),
      );
      card.addEventListener('click', () => { if (mode !== 'menu') return; setTarget(i); ui.audio().ui('click'); });
      card.addEventListener('pointerenter', () => { if (mode === 'menu' && xs.foes[i].hp > 0) ui.audio().ui('hover'); });
      return { id: f.id, el: card, fig, hpFill, hpText, stun, sig: '' };
    });
    crewEl.replaceChildren(...actorCards.map(c => c.el));
    foesEl.replaceChildren(...foeCards.map(c => c.el));
    logEl.replaceChildren();
    logCount = 0;
    setText(siteEl, xs.siteId);
    lastRound = xs.round;
    setText(roundEl, String(xs.round));
    target = xs.foes.findIndex(f => f.hp > 0);
    refresh(xs, true);
    updateTicker(xs);
    // entrance: crew walk in from the left, foes loom in from the right
    if (!isReduced()) {
      gsap.fromTo(actorCards.map(c => c.el), { x: -160, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.12, clearProps: 'transform,opacity' });
      gsap.fromTo(foeCards.map(c => c.el), { x: 160, opacity: 0, scale: 1.1 }, { x: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out', stagger: 0.12, delay: 0.2, clearProps: 'transform,opacity' });
      gsap.fromTo(top, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', clearProps: 'transform,opacity' });
    }
  }

  function refresh(xs: ExpeditionState, force = false): void {
    xs.actors.forEach((a, i) => {
      const c = actorCards[i]; if (!c) return;
      const sig = `${a.hp}|${a.guard}|${a.down}|${a.position}|${xs.turn === 'player' && xs.activeActor === i && !xs.outcome}`;
      if (!force && sig === c.sig) return;
      c.sig = sig;
      const r = a.maxHp > 0 ? a.hp / a.maxHp : 0;
      setWidth(c.hpFill, r * 100);
      c.hpFill.style.background = r < 0.3 ? 'var(--danger)' : r < 0.6 ? 'var(--gold)' : 'var(--good)';
      setText(c.hpText, `${Math.max(0, Math.round(a.hp))}/${a.maxHp}`);
      toggleClass(c.el, 'rv-guarding', a.guard > 0 && !a.down);
      toggleClass(c.el, 'rv-down', a.down);
      toggleClass(c.el, 'rv-active', xs.turn === 'player' && xs.activeActor === i && !a.down && !xs.outcome);
      c.el.style.order = String(a.position === 'front' ? 1 : a.position === 'middle' ? 2 : 3);
      c.lane.className = `rv-exp-lane rv-lane-${a.position}`;
      setText(c.lane, a.position);
    });
    xs.foes.forEach((f, i) => {
      const c = foeCards[i]; if (!c) return;
      const sig = `${f.hp}|${f.stunned}|${target === i}|${xs.turn === 'enemy' && xs.activeFoe === i}`;
      if (!force && sig === c.sig) return;
      c.sig = sig;
      const r = f.maxHp > 0 ? f.hp / f.maxHp : 0;
      setWidth(c.hpFill, r * 100);
      setText(c.hpText, `${Math.max(0, Math.round(f.hp))}/${f.maxHp}`);
      toggleClass(c.el, 'rv-stunned', f.stunned > 0 && f.hp > 0);
      toggleClass(c.el, 'rv-dead', f.hp <= 0);
      toggleClass(c.el, 'rv-target', target === i && f.hp > 0);
      toggleClass(c.el, 'rv-acting', xs.turn === 'enemy' && xs.activeFoe === i && f.hp > 0);
      c.el.setAttribute('aria-pressed', target === i ? 'true' : 'false');
      c.el.disabled = f.hp <= 0;
    });
    show(rallyEl, xs.rally > 0 && !xs.outcome);
    swapBtn.disabled = xs.actors.filter(a => !a.down).length < 2;
    updateLog(xs);
  }

  function updateLog(xs: ExpeditionState): void {
    if (xs.log.length === logCount) return;
    const fresh = xs.log.slice(logCount);
    logCount = xs.log.length;
    for (const line of fresh) {
      const kind = /hits .* for/.test(line) ? (/goes down|too close/.test(line) ? 'bad' : 'hit') : /Victory|rallies|patches|leaves/.test(line) ? 'good' : /down|beaten|withdrew|runs for/.test(line) ? 'bad' : 'info';
      const n = el('div', { class: 'rv-exp-log-line rv-l-' + kind, text: line });
      logEl.appendChild(n);
      if (!isReduced()) gsap.fromTo(n, { x: 16, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out', clearProps: 'transform' });
    }
    while (logEl.children.length > 7) logEl.removeChild(logEl.firstChild!);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function updateTicker(xs: ExpeditionState): void {
    const lost = xs.rounds * EXPEDITION.voidSecondsPerRound;
    setText(tickerText, `VOID +${EXPEDITION.voidSecondsPerRound}s / ROUND · ${lost}s spent · stage ${xs.stage}/${xs.stageCount} · round ${xs.round}/${EXPEDITION.maxRounds}`);
    setText(roundEl, String(Math.min(xs.round, EXPEDITION.maxRounds)));
    toggleClass(ticker, 'rv-hot', xs.round >= EXPEDITION.maxRounds - 1);
  }

  // ---------- menu ----------
  function enterMenu(): void {
    const xs = x();
    if (!xs || xs.outcome || xs.awaitingAdvance || xs.turn !== 'player' || xs.pending) return;
    mode = 'menu';
    const a = xs.actors[xs.activeActor];
    if (!a) return;
    if (target < 0 || !xs.foes[target] || xs.foes[target].hp <= 0) target = xs.foes.findIndex(f => f.hp > 0);
    setText(menuName, a.name);
    setText(menuSpec, cap(a.specialty));
    const sp = SPECIALS[a.specialty];
    setText(specialBtn.querySelector('.rv-exp-a-label'), sp?.name ?? 'Special');
    setText(specialBtn.querySelector('.rv-exp-a-desc'), sp?.desc ?? '');
    syncTarget();
    refresh(xs, true);
    show(menu, true);
    for (const c of foeCards) c.el.tabIndex = -1;
    if (!isReduced()) gsap.fromTo(menu, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out', clearProps: 'transform,opacity' });
    strikeBtn.focus({ preventScroll: true });
  }
  function hideMenu(): void { show(menu, false); }
  function setTarget(i: number): void {
    const xs = x();
    if (!xs || !xs.foes[i] || xs.foes[i].hp <= 0) return;
    target = i;
    syncTarget();
    refresh(xs, true);
  }
  function syncTarget(): void {
    const xs = x();
    const f = xs?.foes[target];
    setText(targetEl, f ? `Target: ${f.name} (${target + 1})` : 'No target');
  }
  function cycleTarget(dir: number): void {
    const xs = x(); if (!xs) return;
    const n = xs.foes.length;
    for (let k = 1; k <= n; k++) { const i = (target + dir * k + n) % n; if (xs.foes[i].hp > 0) { setTarget(i); ui.audio().ui('hover'); return; } }
  }

  function act(kind: ExpeditionActionKind): void {
    const sim = ui.sim();
    const xs = x();
    if (!sim || !xs || mode !== 'menu') return;
    if (kind === 'flee') {
      hideMenu();
      mode = 'anim';
      const ok = sim.expeditionAction('flee');
      if (!ok) { mode = 'menu'; show(menu, true); ui.audio().ui('error'); return; }
      ui.audio().ui('close');
      if (!isReduced()) gsap.to(actorCards.map(c => c.el), { x: -240, opacity: 0.2, duration: 0.6, ease: 'power2.in', stagger: 0.06 });
      window.setTimeout(() => { mode = 'idle'; tryNext(); }, isReduced() ? 0 : 650);
      return;
    }
    hideMenu();
    mode = 'anim';
    const ok = sim.expeditionAction(kind, target);
    if (!ok) { mode = 'menu'; show(menu, true); ui.audio().ui('error'); return; }
    ui.audio().ui('click');
    mode = 'idle';
    tryNext();
  }

  // ---------- sequencing ----------
  function onPending(p: { kind: string; turn: 'player' | 'enemy' }): void {
    const xs = x();
    if (!xs || !xs.pending) return;
    queue.push({ kind: p.kind, turn: p.turn, actorIndex: xs.pending.actorIndex, foeIndex: xs.pending.foeIndex, actionKind: xs.pending.kind });
    tryNext();
  }
  function tryNext(): void {
    if (!ui.isOpen('expedition') || busy || mode === 'timing' || mode === 'result' || mode === 'intermission' || mode === 'anim') return;
    if (performance.now() < introUntil) return;
    const p = queue.shift();
    const xs = x();
    if (!xs) return;
    if (!p) {
      if (xs.outcome) { showResult(xs); return; }
      if (xs.awaitingAdvance) { showStageGate(xs); return; }
      if (xs.pending) { queue.push({ kind: xs.turn === 'enemy' ? (xs.pending.actorIndex < 0 ? 'skip' : 'attack') : xs.pending.kind, turn: xs.turn, actorIndex: xs.pending.actorIndex, foeIndex: xs.pending.foeIndex, actionKind: xs.pending.kind }); tryNext(); return; }
      if (xs.turn === 'player') enterMenu();
      return;
    }
    busy = true;
    if (p.turn === 'player') playerAction(p, xs);
    else if (p.kind === 'skip') skipBeat(p, xs);
    else enemyAttack(p, xs);
  }
  function finishStep(delay: number): void {
    window.setTimeout(() => {
      busy = false;
      mode = 'idle';
      const xs = x();
      if (xs) { refresh(xs, true); updateTicker(xs); }
      tryNext();
    }, isReduced() ? Math.min(delay, 120) : delay);
  }

  /** Snapshot HP, resolve in the sim, then float the differences on the cards. */
  function resolve(t: ExpeditionTiming): { foeDmg: number[]; actorDmg: number[]; heals: number[] } {
    const sim = ui.sim();
    const before = x();
    const fb = before ? before.foes.map(f => f.hp) : [], ab = before ? before.actors.map(a => a.hp) : [];
    sim?.expeditionResolve(t);
    const after = x();
    const foeDmg = after ? after.foes.map((f, i) => Math.max(0, (fb[i] ?? f.hp) - f.hp)) : [];
    const actorDmg = after ? after.actors.map((a, i) => Math.max(0, (ab[i] ?? a.hp) - a.hp)) : [];
    const heals = after ? after.actors.map((a, i) => Math.max(0, a.hp - (ab[i] ?? a.hp))) : [];
    return { foeDmg, actorDmg, heals };
  }

  function playerAction(p: Pending, xs: ExpeditionState): void {
    const actor = xs.actors[p.actorIndex];
    const ac = actorCards[p.actorIndex];
    const fc = foeCards[p.foeIndex];
    if (!actor || !ac) { resolve('miss'); finishStep(50); return; }
    const kind = p.actionKind;
    if (kind === 'guard') {
      mode = 'anim';
      ac.el.classList.add('rv-bracing');
      if (!isReduced()) gsap.fromTo(ac.fig, { scale: 1 }, { scale: 0.92, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut', clearProps: 'transform' });
      cue('block');
      window.setTimeout(() => { ac.el.classList.remove('rv-bracing'); resolve('good'); finishStep(350); }, isReduced() ? 0 : 420);
      return;
    }
    if (kind === 'swap') {
      mode = 'anim';
      const before = xs.actors.map(a => a.position);
      cue('rally');
      resolve('good');
      xs.actors.forEach((a, i) => {
        const card = actorCards[i];
        if (!card || before[i] === a.position) return;
        card.el.style.order = String(a.position === 'front' ? 1 : a.position === 'middle' ? 2 : 3);
        if (!isReduced()) gsap.fromTo(card.el, { y: -14, opacity: 0.65 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', clearProps: 'transform,opacity' });
      });
      finishStep(520);
      return;
    }
    if (kind === 'special' && actor.specialty === 'conductor') {
      mode = 'anim';
      cue('rally');
      if (!isReduced()) gsap.fromTo(ac.fig, { y: 0 }, { y: -18, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'transform' });
      window.setTimeout(() => {
        resolve('good');
        show(rallyEl, true);
        if (!isReduced()) gsap.fromTo(rallyEl, { scaleX: 0.2, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)', clearProps: 'transform,opacity' });
        finishStep(900);
      }, isReduced() ? 0 : 500);
      return;
    }
    // timed hit: medic heals on self, everything else hits the target foe
    const ontoSelf = kind === 'special' && actor.specialty === 'medic';
    const targetEl2 = ontoSelf ? ac.el : (fc?.el ?? ac.el);
    const windup = 0.9;
    cue('windup');
    if (!isReduced()) {
      const dx = ontoSelf ? 0 : Math.min(220, Math.max(60, (targetEl2.getBoundingClientRect().left - ac.el.getBoundingClientRect().right) * 0.6));
      gsap.timeline()
        .to(ac.fig, { x: -18, scaleX: 0.94, duration: windup * 0.55, ease: 'power2.out' })
        .to(ac.fig, { x: dx, scaleX: 1.08, duration: windup * 0.45, ease: 'power4.in' });
    }
    startTiming(targetEl2, windup, 'attack', ontoSelf ? 'PATCH' : kind === 'special' ? (SPECIALS[actor.specialty]?.name ?? 'SPECIAL').toUpperCase() : 'STRIKE', (t) => {
      const r = resolve(t);
      showJudge(t, targetEl2);
      cue(t === 'perfect' ? 'perfect' : t === 'good' ? 'good' : 'miss');
      // impact: sparks + knockback on every foe that took damage, crew hop on perfect, heal glow
      r.foeDmg.forEach((d, i) => { if (d > 0) hitFoe(i, d, t); });
      r.heals.forEach((h, i) => { if (h > 0) healActor(i, h); });
      r.actorDmg.forEach((d, i) => { if (d > 0 && i === p.actorIndex) floatNum(actorCards[i].el, `-${d}`, 'rv-dmg'); });
      if (t === 'perfect' && !isReduced()) gsap.fromTo(ac.el, { y: 0 }, { y: -26, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'transform' });
      if (t !== 'miss' && shakeOk()) shake(stage, t === 'perfect' ? 9 : 5, 0.32);
      if (!isReduced()) gsap.to(ac.fig, { x: 0, scaleX: 1, duration: 0.35, delay: 0.15, ease: 'power2.out', clearProps: 'transform' });
      else gsap.set(ac.fig, { clearProps: 'transform' });
      finishStep(720);
    });
  }

  function enemyAttack(p: Pending, xs: ExpeditionState): void {
    const foe = xs.foes[p.foeIndex];
    const fc = foeCards[p.foeIndex];
    const ac = actorCards[p.actorIndex];
    if (!foe || !fc || !ac) { resolve('miss'); finishStep(50); return; }
    const windup = WINDUP[foe.kind] ?? 0.9;
    cue('foe_windup');
    setText(promptEl, `${foe.name} winds up — GUARD ${ac.el.querySelector('b')?.textContent ?? ''}!`);
    show(promptEl, true);
    if (!isReduced()) {
      popIn(promptEl, { y: 10, scale: 0.9 }, { duration: 0.25 });
      const dx = -Math.min(240, Math.max(60, (fc.el.getBoundingClientRect().left - ac.el.getBoundingClientRect().right) * 0.65));
      gsap.timeline()
        .to(fc.fig, { x: 24, scale: 1.06, duration: windup * 0.6, ease: 'power2.out' })
        .to(fc.fig, { x: dx, scale: 1.12, duration: windup * 0.4, ease: 'power4.in' });
    }
    startTiming(ac.el, windup, 'guard', 'GUARD', (t) => {
      const r = resolve(t);
      show(promptEl, false);
      const dmg = r.actorDmg[p.actorIndex] ?? 0;
      showJudge(t, ac.el, true);
      if (t === 'perfect') { cue('block_perfect'); shieldFlash(ac.el, true); }
      else if (t === 'good') { cue('block'); shieldFlash(ac.el, false); }
      else cue('miss');
      if (dmg > 0) {
        floatNum(ac.el, `-${dmg}`, t === 'miss' ? 'rv-dmg rv-big' : 'rv-dmg');
        ac.el.classList.remove('rv-hurt'); void ac.el.offsetWidth; ac.el.classList.add('rv-hurt');
        if (!isReduced()) gsap.fromTo(ac.el, { x: 0 }, { x: -28 * (t === 'miss' ? 1.4 : 0.6), duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'transform' });
        if (shakeOk()) shake(stage, t === 'miss' ? 10 : 4, 0.3);
      }
      const after = x();
      if (after && after.actors[p.actorIndex]?.down) { cue('down'); if (!isReduced()) gsap.to(ac.fig, { rotate: -80, y: 30, duration: 0.5, ease: 'power3.in' }); }
      if (!isReduced()) gsap.to(fc.fig, { x: 0, scale: 1, duration: 0.4, delay: 0.1, ease: 'power2.out', clearProps: 'transform' });
      else gsap.set(fc.fig, { clearProps: 'transform' });
      finishStep(760);
    });
  }

  function skipBeat(p: Pending, xs: ExpeditionState): void {
    const fc = foeCards[p.foeIndex];
    mode = 'anim';
    cue('stun');
    if (fc) {
      const w = el('div', { class: 'rv-exp-word rv-w-stun', text: 'STUNNED' });
      placeOver(w, fc.el);
      fxLayer.appendChild(w);
      if (isReduced()) window.setTimeout(() => w.remove(), 300);
      else gsap.timeline({ onComplete: () => w.remove() }).fromTo(w, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(2)' }).to(w, { y: -20, opacity: 0, duration: 0.35, delay: 0.35 });
      if (!isReduced()) gsap.fromTo(fc.fig, { rotate: 0 }, { rotate: 6, duration: 0.08, yoyo: true, repeat: 5, clearProps: 'transform' });
    }
    window.setTimeout(() => { resolve('miss'); finishStep(200); }, isReduced() ? 0 : 650);
    void xs;
  }

  // ---------- timing window ----------
  function startTiming(targetEl2: HTMLElement, windup: number, kind: 'attack' | 'guard', label: string, onJudged: (t: ExpeditionTiming) => void): void {
    stopTiming();
    mode = 'timing';
    const t0 = performance.now();
    const impact = t0 + windup * 1000;
    placeOver(ring, targetEl2);
    ring.className = 'rv-exp-ring rv-ring-' + kind;
    setText(ringLabel, label);
    ring.hidden = false;
    ringOuter.style.transform = 'scale(3)';
    ringOuter.style.opacity = '0.4';
    const st = { impact, windup, raf: 0, done: false, pressed: false, result: null as ExpeditionTiming | null, onJudged, kind };
    timing = st;
    const tick = () => {
      if (timing !== st || st.done) return;
      const now = performance.now();
      const p = Math.min(1, Math.max(0, (now - (impact - windup * 1000)) / (windup * 1000)));
      const sc = 1 + 2 * (1 - p);
      ringOuter.style.transform = `scale(${sc.toFixed(3)})`;
      ringOuter.style.opacity = String(0.4 + 0.6 * p);
      toggleClass(ring, 'rv-ring-near', now >= impact - GOOD_MS);
      if (!st.pressed && now >= impact + GOOD_MS) { judge(st, 'miss'); return; }
      if (st.pressed && now >= impact) { judge(st, st.result ?? 'miss'); return; }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }
  function press(): boolean {
    const st = timing;
    if (!st || st.done) return false;
    if (st.pressed) return true;
    const now = performance.now();
    const d = now - st.impact;
    st.pressed = true;
    if (d < -GOOD_MS) {
      // early: it is a miss, but the blow still lands at the impact frame
      st.result = 'miss';
      showWord('EARLY', 'rv-w-miss', ring);
      return true;
    }
    st.result = Math.abs(d) <= PERFECT_MS ? 'perfect' : Math.abs(d) <= GOOD_MS ? 'good' : 'miss';
    judge(st, st.result);
    return true;
  }
  function judge(st: NonNullable<typeof timing>, t: ExpeditionTiming): void {
    if (st.done) return;
    st.done = true;
    if (st.raf) cancelAnimationFrame(st.raf);
    if (timing === st) timing = null;
    ring.hidden = true;
    mode = 'anim';
    st.onJudged(t);
  }
  function stopTiming(): void {
    if (timing) { timing.done = true; if (timing.raf) cancelAnimationFrame(timing.raf); timing = null; }
    ring.hidden = true;
  }

  // ---------- fx ----------
  function placeOver(node: HTMLElement, over: HTMLElement, frac = 0.42): void {
    const s = stage.getBoundingClientRect();
    const r = over.getBoundingClientRect();
    node.style.left = Math.round(r.left + r.width / 2 - s.left) + 'px';
    node.style.top = Math.round(r.top + r.height * frac - s.top) + 'px';
  }
  function showWord(text: string, cls: string, over: HTMLElement): void {
    const w = el('div', { class: 'rv-exp-word ' + cls, text });
    placeOver(w, over);
    fxLayer.appendChild(w);
    if (isReduced()) { window.setTimeout(() => w.remove(), 400); return; }
    gsap.timeline({ onComplete: () => w.remove() })
      .fromTo(w, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.16, ease: 'back.out(3)' })
      .to(w, { y: -24, opacity: 0, duration: 0.4, delay: 0.3, ease: 'power2.in' });
  }
  function showJudge(t: ExpeditionTiming, over: HTMLElement, guard = false): void {
    const text = t === 'perfect' ? 'PERFECT' : t === 'good' ? (guard ? 'BLOCKED' : 'GOOD') : (guard ? 'HIT' : 'MISS');
    judgeEl.className = 'rv-exp-judge rv-j-' + t;
    setText(judgeEl, text);
    placeOver(judgeEl, over, 0.6);
    judgeEl.hidden = false;
    gsap.killTweensOf(judgeEl);
    if (isReduced()) { window.setTimeout(() => { judgeEl.hidden = true; }, 500); return; }
    gsap.timeline({ onComplete: () => { judgeEl.hidden = true; } })
      .fromTo(judgeEl, { scale: t === 'perfect' ? 2.4 : 1.8, opacity: 0, rotate: t === 'perfect' ? -8 : 0 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.18, ease: 'power4.out' })
      .to(judgeEl, { y: -30, opacity: 0, duration: 0.45, delay: 0.45, ease: 'power2.in', clearProps: 'transform' });
    if (t === 'perfect') flashScreen('rgba(232,193,112,0.35)');
  }
  function flashScreen(color: string): void {
    if (isReduced()) return;
    const f = el('div', { class: 'rv-exp-flash', style: `background:${color}` });
    stage.appendChild(f);
    gsap.timeline({ onComplete: () => f.remove() }).to(f, { opacity: 1, duration: 0.05 }).to(f, { opacity: 0, duration: 0.3 });
  }
  function floatNum(over: HTMLElement, text: string, cls: string): void {
    const n = el('div', { class: 'rv-exp-num ' + cls, text });
    placeOver(n, over, 0.22);
    n.style.left = (parseFloat(n.style.left) + (Math.random() - 0.5) * 40) + 'px';
    fxLayer.appendChild(n);
    if (isReduced()) { window.setTimeout(() => n.remove(), 700); return; }
    gsap.timeline({ onComplete: () => n.remove() })
      .fromTo(n, { y: 10, scale: 0.6, opacity: 0 }, { y: -30, scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(2)' })
      .to(n, { y: -90, opacity: 0, duration: 0.7, delay: 0.25, ease: 'power1.in' });
  }
  function sparks(over: HTMLElement, n: number, color: string): void {
    if (isReduced()) return;
    const s = stage.getBoundingClientRect();
    const r = over.getBoundingClientRect();
    const cx = r.left + r.width / 2 - s.left, cy = r.top + r.height * 0.45 - s.top;
    for (let i = 0; i < n; i++) {
      const sp = el('i', { class: 'rv-exp-spark', style: `left:${cx}px;top:${cy}px;background:${color}` });
      fxLayer.appendChild(sp);
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
      gsap.fromTo(sp, { x: 0, y: 0, scale: 1, opacity: 1 }, { x: Math.cos(a) * d, y: Math.sin(a) * d + 30, scale: 0.2, opacity: 0, duration: 0.45 + Math.random() * 0.3, ease: 'power2.out', onComplete: () => sp.remove() });
    }
  }
  function hitFoe(i: number, dmg: number, t: ExpeditionTiming): void {
    const fc = foeCards[i]; if (!fc) return;
    floatNum(fc.el, `-${dmg}`, 'rv-dmg' + (t === 'perfect' ? ' rv-big rv-crit' : ''));
    sparks(fc.el, t === 'perfect' ? 14 : t === 'good' ? 8 : 3, t === 'perfect' ? '#ffe9b0' : '#e8c170');
    fc.el.classList.remove('rv-hit'); void fc.el.offsetWidth; fc.el.classList.add('rv-hit');
    const dead = (x()?.foes[i]?.hp ?? 1) <= 0;
    if (!isReduced()) {
      gsap.killTweensOf(fc.el);
      gsap.fromTo(fc.el, { x: 0 }, { x: t === 'perfect' ? 46 : 24, duration: 0.1, ease: 'power2.out', yoyo: !dead, repeat: dead ? 0 : 1, clearProps: dead ? '' : 'transform' });
      if (dead) gsap.to(fc.fig, { y: 40, rotate: 25, opacity: 0.25, duration: 0.6, delay: 0.1, ease: 'power3.in' });
    }
  }
  function healActor(i: number, h: number): void {
    const ac = actorCards[i]; if (!ac) return;
    floatNum(ac.el, `+${h}`, 'rv-heal');
    cue('heal');
    sparks(ac.el, 8, '#8ee29a');
    if (!isReduced()) gsap.fromTo(ac.el, { boxShadow: '0 0 0 0 rgba(111,191,115,0.9)' }, { boxShadow: '0 0 40px 6px rgba(111,191,115,0)', duration: 0.7, clearProps: 'boxShadow' });
  }
  function shieldFlash(over: HTMLElement, big: boolean): void {
    const sh = el('div', { class: 'rv-exp-shield' + (big ? ' rv-big' : ''), text: '⛨' });
    placeOver(sh, over);
    fxLayer.appendChild(sh);
    if (isReduced()) { window.setTimeout(() => sh.remove(), 400); return; }
    gsap.timeline({ onComplete: () => sh.remove() })
      .fromTo(sh, { scale: 0.4, opacity: 0 }, { scale: big ? 1.6 : 1.1, opacity: 1, duration: 0.14, ease: 'back.out(2)' })
      .to(sh, { scale: big ? 2.4 : 1.5, opacity: 0, duration: big ? 0.6 : 0.35, ease: 'power2.out' });
    if (big) { flashScreen('rgba(111,183,232,0.35)'); sparks(over, 16, '#9fd3ff'); }
  }

  // ---------- stage transition / result ----------
  function showStageGate(xs: ExpeditionState): void {
    if (mode === 'intermission') return;
    mode = 'intermission';
    hideMenu();
    const nextKey = xs.stage === 1 ? 'buried_concourse' : 'void_sanctum';
    const deeper = btn(`Press deeper — ${STAGE_NAMES[nextKey]}`, () => {
      const sim = ui.sim(); if (!sim) return;
      ui.audio().ui('confirm');
      if (!sim.advanceExpedition(true)) { ui.audio().ui('error'); return; }
      show(stageGateEl, false);
      mode = 'idle'; builtFor = '';
      show_();
    }, { class: 'rv-primary rv-big', aria: `Continue to ${STAGE_NAMES[nextKey]}` });
    deeper.dataset.autofocus = '';
    const withdraw = btn('Return to the train', () => {
      const sim = ui.sim(); if (!sim) return;
      ui.audio().ui('close');
      if (!sim.advanceExpedition(false)) { ui.audio().ui('error'); return; }
      show(stageGateEl, false);
      mode = 'idle';
      tryNext();
    }, { aria: 'Withdraw safely without the final reward' });
    const card = el('div', { class: 'rv-panel rv-modal rv-exp-depth-card' },
      el('div', { class: 'rv-label', text: `Stage ${xs.stage} of ${xs.stageCount} cleared` }),
      el('h2', { text: 'The ruin opens beneath you' }),
      el('p', { text: 'Wounds carry forward. Deeper chambers hold stronger enemies—and the expedition reward waits only at the end.' }),
      el('div', { class: 'rv-exp-depth-status' }, ...xs.actors.map(a => el('span', { class: a.down ? 'rv-down' : '', text: `${a.name} · ${Math.round(a.hp)} HP · ${cap(a.position)}` }))),
      el('div', { class: 'rv-actions' }, withdraw, deeper),
    );
    stageGateEl.replaceChildren(card);
    show(stageGateEl, true);
    popIn(card, { scale: 0.9, y: 24 }, { duration: D(0.4) });
    window.setTimeout(() => deeper.focus({ preventScroll: true }), isReduced() ? 0 : 260);
  }

  function showResult(xs: ExpeditionState): void {
    if (mode === 'result') return;
    mode = 'result';
    stopTiming();
    hideMenu();
    show(promptEl, false);
    const outcome = xs.outcome ?? 'fled';
    const title = outcome === 'won' ? 'Victory' : outcome === 'lost' ? 'Defeat' : 'Retreat';
    const summary = endSummary?.summary ?? xs.log[xs.log.length - 1] ?? '';
    const rounds = endSummary?.rounds ?? xs.rounds;
    const rewards: string[] = [];
    const m = summary.match(/\+(\d+) marks/); if (m) rewards.push(`◆ ${m[1]} marks`);
    const sc = summary.match(/\+(\d+) scrap/); if (sc) rewards.push(`⚙ ${sc[1]} scrap`);
    if (/joins/.test(summary)) rewards.push('⚒ a new crew member');
    if (xs.rewardRelic) rewards.push('✦ relic choice');
    const cont = btn('Continue', () => {
      const sim = ui.sim();
      if (!sim) return;
      ui.audio().ui('confirm');
      if (!sim.endExpedition()) ui.audio().ui('error');
    }, { class: 'rv-primary rv-big', aria: 'Continue (Enter)' });
    cont.dataset.autofocus = '';
    const card = el('div', { class: 'rv-panel rv-modal rv-exp-result rv-res-' + outcome },
      el('div', { class: 'rv-label', text: `Expedition · ${xs.stage}/${xs.stageCount} stages · ${rounds} round${rounds === 1 ? '' : 's'} · void +${rounds * EXPEDITION.voidSecondsPerRound}s` }),
      el('h1', { text: title }),
      el('p', { class: 'rv-exp-result-sum', text: summary }),
      rewards.length ? el('div', { class: 'rv-exp-rewards' }, ...rewards.map(r => el('span', { class: 'rv-exp-reward', text: r }))) : el('div', { class: 'rv-exp-rewards rv-dim', text: outcome === 'lost' ? 'No reward. Morale −10.' : 'No reward.' }),
      el('div', { class: 'rv-exp-result-crew' }, ...xs.actors.map(a => el('span', { class: 'rv-exp-rc' + (a.down ? ' rv-down' : ''), text: `${a.name} ${a.down ? '— carried back' : `${Math.round(a.hp)} HP`}` }))),
      el('div', { class: 'rv-actions' }, cont),
    );
    resultEl.replaceChildren(card);
    show(resultEl, true);
    popIn(card, { scale: 0.85, y: 30 }, { duration: D(0.5), delay: D(0.25) });
    window.setTimeout(() => cont.focus({ preventScroll: true }), isReduced() ? 0 : 320);
    if (outcome === 'won' && !isReduced()) gsap.fromTo(actorCards.filter((_, i) => !xs.actors[i].down).map(c => c.fig), { y: 0 }, { y: -16, duration: 0.25, yoyo: true, repeat: 3, ease: 'power1.inOut', stagger: 0.08, clearProps: 'transform' });
  }

  // ---------- show / hide ----------
  function show_(): void {
    const xs = x();
    if (!xs) return;
    const key = `${xs.siteId}|${xs.stage}|${xs.actors.map(a => a.id).join(',')}|${xs.foes.map(f => f.id).join(',')}`;
    const reopen = !ui.isOpen('expedition');
    if (key !== builtFor || reopen) {
      builtFor = key;
      queue.length = 0; busy = false; mode = 'idle'; endSummary = null; stopTiming();
      show(resultEl, false); show(stageGateEl, false); hideMenu(); show(promptEl, false);
      build(xs);
    }
    if (reopen) {
      ui.open('expedition');
      particles.start();
      startDrift();
    }
    introUntil = performance.now() + (isReduced() ? 0 : 900);
    window.setTimeout(() => tryNext(), isReduced() ? 0 : 920);
  }
  function onClose(): void {
    stopTiming();
    particles.stop();
    driftTl?.kill(); driftTl = null;
    queue.length = 0; busy = false; mode = 'idle';
    builtFor = '';
    gsap.killTweensOf([layers.far, layers.mid, layers.near]);
  }
  function startDrift(): void {
    driftTl?.kill();
    if (isReduced()) return;
    driftTl = gsap.timeline({ repeat: -1, yoyo: true });
    driftTl.to(layers.far, { x: -18, duration: 22, ease: 'sine.inOut' }, 0)
      .to(layers.mid, { x: 26, duration: 17, ease: 'sine.inOut' }, 0)
      .to(layers.near, { x: -40, duration: 13, ease: 'sine.inOut' }, 0);
  }
  const onMove = (e: PointerEvent): void => {
    if (!ui.isOpen('expedition') || isReduced()) return;
    px = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2; py = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    layers.far.style.setProperty('--px', (px * -6).toFixed(1) + 'px'); layers.far.style.setProperty('--py', (py * -3).toFixed(1) + 'px');
    layers.mid.style.setProperty('--px', (px * -14).toFixed(1) + 'px'); layers.mid.style.setProperty('--py', (py * -6).toFixed(1) + 'px');
    layers.near.style.setProperty('--px', (px * -26).toFixed(1) + 'px'); layers.near.style.setProperty('--py', (py * -10).toFixed(1) + 'px');
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  // ---------- input ----------
  function onKey(e: KeyboardEvent): void {
    if (!ui.isOpen('expedition') || ui.topModal() !== 'expedition') return;
    if (e.repeat) { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); return; }
    const k = e.key;
    if (mode === 'timing') {
      if (k === ' ' || k === 'Enter') { e.preventDefault(); press(); }
      return;
    }
    if (mode === 'result') {
      if (k === ' ' || k === 'Enter') { const b = resultEl.querySelector<HTMLButtonElement>('button'); if (b && document.activeElement !== b) { e.preventDefault(); b.click(); } }
      return;
    }
    if (mode === 'intermission') {
      if (k === ' ' || k === 'Enter') { const b = stageGateEl.querySelector<HTMLButtonElement>('[data-autofocus]'); if (b && document.activeElement !== b) { e.preventDefault(); b.click(); } }
      return;
    }
    if (mode !== 'menu') { if (k === ' ') e.preventDefault(); return; }
    const n = Number(k);
    if (n >= 1 && n <= foeCards.length) { e.preventDefault(); setTarget(n - 1); ui.audio().ui('click'); return; }
    switch (k.toLowerCase()) {
      case 's': e.preventDefault(); act('strike'); break;
      case 'g': e.preventDefault(); act('guard'); break;
      case 'e': e.preventDefault(); act('special'); break;
      case 'w': e.preventDefault(); act('swap'); break;
      case 'f': e.preventDefault(); act('flee'); break;
      case 'arrowleft': e.preventDefault(); moveFocus(-1); break;
      case 'arrowright': e.preventDefault(); moveFocus(1); break;
      case 'arrowup': e.preventDefault(); cycleTarget(-1); break;
      case 'arrowdown': e.preventDefault(); cycleTarget(1); break;
      case 'tab': e.preventDefault(); moveFocus(e.shiftKey ? -1 : 1); break;
      case ' ': if (!(document.activeElement instanceof HTMLButtonElement)) { e.preventDefault(); act('strike'); } break;
    }
  }
  function moveFocus(dir: number): void {
    const f = focusables(menu);
    if (!f.length) return;
    const cur = f.indexOf(document.activeElement as HTMLElement);
    f[(cur < 0 ? 0 : (cur + dir + f.length) % f.length)].focus({ preventScroll: true });
    ui.audio().ui('hover');
  }
  function gamepad(button: number): boolean {
    if (!ui.isOpen('expedition')) return false;
    if (mode === 'timing') { if (button === 0) press(); return true; }
    if (mode === 'result') { if (button === 0 || button === 9) resultEl.querySelector<HTMLButtonElement>('button')?.click(); return true; }
    if (mode === 'intermission') { if (button === 0) stageGateEl.querySelector<HTMLButtonElement>('[data-autofocus]')?.click(); return true; }
    if (mode !== 'menu') return true;
    switch (button) {
      case 0: { const a = document.activeElement as HTMLElement | null; if (a && menu.contains(a)) a.click(); else act('strike'); return true; }
      case 2: act('special'); return true;
      case 3: act('guard'); return true;
      case 14: moveFocus(-1); return true;
      case 15: moveFocus(1); return true;
      case 12: cycleTarget(-1); return true;
      case 13: cycleTarget(1); return true;
      case 4: cycleTarget(-1); return true;
      case 5: cycleTarget(1); return true;
    }
    return true;
  }
  document.addEventListener('keydown', onKey, true);
  // pointer press anywhere on the stage during a timing window counts (mobile / mouse players)
  stage.addEventListener('pointerdown', (e) => { if (mode === 'timing') { e.preventDefault(); press(); } });
  promptEl.addEventListener('pointerdown', (e) => { if (mode === 'timing') { e.preventDefault(); press(); } });

  // ---------- bus ----------
  const bus = ui.app.bus;
  const unsubs = [
    bus.on('expedition:pending', (p) => { if (ui.runActive()) onPending(p); }),
    bus.on('expedition:round', ({ round }) => {
      if (!ui.isOpen('expedition')) return;
      if (round !== lastRound) {
        lastRound = round;
        const xs = x(); if (xs) updateTicker(xs);
        if (!isReduced()) {
          gsap.fromTo(roundEl, { scale: 1.8, color: '#fff' }, { scale: 1, color: '', duration: 0.5, ease: 'back.out(2)', clearProps: 'transform,color' });
          gsap.fromTo(ticker, { scale: 1.06 }, { scale: 1, duration: 0.4, ease: 'power2.out', clearProps: 'transform' });
        }
      }
    }),
    bus.on('expedition:stage', () => {
      if (!ui.isOpen('expedition')) return;
      builtFor = '';
      window.setTimeout(() => show_(), 0);
    }),
    bus.on('expedition:end', (p) => { endSummary = p; }),
  ];

  ui.registerPanel('expedition', { el: root, modal: true, escClosable: false, anim: 'fade', onClose });

  return {
    el: root,
    show: show_,
    update(s: SimState) {
      const xs = s.expedition;
      if (!ui.isOpen('expedition')) return;
      if (!xs || s.phase !== 'expedition') { ui.close('expedition'); return; }
      const expectedKey = `${xs.siteId}|${xs.stage}|${xs.actors.map(a => a.id).join(',')}|${xs.foes.map(f => f.id).join(',')}`;
      if (!xs.awaitingAdvance && expectedKey !== builtFor) { show_(); return; }
      if (mode !== 'timing') refresh(xs);
      if (mode === 'idle' && !busy) tryNext();
    },
    gamepad,
    destroy() {
      for (const u of unsubs) u();
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointermove', onMove);
      onClose();
    },
  };
}
