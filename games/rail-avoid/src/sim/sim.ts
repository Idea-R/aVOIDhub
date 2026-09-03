/** Simulation orchestrator implementing SimApi. Fixed-step, deterministic, JSON state. */
import type { SimState, CarType, Tile, Settlement, CarDef, EnemyDef, ResourceKey, Stats, EnemyType, LocoUpgradeKind, ExpeditionActionKind, ExpeditionTiming } from '../core/types';
import type { EventBus } from '../core/events';
import type { SimApi, SimContext, PlanResult } from './api';
import { Rng, hashSeed } from '../core/rng';
import { SIM_DT, MAP_W, MAP_H, REGION_W, REGION_NAMES, EVENTS, SCORE, SAVE_VERSION, HEX_R } from '../core/config';
import { CAR_DEFS } from '../core/cars';
import { ENEMY_DEFS } from '../core/enemies';
import { hexToWorld, tileKey } from '../core/hex';
import { generateWorld, worldToState } from './worldgen';
import { initTrain, updateTrain, computeTrail, detachFrom, moveCar, addCar, assignCrew, startReversing, stopReversing } from './train';
import { planRange, plannableTiles, previewPlan, planTile, unplanLast, clearPlan, planPathTo, edgeCost, tileHasRail, isRail, aheadCount, junctionOptions } from './route';
import { initWeather, initVoid, updateWeather, updateDayNight, updateVoid, voidDistance } from './weather';
import { updateEvents, chooseEventOption } from './simEvents';
import { onArrive, updateStop, depart, buyCar, sellCar, repairCar, repairAll, closeShop, canShop, upgradeCar, upgradeCost, upgradeLoco, locoUpgradeCost } from './settlements';
import { updateCombat, onTrainEnterTile, clearEnemies } from './combat';
import { initDirector, updateDirector, spawnWave } from './waves';
import { initBoss, updateBosses, spawnBoss } from './bosses';
import { updateLoot, chooseRelic, offerRelics, addMarks } from './loot';
import { updateBounties } from './bounties';
import { startExpedition, expeditionAction, expeditionResolve, endExpedition } from './expedition';
import { LOOT } from '../core/config';
import { tileAt, log, recomputeCapacity, locoPos, addResource, makeCar } from './helpers';
import { neighbors } from '../core/hex';

import { killHooks } from './helpers';
import { dropLoot } from './loot';
import { onEnemyKilledForBounty } from './bounties';
import { ENEMY_DEFS as _ED } from '../core/enemies';
if (killHooks.length === 0) {
  killHooks.push((ctx, e) => {
    if (e.type.startsWith('boss_')) { addMarks(ctx, LOOT.bossMarks, 'boss'); ctx.state.pendingEliteRelic = (ctx.state.pendingEliteRelic ?? 0) + 1; return; }
    dropLoot(ctx, e);
    onEnemyKilledForBounty(ctx, e.type);
  });
}
void _ED;

function emptyStats(): Stats {
  return { kills: {}, settlementsRescued: 0, settlementsLost: 0, carsLost: 0, railsLaid: 0, damageTaken: 0, damageDealt: 0, bossesDefeated: 0, eventsResolved: 0, score: 0 };
}

const TUTORIAL: string[] = [
  'Click a glowing hex ahead of the locomotive to lay track. Old rail lines (grey) are free; new track costs rails.',
  'The train follows your plan. Plan several hexes ahead — it never waits long.',
  'Your objective is always east: reach the Last Gate. The mission ticket shows progress; the VOID meter shows your safety margin.',
  'Enemies inbound! Turrets fire on their own. Watch AMMO supply and HEAT on the train strip below.',
  'CREW READY means a specialist is waiting. Click that ticket or any car, then use Crew Slot to post them. Their bonus starts immediately.',
  'Boarders on the train! Barracks and flamethrowers clear adjacent cars. Press D to detach the rear car in an emergency.',
  'At a repair yard, repair before expanding. Power reaches 3 cars, ammo suppliers reach 2, and heat spreads to neighbours.',
  'Junction: click the branch you want to follow. Branches lead to resources — and ambushes.',
  'New region: armoured crawlers resist bullets; cannons and tesla coils crack them. Sappers mine your planned track — a Scout Car reveals them.',
  'The Void Frontier: wisps and the Void Maw ignore bullets and shells. Only Tesla coils and flamethrowers hurt them — and they need full power.',
];

