/** Settings panel + applying settings to UI classes, view, cursors and audio. */
import { el, btn } from './dom';
import type { UiShared } from './shared';
import type { Settings } from '../core/types';
import { setReducedMotion } from './motion';
import { applyCursors } from './cursors';
import { volumeSlider, VOLUME_KEYS } from './volume';
import { DEFAULT_SETTINGS } from '../core/storage';

export function applySettings(ui: UiShared, s: Settings): void {
  const root = ui.root;
  setReducedMotion(!!s.reducedMotion);
  root.classList.toggle('rv-large', !!s.largeText);
  root.classList.toggle('rv-contrast', !!s.highContrast);
  root.classList.toggle('rv-reduced', !!s.reducedMotion);
  root.classList.toggle('rv-log-on', !!s.showLog);
  for (const m of ['deuteranopia', 'protanopia', 'tritanopia']) root.classList.toggle('rv-cb-' + m, s.colorblind === m);
  document.body.dataset.colorblind = s.colorblind;
  document.body.dataset.reducedMotion = s.reducedMotion ? '1' : '0';
  document.body.dataset.screenShake = s.screenShake ? '1' : '0';
  document.body.dataset.highContrast = s.highContrast ? '1' : '0';
  document.body.dataset.quality = s.quality;
  applyCursors(s.customCursor !== false);
  const v = ui.view();
  if (v) {
    try { v.setReducedMotion(!!s.reducedMotion); } catch { /* */ }
    try { v.setQuality(s.quality); } catch { /* */ }
  }
}

/** SVG colour-matrix filters (daltonisation) referenced by the #ui colourblind classes. */
export function createColorFilters(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'rv-svg-defs');
  svg.setAttribute('aria-hidden', 'true');
  const defs = document.createElementNS(NS, 'defs');
  const mats: Record<string, string> = {
    'rv-cb-protanopia': '1 0 0 0 0  -0.2549 1.2549 0 0 0  0.3031 -0.5451 1.242 0 0  0 0 0 1 0',
    'rv-cb-deuteranopia': '1 0 0 0 0  -0.4375 1.4375 0 0 0  0.2625 -0.5625 1.3 0 0  0 0 0 1 0',
    'rv-cb-tritanopia': '1.05 -0.3825 0.3325 0 0  0 1.2345 -0.2345 0 0  0 0 1 0 0  0 0 0 1 0',
  };
  for (const id of Object.keys(mats)) {
    const f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('color-interpolation-filters', 'sRGB');
    const m = document.createElementNS(NS, 'feColorMatrix');
    m.setAttribute('type', 'matrix');
    m.setAttribute('values', mats[id]);
    f.appendChild(m);
    defs.appendChild(f);
  }
  svg.appendChild(defs);
  return svg;
}

export function createSettings(ui: UiShared): HTMLElement {
  const store = ui.app.settings;
  const grid = el('div', { class: 'rv-settings-grid rv-rows' });

  const check = (key: keyof Settings, label: string, after?: (v: boolean) => void) => {
    const input = el('input', { type: 'checkbox', 'aria-label': label });
    input.addEventListener('change', () => {
      ui.audio().ui('click');
      store.set({ [key]: input.checked } as Partial<Settings>);
      after?.(input.checked);
    });
    const wrap = el('div', { class: 'rv-setting rv-check' }, el('label', { text: label }), input);
    return { wrap, refresh: (s: Settings) => { input.checked = !!s[key]; } };
  };
  const select = <K extends 'colorblind' | 'quality'>(key: K, label: string, options: Array<[Settings[K], string]>) => {
    const sel = el('select', { 'aria-label': label });
    for (const [v, t] of options) sel.appendChild(el('option', { value: String(v), text: t }));
    sel.addEventListener('change', () => {
      ui.audio().ui('click');
      store.set({ [key]: sel.value } as Partial<Settings>);
    });
    const wrap = el('div', { class: 'rv-setting' }, el('label', { text: label }), sel);
    return { wrap, refresh: (s: Settings) => { sel.value = String(s[key]); } };
  };
  const heading = (text: string) => ({ wrap: el('h3', { class: 'rv-settings-h', text }), refresh: () => { /* static */ } });

  const controls = [
    heading('Audio'),
    ...VOLUME_KEYS.map(k => volumeSlider(ui, k.key, k.label + ' volume')),
    check('muted', 'Mute all', v => ui.audio().setMuted(v)),
    heading('Interface'),
    check('compactHud', 'Compact HUD'),
    check('showLog', 'Show event log feed'),
    check('customCursor', 'Custom cursors'),
    check('showTutorial', 'Show tutorial'),
    check('autoFollowRail', 'Auto-follow rail lines'),
    check('showSeedField', 'Show seed field on title'),
    heading('Accessibility & display'),
    check('reducedMotion', 'Reduced motion'),
    check('screenShake', 'Screen shake'),
    check('highContrast', 'High contrast'),
    check('largeText', 'Large text'),
    select('colorblind', 'Colourblind mode', [['none', 'None'], ['deuteranopia', 'Deuteranopia'], ['protanopia', 'Protanopia'], ['tritanopia', 'Tritanopia']]),
    select('quality', 'Render quality', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]),
  ];
  for (const c of controls) grid.appendChild(c.wrap);

  const overlay = el('div', { class: 'rv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings' },
    el('div', { class: 'rv-panel rv-modal rv-settings' },
      el('h2', { text: 'Settings' }),
      grid,
      el('div', { class: 'rv-actions' },
        btn('Back', () => { ui.audio().ui('close'); ui.close('settings'); }, { class: 'rv-primary', aria: 'Close settings' }),
        btn('Reset defaults', () => {
          ui.audio().ui('click');
          store.set({ ...DEFAULT_SETTINGS });
          ui.audio().setMuted(false);
          refresh();
        }),
      ),
    ),
  );

  function refresh(): void {
    const s = store.get();
    for (const c of controls) c.refresh(s);
  }

  ui.registerPanel('settings', { el: overlay, modal: true, escClosable: true, onOpen: refresh });
  return overlay;
}
