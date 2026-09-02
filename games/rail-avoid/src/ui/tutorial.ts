/** Tutorial coach-marks anchored to HUD elements. */
import { el, btn, setText } from './dom';
import type { UiShared } from './shared';
import { popIn } from './motion';

export interface Anchor { el: HTMLElement | null; side: 'below' | 'above' }
export interface Tutorial { el: HTMLElement; show(step: number, text: string): void; hide(): void; reposition(): void; visible(): boolean }

export function createTutorial(ui: UiShared, anchorFor: (step: number) => Anchor): Tutorial {
  const stepEl = el('div', { class: 'rv-coach-step', text: 'Tutorial' });
  const textEl = el('div', { class: 'rv-coach-text' });
  const card = el('div', { class: 'rv-coach rv-panel', role: 'note', 'aria-live': 'polite' },
    stepEl, textEl,
    el('div', { class: 'rv-actions' },
      btn('Skip tutorial', () => { ui.audio().ui('close'); ui.app.settings.set({ showTutorial: false }); hide(); }, { class: 'rv-small' }),
      btn('Got it', () => { ui.audio().ui('click'); hide(); }, { class: 'rv-small rv-primary' }),
    ),
  );
  const layer = el('div', { class: 'rv-tutorial-layer' }, card);
  layer.hidden = true;
  let current = -1;

  function show(step: number, text: string): void {
    if (!ui.settings().showTutorial) return;
    current = step;
    setText(stepEl, `Tutorial ${step + 1}`);
    setText(textEl, text);
    layer.hidden = false;
    reposition();
    const below = anchorFor(step).side === 'below';
    card.style.transformOrigin = below ? '24px 0' : '24px 100%';
    popIn(card, { scale: 0.8, y: below ? -14 : 14 }, { ease: 'back.out(1.8)', duration: 0.5 });
  }
  function hide(): void { layer.hidden = true; current = -1; }
  function visible(): boolean { return !layer.hidden; }

  function reposition(): void {
    if (layer.hidden) return;
    const a = anchorFor(current);
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = card.offsetWidth || 320, ch = card.offsetHeight || 100;
    let left = (vw - cw) / 2, top = 90;
    card.classList.remove('rv-arrow-bottom', 'rv-arrow-none');
    if (a.el && a.el.isConnected && !a.el.hidden) {
      const r = a.el.getBoundingClientRect();
      if (r.width > 0) {
        left = Math.max(8, Math.min(vw - cw - 8, r.left));
        if (a.side === 'below') top = r.bottom + 12;
        else { top = r.top - ch - 12; card.classList.add('rv-arrow-bottom'); }
        top = Math.max(8, Math.min(vh - ch - 8, top));
      } else card.classList.add('rv-arrow-none');
    } else card.classList.add('rv-arrow-none');
    const l = Math.round(left) + 'px', t = Math.round(top) + 'px';
    if (card.style.left !== l) card.style.left = l;
    if (card.style.top !== t) card.style.top = t;
  }

  return { el: layer, show, hide, reposition, visible };
}