export class Sim implements SimApi {
  state: SimState;
  bus: EventBus;
  private ctx: SimContext;
  private acc = 0;
  private rng: SimContext['rng'];
  private ended = false;

  constructor(seed: number, bus: EventBus) {
    this.bus = bus;
    this.rng = { world: new Rng(seed), waves: new Rng(seed ^ 0x51ed270b), events: new Rng(seed ^ 0x2545f491), combat: new Rng(seed ^ 0x7f4a7c15) };
    this.state = this.freshState(seed);
    this.ctx = { state: this.state, bus, rng: this.rng, dt: SIM_DT, invulnerable: false };
    initTrain(this.state);
    recomputeCapacity(this.state);
    computeTrail(this.state);
    this.state.region = 0;
    this.syncRng();
    log(this.state, `Departure from Lastlight. Seed ${seed}.`, 'info');
  }

  private freshState(seed: number): SimState {
    const s: SimState = {
      version: SAVE_VERSION, seed, time: 0, tick: 0, phase: 'running', speedMul: 1,
      mapW: MAP_W, mapH: MAP_H, tiles: [], settlements: [],
      train: null as any,
      route: { path: [], builtLinks: [], railLinks: [], railLines: {}, planRange: 6, blocked: false, sapperCharges: [] },
      enemies: [], projectiles: [], weather: initWeather(), dayTime: 0.1, isNight: false,
      void: initVoid(), boss: initBoss(), director: initDirector(),
      activeEvent: null, eventCooldown: EVENTS.firstAfter, usedEvents: [],
      loot: [], bounties: [], pendingRelicChoice: null, phaseBeforeRelic: null, pendingEliteRelic: 0, expedition: null, phaseBeforeExpedition: null,
      region: 0, regionsEntered: [0], stats: emptyStats(), defeatReason: null, nextId: 1, tutorialStep: 0, log: [],
      rngState: { world: 0, waves: 0, events: 0, combat: 0 },
    };
    const w = generateWorld(seed);
    worldToState(s, w);
    return s;
  }

  private syncRng(): void {
    this.state.rngState = { world: this.rng.world.state, waves: this.rng.waves.state, events: this.rng.events.state, combat: this.rng.combat.state };
  }

  // ---------- main loop ----------
  update(realDt: number): void {
    if (this.state.phase === 'running' && this.state.speedMul > 0) {
      this.acc += Math.min(0.25, realDt) * this.state.speedMul;
      let n = 0;
      while (this.acc >= SIM_DT && n < 40) {
        this.acc -= SIM_DT;
        this.step();
        n++;
        if (this.state.phase !== 'running') { this.acc = 0; break; }
      }
    }
    this.bus.flush();
  }

  private step(): void {
    const s = this.state;
    const ctx = this.ctx;
    s.time += SIM_DT;
    s.tick++;
    updateDayNight(ctx);
    updateWeather(ctx);
    updateTrain(ctx, (c, r) => this.onEnterTile(c, r));
    if (this.checkEnd()) return;
    updateStop(ctx);
    updateCombat(ctx);
    if (this.checkEnd()) return;
    updateDirector(ctx);
    updateBosses(ctx);
    if (this.checkEnd()) return;
    updateVoid(ctx);
    if (this.checkEnd()) return;
    updateLoot(ctx);
    updateBounties(ctx);
    this.maintainMawLoop();
    updateEvents(ctx);
    this.tutorial();
    // cleanup dead enemies (combat removes on its own; belt and braces)
    if (s.tick % 20 === 0) s.enemies = s.enemies.filter(e => e.state !== 'dead');
    this.syncRng();
  }

