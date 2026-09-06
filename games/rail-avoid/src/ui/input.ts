/** Keyboard + gamepad input. */
import { el, isTypingTarget } from './dom';
import type { UiShared } from './shared';

export interface InputActions {
  togglePause(): void;
  escape(): void;
  toggleInspector(): void;
  howto(): void;
  toggleMute(): void;
  detachLast(): void;
  toggleReverse(): void;
  departOrClose(): void;
  /** Gamepad button pressed while a modal is open (expedition, relic choice, crew picker). Return true when consumed. */
  modalButton?(button: number): boolean;
  /** Gamepad button pressed while the junction chooser is docked (A/B/X → branches 1-3). Return true when consumed. */
  junctionButton?(button: number): boolean;
}

export interface Input { update(dt: number): void; destroy(): void; overlay: HTMLElement }

const PAN_SPEED = 700; // screen px per second

export function createInput(ui: UiShared, actions: InputActions): Input {
  const held = new Set<string>();
  const overlay = el('div', { class: 'rv-gamepad rv-panel', role: 'status', 'aria-label': 'Gamepad connected' },
    el('div', { class: 'rv-gp-title', text: 'Gamepad connected' }),
    el('span', null, el('b', { text: 'L-stick' }), ' pan'), el('span', null, el('b', { text: 'R-stick' }), ' cursor'),
    el('span', null, el('b', { text: 'A' }), ' plan at cursor'), el('span', null, el('b', { text: 'B' }), ' unplan last'),
    el('span', null, el('b', { text: 'X' }), ' depart / leave yard'), el('span', null, el('b', { text: 'Y' }), ' train panel'),
    el('span', null, el('b', { text: 'Start' }), ' pause'), el('span', null, el('b', { text: 'LB / RB' }), ' speed'),
  );
  overlay.hidden = true;
  let overlayTimer = 0;
  const prevButtons = new Map<number, boolean[]>();
  let cursorRepeat = 0;

  function gameKeysAllowed(): boolean { return ui.runActive() && !ui.anyModal(); }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) {
      if (ui.anyModal() && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
      return;
    }
    const k = e.key;
    if (isTypingTarget(e.target)) {
      // Escape still closes the top panel from inside sliders / checkboxes / the seed field
      if (k !== 'Escape') return;
      try { (e.target as HTMLElement).blur(); } catch { /* ignore */ }
    }
    const code = e.code;
    const sim = ui.sim();
    const view = ui.view();
    const st = ui.state();
    // global keys
    if (k === 'Escape') { e.preventDefault(); actions.escape(); return; }
    if (k === 'm' || k === 'M') { e.preventDefault(); actions.toggleMute(); return; }
    if (k === 'h' || k === 'H') { e.preventDefault(); actions.howto(); return; }
    if (!ui.runActive()) return;
    // Keep native focus traversal and button activation. Game shortcuts must not
    // swallow Tab/Enter/Space while a player is navigating the command surface.
    if (k === 'Tab') return;
    if ((k === 'Enter' || k === ' ') && e.target instanceof Element && e.target.closest('button, [role="button"], summary, a[href]')) return;
    if (k === 't' || k === 'T') { if (!ui.anyModal()) { e.preventDefault(); actions.toggleInspector(); } return; }
    if (ui.anyModal()) {
      // Space/Enter in the pause menu resumes
      if ((k === ' ' || k.toLowerCase() === 'c' || k === 'Enter') && ui.topModal() === 'pause') { e.preventDefault(); ui.close('pause'); }
      return;
    }
    if (!sim || !st) return;
    switch (true) {
      case k === ' ': e.preventDefault(); actions.togglePause(); break;
      case k === '1': sim.setSpeed(1); if (st.phase === 'paused') sim.resume(); break;
      case k === '2': sim.setSpeed(2); if (st.phase === 'paused') sim.resume(); break;
      case k === '3': if (ui.isDev) { sim.setSpeed(4); if (st.phase === 'paused') sim.resume(); } break;
      case k === 'Backspace' || k === 'z' || k === 'Z': {
        e.preventDefault();
        const r = sim.unplanLast();
        ui.audio().ui(r.ok ? 'click' : 'error');
        if (!r.ok && r.reason) ui.notify(r.reason, 'warn');
        break;
      }
      case k === '+' || k === '=' || code === 'NumpadAdd': view?.zoomIn(); break;
      case k === '-' || k === '_' || code === 'NumpadSubtract': view?.zoomOut(); break;
      case k === 'f' || k === 'F': view?.centerOnTrain(); break;
      case k === 'Enter': e.preventDefault(); view?.confirmCursor(); break;
      case k === 'i' || k === 'I': view?.moveCursor(0, -1); break;
      case k === 'k' || k === 'K': view?.moveCursor(0, 1); break;
      case k === 'j' || k === 'J': view?.moveCursor(-1, 0); break;
      case k === 'l' || k === 'L': view?.moveCursor(1, 0); break;
      case k === 'x' || k === 'X': actions.departOrClose(); break;
      case k === 'p' || k === 'P': {
        if (sim.canService() && !sim.canShop()) { e.preventDefault(); sim.setFieldRepair(!st.train.service?.repairing); }
        break;
      }
      case k === 'r' || k === 'R': if (!e.repeat) actions.toggleReverse(); break;
      default:
        if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
          if (k.startsWith('Arrow')) e.preventDefault();
          const lk = k.toLowerCase();
          // D: tap = detach last car (confirm), hold = pan right
          if (lk === 'd' && !e.repeat && !held.has('d')) dDownAt = performance.now();
          held.add(lk);
        }
    }
  }
  let dDownAt = 0;
  function onKeyUp(e: KeyboardEvent): void {
    const lk = e.key.toLowerCase();
    if (lk === 'd' && held.has('d') && dDownAt > 0 && performance.now() - dDownAt < 220 && gameKeysAllowed() && !isTypingTarget(e.target)) {
      actions.detachLast();
    }
    if (lk === 'd') dDownAt = 0;
    held.delete(lk);
  }
  function onBlur(): void { held.clear(); }
  function onGamepad(): void {
    overlay.hidden = false;
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = window.setTimeout(() => { overlay.hidden = true; }, 5000);
    ui.notify('Gamepad connected', 'info');
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('gamepadconnected', onGamepad);

  function updateKeys(dt: number): void {
    if (!held.size || !gameKeysAllowed()) return;
    const view = ui.view();
    if (!view) return;
    let dx = 0, dy = 0;
    if (held.has('w') || held.has('arrowup')) dy -= 1;
    if (held.has('s') || held.has('arrowdown')) dy += 1;
    if (held.has('a') || held.has('arrowleft')) dx -= 1;
    if (held.has('d') || held.has('arrowright')) dx += 1;
    // 'd' also detaches on press; only pan while held with another key or after the press window
    if (dx || dy) view.panBy(dx * PAN_SPEED * dt, dy * PAN_SPEED * dt);
  }

  function updateGamepad(dt: number): void {
    let pads: (Gamepad | null)[] = [];
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch { return; }
    const view = ui.view();
    const sim = ui.sim();
    const st = ui.state();
    for (const gp of pads) {
      if (!gp) continue;
      const prev = prevButtons.get(gp.index) ?? [];
      const cur = gp.buttons.map(b => b.pressed);
      const pressed = (i: number) => !!cur[i] && !prev[i];
      prevButtons.set(gp.index, cur);
      const ax = (i: number) => { const v = gp.axes[i] ?? 0; return Math.abs(v) < 0.2 ? 0 : v; };
      if (pressed(9)) actions.togglePause();
      if (!ui.runActive()) continue;
      if (ui.anyModal()) {
        let consumed = false;
        if (actions.modalButton) for (let i = 0; i < cur.length; i++) if (pressed(i) && actions.modalButton(i)) consumed = true;
        if (consumed) continue;
        if (pressed(1) && ui.topModal() === 'pause') ui.close('pause');
        if (pressed(2) && ui.isOpen('shop')) actions.departOrClose();
        continue;
      }
      // a docked junction chooser takes A / B / X before the cursor / unplan / depart bindings
      if (actions.junctionButton && (pressed(0) || pressed(1) || pressed(2))) {
        let consumed = false;
        for (const i of [0, 1, 2]) if (pressed(i) && actions.junctionButton(i)) consumed = true;
        if (consumed) continue;
      }
      if (view) {
        const lx = ax(0), ly = ax(1);
        if (lx || ly) view.panBy(lx * PAN_SPEED * dt, ly * PAN_SPEED * dt);
        const rx = ax(2), ry = ax(3);
        const mag = Math.hypot(rx, ry);
        if (mag > 0.5) {
          cursorRepeat -= dt;
          if (cursorRepeat <= 0) {
            cursorRepeat = 0.18;
            const dc = Math.abs(rx) > Math.abs(ry) * 0.6 ? Math.sign(rx) : 0;
            const dr = Math.abs(ry) > Math.abs(rx) * 0.6 ? Math.sign(ry) : 0;
            view.moveCursor(dc, dr);
          }
        } else cursorRepeat = 0;
        if (pressed(0)) view.confirmCursor();
      }
      if (sim && st) {
        if (pressed(1)) { const r = sim.unplanLast(); ui.audio().ui(r.ok ? 'click' : 'error'); }
        if (pressed(2)) actions.departOrClose();
        if (pressed(3)) actions.toggleInspector();
        if (pressed(4)) { const m = st.speedMul <= 1 ? 1 : st.speedMul === 2 ? 1 : 2; sim.setSpeed(m as 1 | 2); }
        if (pressed(5)) { const m = st.speedMul < 2 ? 2 : (ui.isDev ? 4 : 2); sim.setSpeed(m as 2 | 4); if (st.phase === 'paused') sim.resume(); }
      }
    }
  }

  return {
    overlay,
    update(dt: number) { updateKeys(dt); updateGamepad(dt); },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('gamepadconnected', onGamepad);
      if (overlayTimer) clearTimeout(overlayTimer);
    },
  };
}
