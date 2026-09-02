/** Pause menu. */
import { el, btn, setText } from './dom';
import type { UiShared } from './shared';

export interface PauseActions { restart(): void; newSeed(): void; quit(): void }

export function createPause(ui: UiShared, actions: PauseActions): { el: HTMLElement; refresh(): void } {
  const seedEl = el('div', { class: 'rv-seed', text: 'seed —' });
  const overlay = el('div', { class: 'rv-overlay rv-pause', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pause menu' },
    el('div', { class: 'rv-panel rv-modal' },
      el('h2', { text: 'Paused' }),
      seedEl,
      el('div', { class: 'rv-hr' }),
      el('div', { class: 'rv-menu rv-rows' },
        btn('Resume', () => { ui.audio().ui('close'); ui.close('pause'); }, { class: 'rv-big rv-primary', aria: 'Resume the run' }),
        btn('Restart run (same seed)', async () => {
          ui.audio().ui('click');
          if (await ui.confirm({ title: 'Restart run', text: 'Restart this run from the beginning with the same seed? Current progress is lost.', yes: 'Restart', danger: true })) {
            ui.close('pause');
            actions.restart();
          }
        }, { class: 'rv-big', aria: 'Restart run with the same seed' }),
        btn('New seed', async () => {
          ui.audio().ui('click');
          if (await ui.confirm({ title: 'New run', text: 'Abandon this run and start a new one with a random seed?', yes: 'New run', danger: true })) {
            ui.close('pause');
            actions.newSeed();
          }
        }, { class: 'rv-big', aria: 'Start a new run with a new seed' }),
        btn('Settings', () => { ui.audio().ui('open'); ui.open('settings'); }, { class: 'rv-big' }),
        btn('Save & Quit to title', () => { ui.audio().ui('confirm'); ui.close('pause'); actions.quit(); }, { class: 'rv-big', aria: 'Save and quit to title' }),
      ),
      el('div', { class: 'rv-hint', text: 'Esc or Space resumes. Progress is auto-saved.' }),
    ),
  );
  function refresh(): void {
    const s = ui.state();
    setText(seedEl, s ? `seed ${s.seed}  ·  ${Math.floor(s.time / 60)} min  ·  ${s.train.cars.length} cars` : 'seed —');
  }
  ui.registerPanel('pause', {
    el: overlay, modal: true, escClosable: true,
    onOpen: () => { ui.pauseForMenu(); refresh(); },
    onClose: () => ui.resumeFromMenu(),
  });
  return { el: overlay, refresh };
}