  private checkEnd(): boolean {
    const s = this.state;
    if (s.phase === 'defeat' && !this.ended) {
      this.ended = true;
      s.speedMul = 1;
      this.bus.defer('phase:change', { phase: 'defeat' });
      this.bus.defer('run:defeat', { reason: s.defeatReason ?? 'Derailed', score: s.stats.score });
      log(s, 'DERAILED: ' + (s.defeatReason ?? ''), 'bad');
      return true;
    }
    return s.phase !== 'running';
  }

  private victory(): void {
    const s = this.state;
    if (this.ended) return;
    this.ended = true;
    const timeBonus = Math.max(0, 1800 - s.time) * SCORE.timeBonusPerSecondUnder;
    s.stats.score += SCORE.victory + Math.round(timeBonus) + s.train.cars.length * SCORE.carIntact;
    s.phase = 'victory';
    s.train.stopped = true; s.train.stopReason = 'none'; s.train.speed = 0;
    log(s, 'The Last Gate is open. The train crosses into the dawn.', 'good');
    this.bus.defer('phase:change', { phase: 'victory' });
    this.bus.defer('run:victory', { score: s.stats.score });
  }

  private onEnterTile(col: number, row: number): void {
    const s = this.state;
    const t = tileAt(s, col, row);
    if (!t) return;
    const region = Math.min(3, Math.floor(col / REGION_W));
    if (region !== s.region) {
      s.region = region;
      if (!s.regionsEntered.includes(region)) s.regionsEntered.push(region);
      this.bus.defer('region:enter', { region, name: REGION_NAMES[region] });
      log(s, `Entering ${REGION_NAMES[region]}`, 'info');
      if (region === 1) this.showTutorial(8);
      if (region === 3) this.showTutorial(9);
    }
    onTrainEnterTile(this.ctx, col, row);
    if (s.phase !== 'running') return;
    if (t.settlementId) {
      const st = s.settlements.find(x => x.id === t.settlementId);
      if (st && !st.visited) {
        if (st.type === 'terminus') {
          if (s.boss.gateOpen) { st.visited = true; this.victory(); return; }
          // pass through while the Maw lives
          return;
        }
        onArrive(this.ctx, st);
        this.showTutorial(4);
        if (st.type === 'yard') this.showTutorial(6);
      } else if (st && st.type === 'terminus' && s.boss.gateOpen) { this.victory(); return; }
    }
  }

  /** During the Void Maw fight the train circles the terminus ring; never let it dead-stop there. */
  private maintainMawLoop(): void {
    const s = this.state;
    if (!s.boss.active || s.boss.type !== 'boss_maw') return;
    const t = s.train;
    if (!t.stopped || (t.stopReason !== 'no_route' && t.stopReason !== 'junction')) return;
    const end = s.route.path[s.route.path.length - 1];
    const loop = s.boss.loopTiles;
    const onLoop = loop.some(p => p[0] === end[0] && p[1] === end[1]);
    if (!onLoop) {
      // head to the nearest loop tile
      const best = loop.map(p => ({ p, d: Math.hypot(hexToWorld(p[0], p[1]).x - hexToWorld(end[0], end[1]).x, hexToWorld(p[0], p[1]).y - hexToWorld(end[0], end[1]).y) })).sort((a, b) => a.d - b.d)[0];
      if (best) planPathTo(this.ctx, best.p[0], best.p[1]);
      return;
    }
    const i = loop.findIndex(p => p[0] === end[0] && p[1] === end[1]);
    const prev = s.route.path[s.route.path.length - 2];
    const next = loop[(i + 1) % loop.length];
    const alt = loop[(i + loop.length - 1) % loop.length];
    const pick = prev && prev[0] === next[0] && prev[1] === next[1] ? alt : next;
    const r = planTile(this.ctx, pick[0], pick[1]);
    if (!r.ok) planTile(this.ctx, alt[0], alt[1]);
  }

  private showTutorial(step: number): void {
    const bit = 1 << step;
    if (this.state.tutorialStep & bit) return;
    this.state.tutorialStep |= bit;
    this.bus.defer('tutorial:step', { step, text: TUTORIAL[step] });
  }

