/** Tutorial coach-marks: compact cards with a progress-dot row, anchored to HUD elements but always inside the free zone. */
import { el, btn, setText } from './dom';
import type { UiShared } from './shared';
import type { Rect } from './layout';
import { popIn } from './motion';

export interface Anchor { el: HTMLElement | null; side: 'below' | 'above' }
export interface Tutorial { el: HTMLElement; show(step: number, text: string): void; hide(): void; reposition(): void; visible(): boolean }

export const TUTORIAL_STEPS = 10;

export function createTutorial(ui: UiShared, anchorFor: (step: number) => Anchor, zone: () => Rect | null, total = TUTORIAL_STEPS): Tutorial {
  const stepEl = el('div', { class: 'rv-coach-step', text: 'Tutorial' });
  const textEl = el('div', { class: 'rv-coach-text' });
  const dots: HTMLElement[] = [];
  const dotsEl = el('div', { class: 'rv-coach-dots', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(total) });
  for (let i = 0; i < total; i++) { const d = el('i'); dots.push(d); dotsEl.appendChild(d); }
  const card = el('div', { class: 'rv-coach rv-panel', role: 'note', 'aria-live': 'polite' },
    el('div', { class: 'rv-coach-head' }, stepEl, dotsEl),
    textEl,
    el('div', { class: 'rv-actions' },
      btn('Skip', () => { ui.audio().ui('close'); ui.app.settings.set({ showTutorial: false }); hide(); }, { class: 'rv-small', aria: 'Skip the tutorial' }),
      btn('Got it', () => { ui.audio().ui('click'); hide(); }, { class: 'rv-small rv-primary' }),
    ),
  );
  const layer = el('div', { class: 'rv-tutorial-layer' }, card);
  layer.hidden = true;
  let current = -1;

  function show(step: number, text: string): void {
    if (!ui.settings().showTutorial) return;
    current = step;
    setText(stepEl, `Tutorial ${Math.min(total, step + 1)} / ${total}`);
    setText(textEl, text);
    dots.forEach((d, i) => { d.classList.toggle('rv-done', i < step); d.classList.toggle('rv-cur', i === step); });
    dotsEl.setAttribute('aria-valuenow', String(step + 1));
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
    const z = zone() ?? { left: 8, top: 60, right: vw - 8, bottom: vh - 8 };
    const cw = card.offsetWidth || 260, ch = card.offsetHeight || 90;
    let left = (z.left + z.right - cw) / 2, top = z.top;
    card.classList.remove('rv-arrow-bottom', 'rv-arrow-none');
    let arrowX = 24;
    if (a.el && a.el.isConnected && !a.el.hidden) {
      const r = a.el.getBoundingClientRect();
      if (r.width > 0) {
        left = r.left;
        if (a.side === 'below') top = Math.max(r.bottom + 12, z.top);
        else { top = Math.min(r.top - ch - 12, z.bottom - ch); card.classList.add('rv-arrow-bottom'); }
        // keep the card inside the free zone (never over the top bar, dock, rails or panels)
        left = Math.max(z.left, Math.min(z.right - cw, left));
        top = Math.max(z.top, Math.min(z.bottom - ch, top));
        arrowX = Math.max(14, Math.min(cw - 24, r.left + Math.min(r.width / 2, 40) - left));
      } else card.classList.add('rv-arrow-none');
    } else card.classList.add('rv-arrow-none');
    const l = Math.round(left) + 'px', t = Math.round(top) + 'px';
    if (card.style.left !== l) card.style.left = l;
    if (card.style.top !== t) card.style.top = t;
    card.style.setProperty('--arrow-x', Math.round(arrowX) + 'px');
  }

  return { el: layer, show, hide, reposition, visible };
}
