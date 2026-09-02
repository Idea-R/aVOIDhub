/**
 * Cursor-following hover cards: settlement tooltip ('ui:hoverSettlement'), car mini card ('ui:hoverCar' and the
 * train strip) and the track-cost chip ('ui:hoverTile'). Cards fade in after ~120 ms, trail the pointer with a
 * little lag, flip sides near the edges and are clamped into layout.freeZone() so they never cover the top bar,
 * the dock or an open side panel.
 */
import { el, fmtTime, clamp } from './dom';
import type { UiShared } from './shared';
import type { Rect } from './layout';
import type { SimState, Settlement, ResourceKey } from '../core/types';
import type { GameEvents } from '../core/events';
import { CAR_DEFS } from '../core/cars';
import { nodeMeta } from './nodes';
import { levelOf, levelPips } from './levels';

type Kind = 'settlement' | 'car' | 'tile' | null;
const SHOW_DELAY = 120;
const OFFSET = 18;

export interface HoverCards {
  el: HTMLElement;
  /** Show the car card for a strip chip (anchored to the pointer). */
  showCar(index: number, x: number, y: number): void;
  hideCar(): void;
  update(): void;
  destroy(): void;
}

function fmtOffers(o: Partial<Record<ResourceKey, number>> | undefined): string {
  if (!o) return '';
  return Object.entries(o).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => `+${Math.round(v ?? 0)} ${k}`).join(' · ');
}

/** Hex distance between two tiles using their axial coords (falls back to offset-column distance). */
function hexDistance(s: SimState, ui: UiShared, aCol: number, aRow: number, bCol: number, bRow: number): number {
  const sim = ui.sim();
  const ta = sim?.tileAt(aCol, aRow), tb = sim?.tileAt(bCol, bRow);
  if (ta && tb && typeof ta.q === 'number' && typeof tb.q === 'number') {
    const dq = ta.q - tb.q, dr = ta.r - tb.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }
  return Math.max(Math.abs(aCol - bCol), Math.abs(aRow - bRow));
}