  private tutorial(): void {
    const s = this.state;
    if (s.tick === 2) this.showTutorial(0);
    if (s.route.path.length > 1) this.showTutorial(1);
    if (s.time > 25) this.showTutorial(2);
    if (s.director.warning) this.showTutorial(3);
    if (s.train.crew.some(c => c.carIndex < 0)) this.showTutorial(4);
    if (s.train.cars.some(c => c.boarders.length > 0)) this.showTutorial(5);
    if (s.phase === 'shop') this.showTutorial(6);
    if (s.train.stopped && s.train.stopReason === 'junction') this.showTutorial(7);
    if (s.region >= 1) this.showTutorial(8);
    if (s.region >= 3) this.showTutorial(9);
  }

  // ---------- flow ----------
  setSpeed(mul: 0 | 1 | 2 | 4): void {
    if (mul === 0) { this.pause(); return; }
    if (this.state.phase === 'paused') this.resume();
    this.state.speedMul = mul;
  }
  pause(): void {
    if (this.state.phase === 'running') { this.state.phase = 'paused'; this.bus.emit('phase:change', { phase: 'paused' }); }
  }
  resume(): void {
    if (this.state.phase === 'paused') { this.state.phase = 'running'; this.bus.emit('phase:change', { phase: 'running' }); }
  }
  isPaused(): boolean { return this.state.phase === 'paused'; }

  // ---------- route ----------
  previewPlan(col: number, row: number): PlanResult { return previewPlan(this.state, col, row); }
  planTile(col: number, row: number): PlanResult {
    if (this.state.phase === 'defeat' || this.state.phase === 'victory') return { ok: false, reason: 'Run over' };
    const r = planTile(this.ctx, col, row);
    this.bus.flush();
    return r;
  }
  unplanLast(): PlanResult { const r = unplanLast(this.ctx); this.bus.flush(); return r; }
  clearPlan(): void { clearPlan(this.ctx); this.bus.flush(); }
  plannableTiles() { return plannableTiles(this.state); }
  junctionOptions() { return junctionOptions(this.state); }
  planPathTo(col: number, row: number): PlanResult {
    if (this.state.phase === 'defeat' || this.state.phase === 'victory') return { ok: false, reason: 'Run over' };
    const r = planPathTo(this.ctx, col, row); this.bus.flush(); return r;
  }

  // ---------- train ----------
  depart(): void { depart(this.ctx); this.bus.flush(); }
  reverse(on: boolean): void { if (on) startReversing(this.ctx); else stopReversing(this.ctx); this.bus.flush(); }
  isReversing(): boolean { return !!this.state.train.reversing; }
  detachFrom(carIndex: number): boolean { const r = detachFrom(this.ctx, carIndex); this.bus.flush(); return r; }
  moveCar(from: number, to: number): boolean { if (!canShop(this.ctx)) return false; const r = moveCar(this.ctx, from, to); this.bus.flush(); return r; }
  buyCar(type: CarType, insertAt?: number): boolean { const r = buyCar(this.ctx, type, insertAt); this.bus.flush(); return r; }
  sellCar(carIndex: number): boolean { const r = sellCar(this.ctx, carIndex); this.bus.flush(); return r; }
  repairCar(carIndex: number): boolean { const r = repairCar(this.ctx, carIndex); this.bus.flush(); return r; }
  repairAll(): boolean { const r = repairAll(this.ctx); this.bus.flush(); return r; }
  upgradeCar(carIndex: number): boolean { const r = upgradeCar(this.ctx, carIndex); this.bus.flush(); return r; }
  upgradeCost(carIndex: number): number { return upgradeCost(this.ctx, carIndex); }
  upgradeLoco(kind: LocoUpgradeKind): boolean { const r = upgradeLoco(this.ctx, kind); this.bus.flush(); return r; }
  locoUpgradeCost(kind: LocoUpgradeKind): number { return locoUpgradeCost(this.ctx, kind); }
  assignCrew(crewId: string, carIndex: number): boolean { const r = assignCrew(this.ctx, crewId, carIndex); this.bus.flush(); return r; }
  closeShop(): void { closeShop(this.ctx); this.bus.flush(); }
  canShop(): boolean { return canShop(this.ctx); }

