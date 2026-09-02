/** Speaker button + volume popover (master / music / effects / ambience / interface + mute). */
import { el, btn } from './dom';
import type { UiShared } from './shared';
import type { Settings } from '../core/types';
import { gsap, D } from './motion';

export type VolumeKey = 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'ambienceVolume' | 'uiVolume';
export const VOLUME_KEYS: Array<{ key: VolumeKey; label: string }> = [
  { key: 'masterVolume', label: 'Master' },
  { key: 'musicVolume', label: 'Music' },
  { key: 'sfxVolume', label: 'Effects' },
  { key: 'ambienceVolume', label: 'Ambience' },
  { key: 'uiVolume', label: 'Interface' },
];

/** Push one volume into the audio engine (also persists via the engine → settings store). */
export function applyVolume(ui: UiShared, key: VolumeKey, v: number): void {
  const a = ui.audio();
  switch (key) {
    case 'masterVolume': a.setMaster(v); break;
    case 'musicVolume': a.setMusic(v); break;
    case 'sfxVolume': a.setSfx(v); break;
    case 'ambienceVolume': a.setAmbience?.(v); break;
    case 'uiVolume': a.setUi?.(v); break;
  }
  // engines that predate the setter still get the value persisted
  ui.app.settings.set({ [key]: v } as Partial<Settings>);
}

export interface VolumeSlider { wrap: HTMLElement; refresh(s: Settings): void }
/** A labelled range input bound to one volume key; shared by the popover and the Settings panel. */
export function volumeSlider(ui: UiShared, key: VolumeKey, label: string, cls = 'rv-setting'): VolumeSlider {
  const out = el('output', { text: '0' });
  const input = el('input', { type: 'range', min: '0', max: '100', step: '1', 'aria-label': label + ' volume' });
  input.addEventListener('input', () => {
    const v = Number(input.value) / 100;
    out.textContent = Math.round(v * 100) + '%';
    applyVolume(ui, key, v);
  });
  input.addEventListener('change', () => ui.audio().ui('click'));
  const wrap = el('div', { class: cls }, el('label', null, label, out), input);
  return { wrap, refresh: (s) => { const v = Math.round(((s[key] as number) ?? 0) * 100); input.value = String(v); out.textContent = v + '%'; } };
}

const ICON_ON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 5.5a8.5 8.5 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export interface VolumePopover { button: HTMLButtonElement; pop: HTMLElement; isOpen(): boolean; close(): void; open(): void; refresh(): void; destroy(): void }

export function createVolumePopover(ui: UiShared): VolumePopover {
  const sliders = VOLUME_KEYS.map(k => volumeSlider(ui, k.key, k.label, 'rv-setting rv-vol'));
  const mute = el('input', { type: 'checkbox', 'aria-label': 'Mute all audio' });
  mute.addEventListener('change', () => { ui.app.settings.set({ muted: mute.checked }); ui.audio().setMuted(mute.checked); ui.audio().ui('click'); refresh(); });
  const pop = el('div', { class: 'rv-volpop rv-panel', role: 'dialog', 'aria-label': 'Volume' },
    el('div', { class: 'rv-label', text: 'Volume' }),
    ...sliders.map(s => s.wrap),
    el('label', { class: 'rv-vol-mute' }, mute, el('span', { text: 'Mute all' }), el('kbd', { text: 'M' })),
  );
  pop.hidden = true;
  const button = btn('', () => { if (pop.hidden) open(); else close(); }, { class: 'rv-icon rv-speaker', aria: 'Volume (M mutes)', title: 'Volume' });
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');

  function refresh(): void {
    const s = ui.settings();
    for (const sl of sliders) sl.refresh(s);
    mute.checked = !!s.muted;
    const html = s.muted ? ICON_OFF : ICON_ON;
    if (button.innerHTML !== html) button.innerHTML = html;
    button.classList.toggle('rv-muted', !!s.muted);
  }
  function open(): void {
    if (!pop.hidden) return;
    refresh();
    pop.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    ui.audio().ui('open');
    gsap.fromTo(pop, { opacity: 0, y: -8, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: D(0.22), ease: 'power2.out', clearProps: 'transform,opacity' });
    const first = pop.querySelector<HTMLElement>('input'); if (first) { try { first.focus({ preventScroll: true }); } catch { /* */ } }
    window.setTimeout(() => document.addEventListener('pointerdown', onDoc, true), 0);
  }
  function close(): void {
    if (pop.hidden) return;
    pop.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDoc, true);
  }
  function onDoc(e: Event): void {
    const t = e.target as Node | null;
    if (t && (pop.contains(t) || button.contains(t))) return;
    close();
  }
  const unsub = ui.app.settings.onChange(() => refresh());
  refresh();
  return { button, pop, isOpen: () => !pop.hidden, open, close, refresh, destroy() { close(); unsub(); } };
}
