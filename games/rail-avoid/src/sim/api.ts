/**
 * The command surface the UI / input / debug layers use to talk to the simulation.
 * Presentation reads `state` directly (read-only!) and subscribes to `bus` for effects.
 */
import type { SimState, CarType, Tile, Settlement, CarDef, EnemyDef, ResourceKey, LocoUpgradeKind, ExpeditionActionKind, ExpeditionTiming } from '../core/types';
import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';

export interface PlanResult { ok: boolean; reason?: string; cost?: number; }

export interface SimApi {
  readonly state: SimState;
  readonly bus: EventBus;

  /** Advance the simulation by real seconds (internally fixed-stepped, multiplied by state.speedMul). */
  update(realDt: number): void;

  // --- flow ---
  setSpeed(mul: 0 | 1 | 2 | 4): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;

  // --- route ---
  /** Cost preview for appending a tile to the plan. */
  previewPlan(col: number, row: number): PlanResult;
  planTile(col: number, row: number): PlanResult;
  /** Remove last planned tile (only if the train has not reached it). Refunds rails. */
  unplanLast(): PlanResult;
  /** Clears all unreached planned tiles. */
  clearPlan(): void;
  /** Tiles that may be appended right now (adjacent to plan end, in range, not void). */
  plannableTiles(): Array<{ col: number; row: number; cost: number; free: boolean }>;
  /** Auto-plan toward a target tile with an A* over cost (used by autopilot & double-click). */
  planPathTo(col: number, row: number): PlanResult;
  /** Branch options at the current plan end (rail continuations), with line id and the next settlement along each. */
  junctionOptions(): Array<{ col: number; row: number; line: number; lineName: string; next: { id: string; name: string; type: string; distance: number } | null }>;

  // --- train ---
  depart(): void;                          // leave a settlement early
  /** Back the train down its own track (discards the plan ahead). reverse(false) stops and re-anchors planning. */
  reverse(on: boolean): void;
  isReversing(): boolean;
  detachFrom(carIndex: number): boolean;   // drops carIndex..end (carIndex >= 1)
  moveCar(from: number, to: number): boolean;  // reorder (not the locomotive)
  buyCar(type: CarType, insertAt?: number): boolean;  // only while phase==='shop'
  sellCar(carIndex: number): boolean;
  repairCar(carIndex: number): boolean;    // costs scrap at yards
  repairAll(): boolean;
  /** Car upgrade levels (1..3) and locomotive upgrade tracks (0..3); yards only. Cost in scrap, -1 when maxed. */
  upgradeCar(carIndex: number): boolean;
  upgradeCost(carIndex: number): number;
  upgradeLoco(kind: LocoUpgradeKind): boolean;
  locoUpgradeCost(kind: LocoUpgradeKind): number;
  assignCrew(crewId: string, carIndex: number): boolean;
  closeShop(): void;                       // leaves the yard (resumes running)
  canShop(): boolean;

  // --- events ---
  chooseEventOption(index: number): boolean;
  /** Relic 1-of-3 choice while phase === 'relic'. */
  chooseRelic(index: number): boolean;
  // --- expeditions (phase === 'expedition') ---
  /** Send crew from an Expedition Site event (option 0 of 'node_site'). */
  startExpedition(crewIds: string[]): boolean;
  expeditionAction(kind: ExpeditionActionKind, targetFoe?: number): boolean;
  /** Report the player's timing for the pending action/blow. */
  expeditionResolve(timing: ExpeditionTiming): boolean;
  /** Dismiss the result screen and resume the run. */
  endExpedition(): boolean;

  // --- queries ---
  tileAt(col: number, row: number): Tile | null;
  settlementById(id: string): Settlement | null;
  carDef(type: CarType): CarDef;
  enemyDef(type: string): EnemyDef;
  currentPlanRange(): number;
  trackCostAt(col: number, row: number): number;
  resourceCap(key: ResourceKey): number;
  /** World px (unprojected) of the locomotive. */
  locoPos(): { x: number; y: number };
  /** Distance in px between the loco and the void front on its row. */
  voidDistance(): number;

  // --- persistence ---
  serialize(): string;
  restore(json: string): boolean;

  // --- debug / verification (also used by the autopilot) ---
  debug: {
    warpToRegion(region: number): void;
    spawnWave(types: string[]): void;
    spawnBoss(type: 'boss_wagon' | 'boss_brood' | 'boss_maw'): void;
    grant(res: Partial<Record<ResourceKey, number>>): void;
    addCar(type: CarType): void;
    forceVictory(): void;
    forceDefeat(reason?: string): void;
    setTime(dayTime: number): void;
    setWeather(kind: string): void;
    triggerEvent(defId?: string): void;
    invulnerable(on: boolean): void;
    offerRelics(): void;
    grantMarks(n: number): void;
    startExpedition(): void;
    godTrain(): void;   // strong composition for testing
  };
}

export interface SimContext {
  state: SimState;
  bus: EventBus;
  rng: { world: Rng; waves: Rng; events: Rng; combat: Rng };
  dt: number;
  invulnerable: boolean;
}