export function createHoverCards(ui: UiShared, layout: { freeZone(): Rect }): HoverCards {
  const card = el('div', { class: 'rv-hovercard rv-panel', role: 'tooltip', 'aria-hidden': 'true' });
  const chip = el('div', { class: 'rv-costchip', 'aria-hidden': 'true' });
  const root = el('div', { class: 'rv-hover-layer' }, card, chip);
  card.hidden = true; chip.hidden = true;

  let kind: Kind = null;
  let key = '';
  let showTimer = 0;
  let raf = 0;
  let tx = 0, ty = 0;       // target (pointer) position
  let cx = 0, cy = 0;       // current (lagged) position
  let px = 0, py = 0;       // last pointer position
  let overCanvas = false;
  let settlementId: string | null = null;
  let carIndex = -1;
  let lastRender = 0;
  let tile: GameEvents['ui:hoverTile'] | null = null;

  const onMove = (e: PointerEvent): void => {
    px = e.clientX; py = e.clientY;
    const t = e.target as HTMLElement | null;
    overCanvas = !!t && (t.tagName === 'CANVAS' || !!t.closest?.('#game'));
    if (!overCanvas && kind === 'tile') hideAll();
    if (kind) { tx = px; ty = py; }
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  function render(): boolean {
    const s = ui.state();
    const sim = ui.sim();
    if (!s || !sim) return false;
    if (kind === 'settlement') {
      const st = settlementId ? sim.settlementById(settlementId) : null;
      if (!st) return false;
      renderSettlement(st, s);
      return true;
    }
    if (kind === 'car') {
      const car = s.train.cars[carIndex];
      if (!car) return false;
      renderCar(carIndex, s);
      return true;
    }
    if (kind === 'tile') return renderTile();
    return false;
  }

  function row(k: string, v: string | HTMLElement, cls = ''): HTMLElement {
    return el('div', { class: 'rv-hc-row' + (cls ? ' ' + cls : '') }, el('span', { class: 'rv-hc-k', text: k }), typeof v === 'string' ? el('span', { class: 'rv-hc-v', text: v }) : v);
  }

  function renderSettlement(st: Settlement, s: SimState): void {
    const m = nodeMeta(st.type);
    const rows: HTMLElement[] = [];
    const offers = fmtOffers(st.offers);
    if (offers) rows.push(row('Offers', st.visited ? 'collected' : offers, st.visited ? 'rv-dim' : ''));
    if (st.passengers > 0 || st.rescued) rows.push(row('Passengers', st.rescued ? 'rescued' : `${st.passengers} waiting`));
    if (st.crew) rows.push(row('Crew', `a ${st.crew}`));
    let status: HTMLElement;
    if (st.consumed) status = el('span', { class: 'rv-hc-v rv-danger-text', text: 'lost to the void' });
    else {
      const left = st.deadline - s.time;
      const urgent = left < 90;
      status = el('span', { class: 'rv-hc-v' + (urgent ? ' rv-danger-text' : left < 240 ? ' rv-gold' : ''), text: left > 0 ? `void in ${fmtTime(left)}` : 'void arriving' });
    }
    rows.push(row('Void', status));
    const p = s.route.path[Math.min(s.train.routeIndex, s.route.path.length - 1)];
    if (p) rows.push(row('Distance', `${Math.round(hexDistance(s, ui, st.col, st.row, p[0], p[1]))} hex from the loco`));
    const tag = st.consumed ? 'consumed' : st.visited ? 'visited' : '';
    const kids: Array<HTMLElement | undefined> = [
      el('div', { class: 'rv-hc-head', style: `--accent:${m.color}` },
        el('span', { class: 'rv-hc-ico', text: m.icon }),
        el('span', { class: 'rv-hc-name', text: st.name }),
        el('span', { class: 'rv-hc-type', text: m.label }),
        tag ? el('span', { class: 'rv-hc-tag' + (st.consumed ? ' rv-bad' : ''), text: tag }) : undefined,
      ),
      m.blurb ? el('div', { class: 'rv-hc-blurb', text: m.blurb }) : undefined,
      ...rows,
    ];
    card.replaceChildren(...kids.filter((k): k is HTMLElement => !!k));
  }

  function renderCar(i: number, s: SimState): void {
    const car = s.train.cars[i];
    const def = CAR_DEFS[car.type];
    const hpR = car.maxHp > 0 ? car.hp / car.maxHp : 0;
    const lvl = levelOf(car);
    const rows: HTMLElement[] = [];
    const hpBar = el('span', { class: 'rv-hc-v' }, el('span', { class: 'rv-bar rv-hc-bar' }, el('i', { style: `width:${Math.round(hpR * 100)}%;background:${hpR < 0.3 ? 'var(--danger)' : hpR < 0.6 ? 'var(--gold)' : 'var(--good)'}` })), el('span', { text: `${Math.ceil(car.hp)}/${car.maxHp}` }));
    rows.push(row('HP', hpBar));
    rows.push(row('Heat', `${Math.round(car.heat)}${car.onFire ? ' · ON FIRE' : car.heat >= 80 ? ' · damaging' : ''}`, car.onFire || car.heat >= 80 ? 'rv-danger-text' : ''));
    if (def.powerUse > 0) { const pr = Math.round((car.derived?.powerRatio ?? 1) * 100); rows.push(row('Power', `${pr}%${pr < 100 ? ' brownout' : ''}`, pr < 100 ? 'rv-danger-text' : '')); }
    else if (def.powerGen > 0) rows.push(row('Power', `generator +${def.powerGen + (lvl - 1)}`));
    if (def.weapon && def.weapon.ammoPerShot > 0) rows.push(row('Ammo', car.derived?.hasAmmoSupply ? 'supplied' : 'NO SUPPLIER', car.derived?.hasAmmoSupply ? 'rv-good-text' : 'rv-danger-text'));
    else if (def.ammoSupplier) rows.push(row('Ammo', 'supplier'));
    if (car.boarders.length) rows.push(row('Boarders', `${car.boarders.length} aboard`, 'rv-danger-text'));
    if (def.passengerCap > 0) rows.push(row('Passengers', `${car.passengers} / ${def.passengerCap + (lvl - 1) * 4}`));
    const crew = car.crewId ? s.train.crew.find(c => c.id === car.crewId) : null;
    if (crew) rows.push(row('Crew', `${crew.name} (${crew.specialty})`));
    card.replaceChildren(
      el('div', { class: 'rv-hc-head', style: `--accent:${'#' + (def.color & 0xffffff).toString(16).padStart(6, '0')}` },
        el('span', { class: 'rv-hc-ico rv-hc-short', text: def.short }),
        el('span', { class: 'rv-hc-name', text: `${i + 1}. ${def.name}` }),
        levelPips(lvl, 'rv-hc-lvl'),
      ),
      ...rows,
    );
  }

  function renderTile(): boolean {
    const p = tile;
    if (!p || p.col < 0) return false;
    let text = '', tone = '';
    if (!p.plannable) {
      const sim = ui.sim();
      let why = 'Not plannable from here';
      if (sim) {
        try { const r = sim.previewPlan(p.col, p.row); if (r.reason) why = r.reason; } catch { /* */ }
        const t = sim.tileAt(p.col, p.row);
        if (t?.void) why = 'Consumed by the void';
        else if (t?.terrain === 'mountain') why = 'Mountain — impassable';
      }
      text = '✕ ' + why; tone = 'rv-no';
    } else if (p.free) { text = 'FREE · old rail'; tone = 'rv-free'; }
    else text = `${p.cost} rail${p.cost === 1 ? '' : 's'}`;
    if (chip.textContent !== text) chip.textContent = text;
    // toggle tone classes individually so the rv-on fade state survives re-renders
    chip.classList.toggle('rv-no', tone === 'rv-no');
    chip.classList.toggle('rv-free', tone === 'rv-free');
    return true;
  }

  /** Place `node` next to the target point, flipping sides near the free-zone edges. */
  function place(node: HTMLElement, x: number, y: number): void {
    const z = layout.freeZone();
    const w = node.offsetWidth || 200, h = node.offsetHeight || 60;
    let left = x + OFFSET, top = y + OFFSET;
    if (left + w > z.right) left = x - OFFSET - w;
    if (top + h > z.bottom) top = y - OFFSET - h;
    left = clamp(left, z.left, Math.max(z.left, z.right - w));
    top = clamp(top, z.top, Math.max(z.top, z.bottom - h));
    const tf = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    if (node.style.transform !== tf) node.style.transform = tf;
  }

  function tick(): void {
    raf = 0;
    if (!kind) return;
    const lag = ui.reducedMotion() ? 1 : 0.3;
    cx += (tx - cx) * lag; cy += (ty - cy) * lag;
    if (Math.abs(tx - cx) < 0.5) cx = tx;
    if (Math.abs(ty - cy) < 0.5) cy = ty;
    place(kind === 'tile' ? chip : card, cx, cy);
    raf = requestAnimationFrame(tick);
  }

  function show(k: Exclude<Kind, null>, id: string, x: number, y: number): void {
    const node = k === 'tile' ? chip : card;
    const other = k === 'tile' ? card : chip;
    const now = performance.now();
    const same = kind === k && key === id;
    kind = k; key = id;
    tx = Number.isFinite(x) ? x : px; ty = Number.isFinite(y) ? y : py;
    // the render layer may re-emit the same hover every frame: keep the fade timer and throttle re-renders
    if (same && !node.hidden && now - lastRender < 250) { if (!raf) raf = requestAnimationFrame(tick); return; }
    if (!render()) { hideAll(); return; }
    lastRender = now;
    if (!other.hidden) { other.hidden = true; other.classList.remove('rv-on'); other.setAttribute('aria-hidden', 'true'); }
    if (node.hidden) {
      cx = tx; cy = ty;
      node.hidden = false;
      node.classList.remove('rv-on');
      place(node, cx, cy);
      if (showTimer) clearTimeout(showTimer);
      showTimer = window.setTimeout(() => { showTimer = 0; node.classList.add('rv-on'); node.setAttribute('aria-hidden', 'false'); }, ui.reducedMotion() ? 0 : SHOW_DELAY);
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function hideAll(): void {
    kind = null; key = '';
    if (showTimer) { clearTimeout(showTimer); showTimer = 0; }
    for (const n of [card, chip]) { n.hidden = true; n.classList.remove('rv-on'); n.setAttribute('aria-hidden', 'true'); }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  const unsubs = [
    ui.app.bus.on('ui:hoverSettlement', (p) => {
      if (!ui.runActive() || !p) return;
      if (!p.id) { if (kind === 'settlement') hideAll(); return; }
      settlementId = p.id;
      show('settlement', p.id, p.x, p.y);
    }),
    ui.app.bus.on('ui:hoverCar', (p) => {
      if (!ui.runActive() || !p) return;
      if (p.index < 0) { if (kind === 'car') hideAll(); return; }
      carIndex = p.index;
      show('car', 'car:' + p.index, p.x, p.y);
    }),
    ui.app.bus.on('ui:hoverTile', (p) => {
      if (!ui.runActive()) return;
      tile = p;
      if (p.col < 0 || (kind && kind !== 'tile')) { if (kind === 'tile') hideAll(); return; }
      show('tile', `${p.col},${p.row}`, px, py);
    }),
  ];

  return {
    el: root,
    showCar(index, x, y) { if (!ui.runActive()) return; carIndex = index; show('car', 'strip:' + index, x, y); },
    hideCar() { if (kind === 'car') hideAll(); },
    update() {
      if (!kind || !ui.runActive()) { if (kind) hideAll(); return; }
      const now = performance.now();
      if (now - lastRender < 250) return;
      lastRender = now;
      if (!render()) hideAll();
    },
    destroy() { for (const u of unsubs) u(); window.removeEventListener('pointermove', onMove); hideAll(); },
  };
}