  chooseEventOption(index: number): boolean { const r = chooseEventOption(this.ctx, index); this.bus.flush(); return r; }
  chooseRelic(index: number): boolean { const r = chooseRelic(this.ctx, index); this.bus.flush(); return r; }
  startExpedition(crewIds: string[]): boolean {
    const s = this.state;
    const site = s.settlements.find(x => x.type === 'site' && s.route.path[s.train.routeIndex] && x.col === s.route.path[s.train.routeIndex][0] && x.row === s.route.path[s.train.routeIndex][1]);
    const r = startExpedition(this.ctx, crewIds, site ? site.name : 'the ruins');
    this.bus.flush(); return r;
  }
  expeditionAction(kind: ExpeditionActionKind, targetFoe?: number): boolean { const r = expeditionAction(this.ctx, kind, targetFoe); this.bus.flush(); return r; }
  expeditionResolve(timing: ExpeditionTiming): boolean { const r = expeditionResolve(this.ctx, timing); this.bus.flush(); return r; }
  endExpedition(): boolean { const r = endExpedition(this.ctx); this.bus.flush(); return r; }

  // ---------- queries ----------
  tileAt(col: number, row: number): Tile | null { return tileAt(this.state, col, row); }
  settlementById(id: string): Settlement | null { return this.state.settlements.find(s => s.id === id) ?? null; }
  carDef(type: CarType): CarDef { return CAR_DEFS[type]; }
  enemyDef(type: string): EnemyDef { return ENEMY_DEFS[type as EnemyType] ?? ENEMY_DEFS.raider; }
  currentPlanRange(): number { return planRange(this.state); }
  trackCostAt(col: number, row: number): number {
    const p = this.state.route.path; const e = p[p.length - 1];
    return edgeCost(this.state, e[0], e[1], col, row).cost;
  }
  resourceCap(key: ResourceKey): number { return this.state.train.capacity[key]; }
  locoPos(): { x: number; y: number } { return locoPos(this.state); }
  voidDistance(): number { return voidDistance(this.state); }

