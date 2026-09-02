/** Shared UI context: panel registry/stack, toasts, confirm dialog, selection, safe state access. */
import type { AppContext, ViewApi, AudioApi } from '../app';
import type { SimApi } from '../sim/api';
import type { SimState, Settings } from '../core/types';
import { el, btn, focusables, show } from './dom';
import { gsap, D, isReduced, popIn, rowsIn } from './motion';

export type PanelName = 'title' | 'settings' | 'howto' | 'pause' | 'shop' | 'event' | 'results' | 'confirm' | 'inspector' | 'gamepad' | 'relic' | 'crewpick' | 'expedition';

export interface PanelDef {
  el: HTMLElement;
  /** Modal panels block gameplay keys (Space etc.) and stack; Esc closes the top one when `escClosable`. */
  modal: boolean;
  escClosable?: boolean;
  /** Open/close motion: 'modal' (scale + overshoot, staggered rows), 'side' (slide from the right), 'fade', or 'none'. Defaults: modal → 'modal', else 'fade'. */
  anim?: 'modal' | 'side' | 'fade' | 'none';
  onOpen?: () => void;
  onClose?: () => void;
}

export interface ConfirmOpts { title: string; text: string; yes?: string; no?: string; danger?: boolean }

/** Extra methods the concrete audio engine exposes beyond AudioApi (optional at the call site). */
export interface AudioExtras {
  setVoidProximity(p: number): void;
  setBoardingAlert(on: boolean): void;
  /** Named one-shot cues for the expedition / relic / bounty UI (see audio/index.ts). */
  cue(name: AudioCue): void;
}

export type AudioCue = 'windup' | 'perfect' | 'good' | 'miss' | 'block' | 'block_perfect' | 'stun' | 'down' | 'rally'
  | 'relic_offer' | 'relic_take' | 'bounty_new' | 'bounty_done' | 'bounty_failed' | 'marks' | 'exp_start' | 'exp_won' | 'exp_lost' | 'foe_windup' | 'heal'
  // opening cinematic stingers (see ui/cinematic.ts)
  | 'open_whistle' | 'open_ticks' | 'open_ticks_stop' | 'open_tone1' | 'open_tone2' | 'open_tone3' | 'open_drone' | 'open_sting' | 'open_stop';

export type NotifyKind = 'info' | 'warn' | 'good' | 'bad';

export class UiShared {
  readonly isDev: boolean;
  runActiveFlag = false;
  private panels = new Map<PanelName, PanelDef>();
  private stack: PanelName[] = [];
  private closing = new Set<PanelName>();
  private focusReturn: HTMLElement | null = null;
  private selected = -1;
  private selectListeners: Array<(i: number) => void> = [];
  private toastsEl: HTMLElement;
  private confirmEl: HTMLElement;
  private confirmResolve: ((v: boolean) => void) | null = null;
  private pausedByMenu = false;

  constructor(public readonly app: AppContext, public readonly root: HTMLElement) {
    let dev = false;
    try { dev = location.search.includes('dev') || !!(window as unknown as { __RAIL_DEV?: boolean }).__RAIL_DEV; } catch { dev = false; }
    this.isDev = dev;
    this.toastsEl = el('div', { class: 'rv-toasts', role: 'status', 'aria-live': 'polite' });
    root.appendChild(this.toastsEl);
    this.confirmEl = el('div', { class: 'rv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Confirm' });
    this.confirmEl.hidden = true;
    root.appendChild(this.confirmEl);
    this.registerPanel('confirm', { el: this.confirmEl, modal: true, escClosable: true, onClose: () => this.finishConfirm(false) });
  }

  // ---- safe accessors ----
  sim(): SimApi | null {
    try { return this.app.sim ?? null; } catch { return null; }
  }
  state(): SimState | null {
    try {
      const s = this.app.sim?.state;
      if (!s || !s.train || !s.train.cars) return null;
      return s;
    } catch { return null; }
  }
  view(): ViewApi | null { return this.app.view ?? null; }
  audio(): AudioApi & Partial<AudioExtras> { return this.app.audio as AudioApi & Partial<AudioExtras>; }
  settings(): Settings { return this.app.settings.get(); }
  reducedMotion(): boolean { return !!this.settings().reducedMotion; }
  runActive(): boolean { return this.runActiveFlag; }

