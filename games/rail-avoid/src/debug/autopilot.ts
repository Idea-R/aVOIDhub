/**
 * Scripted play agent. Used by the verification harness (npm run verify) and available in
 * `?dev` builds through window.__RAIL.autopilot. It only talks to the sim through SimApi
 * commands, exactly like the UI does, so it exercises the same code paths as a player.
 */
import type { AppContext } from '../app';
import type { Car, CarType, Settlement, SimState } from '../core/types';
import { hexDistance } from '../core/hex';
import { CAR_DEFS } from '../core/cars';
import { MAX_CARS } from '../core/config';

export interface Autopilot {
  enabled: boolean;
  setEnabled(on: boolean): void;
  /** Call every frame with real seconds. Decisions are taken every ~0.5 s. */
  update(dt: number): void;
  /** Short description of the last decision (for reports). */
  status(): string;
}

const DECIDE_EVERY = 0.5;          // real seconds between decisions
const SCRAP_RESERVE = 25;          // never spend below this at a yard
const NO_ROUTE_REPLAN_AFTER = 2;   // seconds stopped with 'no_route' before a forced replan
const SETTLEMENT_SEARCH_RADIUS = 9;

/** Per-region shopping list (buyCar returns false when a car is not allowed - we just skip it). */
const SHOP_LISTS: CarType[][] = [
  ['gatling', 'barracks', 'cargo', 'coach'],
  ['cannon', 'radiator', 'scout', 'foundry'],
  ['flak', 'tesla', 'boiler', 'sleeper'],
  ['reactor', 'armor_plate', 'flamethrower', 'medical'],
];