  // ---------- persistence ----------
  serialize(): string {
    this.syncRng();
    return JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state: this.state });
  }
  restore(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (!data || data.version !== SAVE_VERSION || !data.state || !Array.isArray(data.state.tiles)) return false;
      const st = data.state as SimState;
      if (st.phase === 'paused' || st.phase === 'event' || st.phase === 'shop') { /* keep */ } else if (st.phase !== 'running') st.phase = 'running';
      this.state = st;
      this.ctx.state = st;
      if (st.train.reversing === undefined) st.train.reversing = false;
      if (!st.train.locoUpgrades) st.train.locoUpgrades = { speed: 0, power: 0, frame: 0, crew: 0 };
      if (st.train.watchUntil === undefined) st.train.watchUntil = 0;
      for (const c of st.train.cars) if (!c.level) c.level = 1;
      if (!st.route.railLines) st.route.railLines = {};
      if (!st.train.relics) st.train.relics = [];
      if (st.train.marks === undefined) st.train.marks = 0;
      if (!st.loot) st.loot = [];
      if (!st.bounties) st.bounties = [];
      if (st.pendingRelicChoice === undefined) st.pendingRelicChoice = null;
      if (st.phaseBeforeRelic === undefined) st.phaseBeforeRelic = null;
      if (!st.pendingEliteRelic) st.pendingEliteRelic = 0;
      if (st.expedition === undefined) st.expedition = null;
      if (st.phaseBeforeExpedition === undefined) st.phaseBeforeExpedition = null;
      this.rng.world.state = st.rngState.world >>> 0; this.rng.waves.state = st.rngState.waves >>> 0;
      this.rng.events.state = st.rngState.events >>> 0; this.rng.combat.state = st.rngState.combat >>> 0;
      this.ended = false;
      this.acc = 0;
      recomputeCapacity(st);
      computeTrail(st);
      this.bus.emit('run:loaded', { seed: st.seed });
      this.bus.emit('phase:change', { phase: st.phase });
      if (st.phase === 'event' && st.activeEvent) this.bus.emit('event:show', { defId: st.activeEvent.defId });
      if (st.phase === 'shop') this.bus.emit('ui:openPanel', { panel: 'shop' });
      return true;
    } catch (e) {
      console.error('restore failed', e);
      return false;
    }
  }

  // ---------- debug ----------
  debug = {
    warpToRegion: (region: number) => {
      const s = this.state;
      region = Math.max(0, Math.min(3, Math.floor(region)));
      const col = region * REGION_W + 1;
      // find a rail tile in that column band nearest the middle row
      let best: [number, number] | null = null, bd = 1e9;
      for (let c = col; c < col + 4 && !best; c++) {
        for (let r = 0; r < MAP_H; r++) {
          const t = tileAt(s, c, r);
          if (!t || t.terrain === 'mountain' || t.terrain === 'water') continue;
          if (!tileHasRail(s, c, r)) continue;
          const d = Math.abs(r - MAP_H / 2);
          if (d < bd) { bd = d; best = [c, r]; }
        }
      }
      if (!best) best = [col, Math.floor(MAP_H / 2)];
      clearEnemies(this.ctx);
      s.route.path = [best];
      s.route.builtLinks = [];
      s.route.sapperCharges = [];
      s.route.blocked = false;
      s.train.routeIndex = 0; s.train.progress = 0; s.train.speed = 0;
      s.train.stopped = true; s.train.stopReason = 'no_route'; s.train.stopTimer = 0; s.train.stopPressure = 0;
      const lx = hexToWorld(best[0], best[1]).x;
      for (let r = 0; r < s.void.front.length; r++) s.void.front[r] = lx - 520;
      for (const t of s.tiles) { const w = hexToWorld(t.col, t.row); if (w.x < lx - 520) { t.void = true; t.voidAt = s.time; } }
      for (const st of s.settlements) if (st.col < best[0] && !st.visited) { st.consumed = true; st.visited = true; }
      s.region = region;
      if (!s.regionsEntered.includes(region)) s.regionsEntered.push(region);
      s.boss.active = false; s.boss.type = null; s.boss.enemyId = null;
      for (let r = 0; r < region; r++) {
        const bt: EnemyType[] = ['boss_wagon', 'boss_brood'];
        // regions 2+ imply wagon defeated; region 3 implies brood defeated
        if (r >= 1 && !s.boss.defeated.includes(bt[0])) s.boss.defeated.push(bt[0]);
        if (r >= 2 && !s.boss.defeated.includes(bt[1])) s.boss.defeated.push(bt[1]);
      }
      addResource(this.ctx, 'rails', 20 + region * 8); addResource(this.ctx, 'scrap', 30 + region * 10); addResource(this.ctx, 'coal', 40); addResource(this.ctx, 'ammo', 40);
      s.phase = 'running';
      computeTrail(s);
      this.bus.emit('region:enter', { region, name: REGION_NAMES[region] });
      log(s, `[debug] warped to ${REGION_NAMES[region]}`, 'info');
      this.bus.flush();
    },
    spawnWave: (types: string[]) => { spawnWave(this.ctx, types as EnemyType[]); this.bus.flush(); },
    spawnBoss: (type: 'boss_wagon' | 'boss_brood' | 'boss_maw') => {
      const s = this.state;
      if (type === 'boss_maw') {
        // the Maw is stationary at the terminus: bring the train onto its loop if it is far away
        const term = s.settlements.find(st => st.type === 'terminus');
        const ring = s.boss.loopTiles;
        if (term && ring.length) {
          const lp = locoPos(s);
          const tw = hexToWorld(term.col, term.row);
          if (Math.hypot(lp.x - tw.x, lp.y - tw.y) > 400) {
            clearEnemies(this.ctx);
            const start = ring[0];
            s.route.path = [start];
            s.route.builtLinks = []; s.route.sapperCharges = []; s.route.blocked = false;
            s.train.routeIndex = 0; s.train.progress = 0; s.train.speed = 0; s.train.reversing = false;
            s.train.stopped = true; s.train.stopReason = 'no_route'; s.train.stopTimer = 0;
            const lx = hexToWorld(start[0], start[1]).x;
            for (let r = 0; r < s.void.front.length; r++) s.void.front[r] = Math.max(s.void.front[r], lx - 900);
            for (const t of s.tiles) { const w = hexToWorld(t.col, t.row); if (w.x < lx - 900 && !t.void) { t.void = true; t.voidAt = s.time; } }
            s.region = 3;
            if (!s.regionsEntered.includes(3)) s.regionsEntered.push(3);
            for (const bt of ['boss_wagon', 'boss_brood'] as EnemyType[]) if (!s.boss.defeated.includes(bt)) s.boss.defeated.push(bt);
            computeTrail(s);
          }
        }
      }
      spawnBoss(this.ctx, type); this.bus.flush();
    },
    grant: (res: Partial<Record<ResourceKey, number>>) => { for (const k of Object.keys(res) as ResourceKey[]) addResource(this.ctx, k, res[k] ?? 0); this.bus.flush(); },
    addCar: (type: CarType) => { addCar(this.ctx, type); this.bus.flush(); },
    forceVictory: () => { this.state.boss.gateOpen = true; this.state.boss.active = false; this.victory(); this.bus.flush(); },
    forceDefeat: (reason?: string) => {
      const s = this.state;
      if (s.phase === 'victory' || s.phase === 'defeat') return;
      s.phase = 'defeat'; s.defeatReason = reason ?? 'The locomotive was destroyed.'; s.train.stopReason = 'derailed';
      this.checkEnd(); this.bus.flush();
    },
    setTime: (dayTime: number) => { this.state.time = ((dayTime - 0.1 + 1) % 1) * 240 + Math.floor(this.state.time / 240) * 240; updateDayNight(this.ctx); this.bus.flush(); },
    setWeather: (kind: string) => { const w = this.state.weather; w.kind = kind as any; w.next = kind as any; w.timer = 60; w.intensity = 1; this.bus.emit('weather:change', { kind: kind as any }); },
    triggerEvent: (defId?: string) => {
      const s = this.state;
      if (s.phase !== 'running') return;
      if (defId) { s.activeEvent = { defId, startedAt: s.time }; s.phase = 'event'; this.bus.emit('phase:change', { phase: 'event' }); this.bus.emit('event:show', { defId }); return; }
      s.eventCooldown = 0; if (s.train.passengers <= 0) { s.train.passengers = 1; if (s.train.cars[4]) s.train.cars[4].passengers = 1; }
      updateEvents(this.ctx); this.bus.flush();
    },
    invulnerable: (on: boolean) => { this.ctx.invulnerable = on; },
    offerRelics: () => { offerRelics(this.ctx, 'debug'); this.bus.flush(); },
    grantMarks: (n: number) => { addMarks(this.ctx, n, 'debug'); this.bus.flush(); },
    startExpedition: () => { const s = this.state; if (s.phase !== 'running') return; const ids = s.train.crew.filter(c => c.hp > 20).slice(0, 3).map(c => c.id); startExpedition(this.ctx, ids, 'debug site'); this.bus.flush(); },
    godTrain: () => {
      const s = this.state;
      const keep = s.train.cars[0];
      keep.hp = keep.maxHp;
      s.train.cars = [keep];
      for (const type of ['boiler', 'tesla', 'reactor', 'tesla', 'radiator', 'flamethrower', 'boiler', 'cannon', 'flak'] as CarType[]) s.train.cars.push(makeCar(s, type));
      for (const c of s.train.crew) c.carIndex = -1;
      for (const c of s.train.cars) c.crewId = null;
      recomputeCapacity(s);
      for (const k of ['rails', 'scrap', 'coal', 'ammo', 'food'] as ResourceKey[]) s.train.resources[k] = s.train.capacity[k];
      computeTrail(s);
      this.bus.flush();
    },
  };
}

export function createSim(seed: number | string, bus: EventBus): SimApi {
  const n = typeof seed === 'number' ? (seed >>> 0) : hashSeed(seed);
  return new Sim(n, bus);
}

// re-exported for convenience of other modules
export { tileKey, neighbors, isRail, aheadCount, HEX_R };