  // ---- panels ----
  registerPanel(name: PanelName, def: PanelDef): void {
    this.panels.set(name, def);
    def.el.hidden = true;
  }
  isOpen(name: PanelName): boolean {
    const p = this.panels.get(name);
    return !!p && !p.el.hidden && !this.closing.has(name);
  }
  open(name: PanelName): void {
    const p = this.panels.get(name);
    if (!p) return;
    if (this.closing.has(name)) { this.closing.delete(name); p.el.classList.remove('rv-closing'); }
    else if (!p.el.hidden) { p.onOpen?.(); return; }
    if (p.modal) {
      if (this.stack.length === 0) this.focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.stack = this.stack.filter(n => n !== name);
      this.stack.push(name);
    }
    show(p.el, true);
    this.syncLayoutClasses();
    this.animateIn(p);
    p.onOpen?.();
    if (p.modal) this.focusFirst(p.el);
    this.app.view?.resize();
  }
  close(name: PanelName): void {
    const p = this.panels.get(name);
    if (!p || p.el.hidden || this.closing.has(name)) return;
    this.stack = this.stack.filter(n => n !== name);
    this.syncLayoutClasses();
    p.onClose?.();
    if (p.modal) {
      const top = this.topModal();
      if (top) this.focusFirst(this.panels.get(top)!.el);
      else if (this.focusReturn && this.focusReturn.isConnected) { try { this.focusReturn.focus(); } catch { /* ignore */ } }
    }
    const finish = () => { this.closing.delete(name); p.el.classList.remove('rv-closing'); show(p.el, false); this.app.view?.resize(); };
    if (this.animateOut(p, finish)) { this.closing.add(name); p.el.classList.add('rv-closing'); }
    else finish();
  }
  // ---- panel motion ----
  private animTargets(p: PanelDef): { box: HTMLElement; overlay: HTMLElement | null } {
    const isOverlay = p.el.classList.contains('rv-overlay');
    const box = (isOverlay ? p.el.querySelector<HTMLElement>('.rv-modal') : null) ?? p.el;
    return { box, overlay: isOverlay ? p.el : null };
  }
  private animateIn(p: PanelDef): void {
    const kind = p.anim ?? (p.modal ? 'modal' : 'fade');
    if (kind === 'none') return;
    const { box, overlay } = this.animTargets(p);
    gsap.killTweensOf(box);
    if (overlay) gsap.fromTo(overlay, { backgroundColor: 'rgba(4,6,14,0)' }, { backgroundColor: 'rgba(4,6,14,0.55)', duration: D(0.3), clearProps: 'backgroundColor' });
    if (kind === 'fade') { gsap.fromTo(box, { opacity: 0 }, { opacity: 1, duration: D(0.25), clearProps: 'opacity' }); return; }
    if (kind === 'side') popIn(box, { x: 56, y: 0, scale: 1 }, { duration: D(0.45) });
    else popIn(box, { scale: 0.92, y: 24 });
    const rows = Array.from(box.querySelectorAll<HTMLElement>(':scope > :not(.rv-rows), :scope .rv-rows > *'));
    if (rows.length && rows.length < 80) rowsIn(rows, { delay: D(0.06) });
  }
  /** Returns true when an out-animation is running (finish() fires when it ends). */
  private animateOut(p: PanelDef, finish: () => void): boolean {
    const kind = p.anim ?? (p.modal ? 'modal' : 'fade');
    if (kind === 'none' || isReduced()) return false;
    const { box, overlay } = this.animTargets(p);
    gsap.killTweensOf(box);
    if (overlay) gsap.to(overlay, { backgroundColor: 'rgba(4,6,14,0)', duration: 0.18, clearProps: 'backgroundColor' });
    gsap.to(box, { opacity: 0, ...(kind === 'side' ? { x: 40 } : kind === 'modal' ? { scale: 0.96, y: 10 } : {}), duration: 0.18, ease: 'power2.in',
      onComplete: () => { gsap.set(box, { clearProps: 'transform,opacity' }); finish(); } });
    return true;
  }
  toggle(name: PanelName): void { if (this.isOpen(name)) this.close(name); else this.open(name); }
  /** Mirror side-panel state onto #ui so layout can make room (toasts, speed controls, inspector next to shop). */
  private syncLayoutClasses(): void {
    this.root.classList.toggle('rv-inspector-open', this.isOpen('inspector'));
    this.root.classList.toggle('rv-shop-open', this.isOpen('shop'));
  }
  topModal(): PanelName | null { return this.stack.length ? this.stack[this.stack.length - 1] : null; }
  anyModal(): boolean { return this.stack.length > 0; }
  /** Close the top-most modal if it is Esc-closable. Returns true when something closed. */
  closeTop(): boolean {
    const top = this.topModal();
    if (!top) return false;
    const p = this.panels.get(top);
    if (!p || p.escClosable === false) return false;
    this.close(top);
    return true;
  }
  closeAll(): void {
    for (const name of Array.from(this.panels.keys())) this.close(name);
  }
  focusFirst(container: HTMLElement): void {
    const f = focusables(container);
    const target = f.find(e => e.dataset.autofocus !== undefined) ?? f[0];
    if (target) { try { target.focus({ preventScroll: true }); } catch { /* ignore */ } }
  }

