/**
 * Safe-zone layout controller. The HUD is a fixed grid of zones: top bar, left rail, right rail (inspector or shop),
 * bottom dock (wave banner → stop pill → train strip). This module measures the live zone sizes and publishes them as
 * CSS custom properties on #ui (--rv-top-h, --rv-dock-h) plus state classes (rv-compact, rv-log-on, rv-rail-collapsed),
 * and exposes freeZone() — the rectangle nothing anchored (tooltips, tutorial cards, event modal) may leave.
 */
import type { UiShared } from './shared';
import type { SimState } from '../core/types';

export interface Rect { left: number; top: number; right: number; bottom: number }

export interface Layout {
  /** Called every UI tick with the current state (null on the title screen). */
  update(s: SimState | null): void;
  /** Viewport minus top bar, dock, left column and any open right panel. */
  freeZone(): Rect;
  /** Force a re-measure (after panels open/close, resize). */
  measure(): void;
  destroy(): void;
}

export const COMPACT_BELOW = 1366;

export function createLayout(ui: UiShared, zones: { top: HTMLElement; dock: HTMLElement; left: HTMLElement }): Layout {
  const root = ui.root;
  let topH = 56, dockH = 150, leftW = 64;
  let ro: ResizeObserver | null = null;

  function setVar(name: string, px: number): void {
    const v = Math.round(px) + 'px';
    if (root.style.getPropertyValue(name) !== v) root.style.setProperty(name, v);
  }
  function measure(): void {
    const th = zones.top.hidden ? 0 : zones.top.offsetHeight;
    const dh = zones.dock.hidden ? 0 : zones.dock.offsetHeight;
    if (th > 0) topH = th;
    dockH = dh;
    leftW = zones.left.hidden ? 0 : zones.left.offsetWidth;
    setVar('--rv-top-h', topH);
    setVar('--rv-dock-h', dockH);
    applyClasses();
  }
  function applyClasses(): void {
    const s = ui.settings();
    const compact = !!s.compactHud || window.innerWidth < COMPACT_BELOW;
    if (root.classList.contains('rv-compact') !== compact) root.classList.toggle('rv-compact', compact);
    const log = !!s.showLog;
    if (root.classList.contains('rv-log-on') !== log) root.classList.toggle('rv-log-on', log);
  }

  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => measure());
    ro.observe(zones.top); ro.observe(zones.dock); ro.observe(zones.left);
  }
  const onResize = () => measure();
  window.addEventListener('resize', onResize);
  const unsub = ui.app.settings.onChange(() => measure());
  measure();

  function update(s: SimState | null): void {
    // the route rail collapses to an icon strip while the plan is fine; it stays open when the player must act
    let need = true;
    if (s) {
      const t = s.train;
      const ahead = Math.max(0, s.route.path.length - 1 - t.routeIndex);
      const noRoute = t.stopped && (t.stopReason === 'no_route' || t.stopReason === 'junction' || t.stopReason === 'derailed');
      need = noRoute || !!s.route.blocked || !!t.reversing || (ahead === 0 && s.phase === 'running' && !t.stopped && t.stopReason !== 'settlement');
    }
    const collapsed = !need;
    if (root.classList.contains('rv-rail-collapsed') !== collapsed) { root.classList.toggle('rv-rail-collapsed', collapsed); measure(); }
  }

  function freeZone(): Rect {
    const vw = window.innerWidth, vh = window.innerHeight;
    let right = vw;
    for (const side of Array.from(root.querySelectorAll<HTMLElement>(':scope > .rv-side'))) {
      if (side.hidden || side.classList.contains('rv-closing')) continue;
      const r = side.getBoundingClientRect();
      if (r.width > 0) right = Math.min(right, r.left);
    }
    const dockTop = dockH > 0 ? vh - 10 - dockH : vh;
    return { left: Math.min(leftW, vw * 0.3) + 8, top: topH + 8, right: right - 8, bottom: dockTop - 8 };
  }

  return {
    update, freeZone, measure,
    destroy() { ro?.disconnect(); window.removeEventListener('resize', onResize); unsub(); },
  };
}