export function createAutopilot(ctx: AppContext): Autopilot {
  let enabled = false;
  let acc = 0;
  let noRouteFor = 0;
  let decisions = 0;
  let last = 'idle';

  // ---------------------------------------------------------------- helpers
  function locoTile(state: SimState): [number, number] | null {
    const p = state.route.path;
    if (!p.length) return null;
    const i = Math.max(0, Math.min(state.train.routeIndex, p.length - 1));
    return p[i];
  }

  function passable(col: number, row: number): boolean {
    const t = ctx.sim.tileAt(col, row);
    return !!t && t.terrain !== 'mountain' && !t.void;
  }

  /** planPathTo(col,row); on failure try rows +-1..+-3 on the same column. */
  function tryPlan(col: number, row: number): boolean {
    const sim = ctx.sim;
    const state = sim.state;
    if (passable(col, row) && sim.planPathTo(col, row).ok) return true;
    for (let d = 1; d <= 3; d++) {
      for (const rr of [row - d, row + d]) {
        if (rr < 0 || rr >= state.mapH) continue;
        if (!passable(col, rr)) continue;
        if (sim.planPathTo(col, rr).ok) return true;
      }
    }
    return false;
  }

  function pickSettlement(state: SimState, lc: number, lr: number): Settlement | null {
    const t = state.train;
    const cars = t.cars;
    const needRepair = cars.some(c => c.hp > 0 && c.hp < c.maxHp * 0.5);
    const wantCars = cars.length < 5 && t.resources.scrap >= 30;
    let best: Settlement | null = null;
    let bestScore = -Infinity;
    for (const s of state.settlements) {
      if (s.visited || s.consumed || s.type === 'start') continue;
      if (s.col <= lc) continue;
      const d = hexDistance(lc, lr, s.col, s.row);
      if (d > SETTLEMENT_SEARCH_RADIUS) continue;
      if (!passable(s.col, s.row)) continue;
      let score = SETTLEMENT_SEARCH_RADIUS + 1 - d;
      switch (s.type) {
        case 'yard': if (needRepair || wantCars) score += 6; break;
        case 'depot': if (t.resources.rails < 8) score += 6; break;
        case 'fuel': if (t.resources.coal < 15) score += 8; break;
        case 'farm': if (t.resources.food < 8 && t.passengers > 0) score += 5; break;
        case 'terminus': score += 2; break;
        case 'village': score += 1; break;
        default: break;
      }
      if (s.passengers > 0 && t.passengerCap > t.passengers) score += 0.5;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return best;
  }

  /** Column to aim for when there is no settlement worth visiting: ~planRange hexes east. */
  function eastTarget(state: SimState, lc: number, lr: number, range: number): [number, number] | null {
    const maxCol = Math.min(state.mapW - 1, lc + Math.max(2, range));
    for (let c = maxCol; c > lc; c--) {
      for (let d = 0; d <= 3; d++) {
        for (const rr of d === 0 ? [lr] : [lr - d, lr + d]) {
          if (rr < 0 || rr >= state.mapH) continue;
          if (passable(c, rr)) return [c, rr];
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- decisions
  function planRoute(force: boolean): string {
    const sim = ctx.sim;
    const state = sim.state;
    const path = state.route.path;
    const ahead = path.length - 1 - state.train.routeIndex;
    const range = sim.currentPlanRange();
    if (!force && ahead >= range - 1) return '';
    if (force && state.route.blocked) sim.clearPlan();

    const loco = locoTile(state);
    const lc = loco ? loco[0] : 0;
    const lr = loco ? loco[1] : Math.floor(state.mapH / 2);

    const target = pickSettlement(state, lc, lr);
    if (target && tryPlan(target.col, target.row)) return `route -> ${target.name} (${target.type}) @${target.col},${target.row}`;

    const terminus = state.settlements.find(s => s.type === 'terminus' && !s.consumed && !s.visited && s.col > lc);
    if (terminus && tryPlan(terminus.col, terminus.row)) return `route -> terminus ${terminus.name}`;

    const east = eastTarget(state, lc, lr, range);
    if (east && tryPlan(east[0], east[1])) return `route -> east ${east[0]},${east[1]}`;

    const options = sim.plannableTiles();
    if (options.length) {
      const pick = options.reduce((a, b) => (b.col > a.col ? b : a));
      const r = sim.planTile(pick.col, pick.row);
      return r.ok ? `route -> fallback tile ${pick.col},${pick.row}` : `route failed: ${r.reason ?? 'unknown'}`;
    }
    return 'route: nothing plannable';
  }

  function assignCrew(): string {
    const sim = ctx.sim;
    const state = sim.state;
    const cars = state.train.cars;
    const free = (i: number) => !!cars[i] && cars[i].hp > 0 && !cars[i].crewId;
    const findIdx = (pred: (c: Car, i: number) => boolean): number => {
      for (let i = 0; i < cars.length; i++) if (free(i) && pred(cars[i], i)) return i;
      return -1;
    };
    const assigned: string[] = [];
    for (const cr of state.train.crew) {
      if (cr.carIndex >= 0) continue;
      let idx = -1;
      switch (cr.specialty) {
        case 'gunner':
          idx = findIdx(c => { const w = CAR_DEFS[c.type].weapon; return !!w && w.kind !== 'marines'; });
          break;
        case 'engineer':
          idx = findIdx((c, i) => i > 0 && CAR_DEFS[c.type].powerGen > 0);
          if (idx < 0) idx = findIdx((_c, i) => i === 0);
          break;
        case 'mechanic': {
          let best = -1, bestRatio = 2;
          for (let i = 0; i < cars.length; i++) {
            if (!free(i)) continue;
            const r = cars[i].hp / Math.max(1, cars[i].maxHp);
            if (r < bestRatio) { bestRatio = r; best = i; }
          }
          idx = best;
          break;
        }
        case 'medic':
          idx = findIdx(c => c.type === 'coach' || c.type === 'sleeper' || c.type === 'medical');
          break;
        case 'surveyor':
          idx = free(0) ? 0 : -1;
          break;
        case 'quartermaster':
          idx = findIdx(c => c.type === 'cargo' || c.type === 'armored_cargo');
          break;
      }
      if (idx < 0) idx = findIdx(() => true);
      if (idx >= 0 && sim.assignCrew(cr.id, idx)) assigned.push(`${cr.specialty}->${idx}`);
    }
    return assigned.length ? `crew ${assigned.join(' ')}` : '';
  }

  function shop(): string {
    const sim = ctx.sim;
    const state = sim.state;
    const scrap = () => state.train.resources.scrap;
    const parts: string[] = [];
    if (scrap() > SCRAP_RESERVE && state.train.cars.some(c => c.hp < c.maxHp)) {
      if (sim.repairAll()) parts.push('repairAll');
    }
    const list = SHOP_LISTS[Math.max(0, Math.min(SHOP_LISTS.length - 1, state.region))];
    for (const type of list) {
      if (state.train.cars.length >= MAX_CARS) break;
      const cost = CAR_DEFS[type].cost;
      if (scrap() - cost < SCRAP_RESERVE) continue;
      if (sim.buyCar(type)) parts.push('+' + type);
    }
    sim.closeShop();
    return `shop: ${parts.join(' ') || 'nothing'}; closed`;
  }

  function resolveEvent(): string {
    const sim = ctx.sim;
    if (sim.state.activeEvent?.preparingExpedition) {
      const ids = sim.state.train.crew.filter(c => c.hp > 20).slice(0, 3).map(c => c.id);
      if (sim.startExpedition(ids)) return 'event: away team dispatched';
      sim.cancelExpeditionPreparation();
    }
    for (const i of [0, 1, 2]) {
      if (sim.chooseEventOption(i)) return `event: option ${i}`;
    }
    return 'event: no option accepted';
  }

  function decide(): void {
    const sim = ctx.sim;
    const state = sim.state;
    decisions++;
    const notes: string[] = [];
    switch (state.phase) {
      case 'running':
        if (ctx.sim.state.boss.active && ctx.sim.state.boss.type === 'boss_maw') { notes.push('maw: holding the loop'); break; } {
        const t = state.train;
        if (t.stopped && t.stopReason === 'settlement' && t.stopTimer > 6) {
          sim.depart();
          notes.push('depart');
        }
        const crew = assignCrew();
        if (crew) notes.push(crew);
        const force = noRouteFor > NO_ROUTE_REPLAN_AFTER;
        const route = planRoute(force);
        if (route) notes.push((force ? 'replan(no_route) ' : '') + route);
        if (force) noRouteFor = 0;
        break;
      }
      case 'shop': notes.push(shop()); break;
      case 'event': notes.push(resolveEvent()); break;
      case 'relic': { const anySim = ctx.sim as any; if (typeof anySim.chooseRelic === 'function') { anySim.chooseRelic(0); notes.push('relic 0'); } break; }
      case 'expedition': {
        const anySim = ctx.sim as any; const x = ctx.sim.state.expedition;
        if (!x) break;
        if (x.outcome) { anySim.endExpedition(); notes.push('expedition end ' + x.outcome); }
        else if (x.awaitingAdvance) { anySim.advanceExpedition(true); notes.push('expedition descend'); }
        else if (x.pending) { anySim.expeditionResolve('good'); }
        else { anySim.expeditionAction('strike'); notes.push('expedition strike'); }
        break;
      }
      default: break;
    }
    if (notes.length) last = `#${decisions} t=${state.time.toFixed(1)} ${notes.join(' | ')}`;
  }

  const api: Autopilot = {
    get enabled() { return enabled; },
    set enabled(v: boolean) { enabled = !!v; },
    setEnabled(on: boolean) { enabled = !!on; if (!on) last = 'disabled'; },
    update(dt: number) {
      if (!enabled || !ctx.sim) return;
      const state = ctx.sim.state;
      const t = state.train;
      if (state.phase === 'running' && t.stopped && t.stopReason === 'no_route') noRouteFor += dt; else noRouteFor = 0;
      acc += dt;
      if (acc < DECIDE_EVERY) return;
      acc = 0;
      try { decide(); } catch (e) { last = 'autopilot error: ' + (e instanceof Error ? e.message : String(e)); }
    },
    status() { return last; },
  };
  return api;
}