  // ---- pause bookkeeping ----
  pauseForMenu(): void {
    const s = this.state();
    if (s && s.phase === 'running') {
      this.sim()?.pause();
      this.pausedByMenu = true;
    }
  }
  resumeFromMenu(): void {
    if (this.pausedByMenu) {
      this.pausedByMenu = false;
      const s = this.state();
      if (s && s.phase === 'paused') this.sim()?.resume();
    }
  }

  // ---- selection ----
  selectedCar(): number { return this.selected; }
  selectCar(i: number, openInspector = true): void {
    const s = this.state();
    if (s && (i < 0 || i >= s.train.cars.length)) i = -1;
    this.selected = i;
    try { this.app.view?.selectCar(i); } catch { /* view may be booting */ }
    for (const l of this.selectListeners) l(i);
    if (openInspector && i >= 0) this.open('inspector');
    if (i < 0) this.close('inspector');
  }
  onSelectCar(l: (i: number) => void): void { this.selectListeners.push(l); }

  // ---- toasts ----
  private toastGroups = new Map<string, { el: HTMLElement; text: HTMLElement; at: number; timer: number }>();
  /**
   * Quiet toasts: at most 3 visible; a `group` key coalesces follow-ups (e.g. everything that happens at one
   * settlement) into extra lines of the toast created within the last 2.5 s instead of a new card.
   */
  notify(text: string, kind: NotifyKind = 'info', ttl = 4200, group?: string): void {
    const ICON: Record<NotifyKind, string> = { info: 'ℹ', warn: '⚠', good: '✓', bad: '✕' };
    const now = performance.now();
    if (group) {
      const g = this.toastGroups.get(group);
      if (g && g.el.isConnected && now - g.at < 2500) {
        g.text.appendChild(el('span', { class: 'rv-toast-more rv-k-' + kind, text }));
        window.clearTimeout(g.timer);
        g.timer = this.scheduleToastOut(g.el, ttl);
        if (!isReduced()) gsap.fromTo(g.text.lastElementChild, { x: 10, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25, clearProps: 'transform' });
        return;
      }
    }
    const textEl = el('span', { class: 'rv-toast-text', text });
    const t = el('div', { class: 'rv-toast rv-panel rv-k-' + kind }, el('span', { class: 'rv-toast-ico', 'aria-hidden': 'true', text: ICON[kind] }), textEl);
    this.toastsEl.appendChild(t);
    while (this.toastsEl.children.length > 3) this.toastsEl.removeChild(this.toastsEl.firstChild!);
    this.root.classList.add('rv-has-toasts');
    gsap.fromTo(t, { x: 56, opacity: 0 }, { x: 0, opacity: 1, duration: D(0.4), ease: 'back.out(1.6)', clearProps: 'transform' });
    const timer = this.scheduleToastOut(t, ttl);
    if (group) this.toastGroups.set(group, { el: t, text: textEl, at: now, timer });
  }
  private scheduleToastOut(t: HTMLElement, ttl: number): number {
    const gone = () => { t.remove(); if (!this.toastsEl.children.length) this.root.classList.remove('rv-has-toasts'); };
    return window.setTimeout(() => {
      if (!t.isConnected) return;
      if (isReduced()) { gone(); return; }
      gsap.to(t, { x: 36, opacity: 0, duration: 0.25, ease: 'power2.in' });
      gsap.to(t, { height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, duration: 0.3, delay: 0.18, ease: 'power2.inOut', onComplete: gone });
    }, ttl);
  }

  // ---- confirm ----
  confirm(opts: ConfirmOpts): Promise<boolean> {
    this.finishConfirm(false);
    return new Promise<boolean>((resolve) => {
      this.confirmResolve = resolve;
      this.confirmEl.replaceChildren(
        el('div', { class: 'rv-panel rv-modal rv-confirm' },
          el('h2', { text: opts.title }),
          el('p', { text: opts.text }),
          el('div', { class: 'rv-actions' },
            btn(opts.yes ?? 'Confirm', () => { this.audio().ui('confirm'); this.finishConfirm(true); }, { class: opts.danger ? 'rv-danger' : 'rv-primary' }),
            btn(opts.no ?? 'Cancel', () => { this.audio().ui('close'); this.finishConfirm(false); }),
          ),
        ),
      );
      this.open('confirm');
    });
  }
  private finishConfirm(v: boolean): void {
    const r = this.confirmResolve;
    this.confirmResolve = null;
    if (this.isOpen('confirm')) this.close('confirm');
    if (r) r(v);
  }
}
