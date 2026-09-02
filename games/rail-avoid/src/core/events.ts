/** Typed event bus shared by sim, render, ui and audio. */
import type { CarType, DamageClass, EnemyType, WeaponKind, WeatherKind, ResourceKey, SettlementType, CrewSpecialty } from './types';

export interface GameEvents {
  'run:start': { seed: number };
  'run:victory': { score: number };
  'run:defeat': { reason: string; score: number };
  'run:loaded': { seed: number };
  'phase:change': { phase: string };

  'train:damage': { carIndex: number; amount: number; source: DamageClass | 'void' | 'heat' | 'fire' | 'boarder' | 'ram' | 'sapper' | 'lightning'; x: number; y: number };
  'train:stop': { reason: string };
  'train:start': {};
  'train:detach': { count: number; x: number; y: number };
  'train:split': { atIndex: number; lost: number };
  'car:destroyed': { carIndex: number; type: CarType; x: number; y: number; explode: boolean };
  'car:fire': { carIndex: number; on: boolean };
  'car:overheat': { carIndex: number };
  'car:bought': { type: CarType };
  'car:sold': { type: CarType };
  'car:moved': { from: number; to: number };
  'car:repaired': { carIndex: number };
  'car:upgraded': { carIndex: number; level: number };
  'loco:upgraded': { kind: 'speed' | 'power' | 'frame' | 'crew'; level: number };
  'crew:assigned': { crewId: string; carIndex: number };
  'crew:joined': { specialty: CrewSpecialty; name: string };

  'weapon:fire': { carIndex: number; kind: WeaponKind; x: number; y: number; tx: number; ty: number; targetId: string | null };
  'tesla:chain': { points: Array<[number, number]> };
  'projectile:explode': { x: number; y: number; radius: number; kind: string };
  'enemy:spawn': { id: string; type: EnemyType; x: number; y: number };
  'enemy:hit': { id: string; type: EnemyType; x: number; y: number; amount: number; damageClass: DamageClass; immune: boolean };
  'enemy:died': { id: string; type: EnemyType; x: number; y: number; killedBy: DamageClass | null };
  'enemy:boarded': { id: string; type: EnemyType; carIndex: number };
  'enemy:walk': { id: string; from: number; to: number };
  'enemy:ram': { id: string; carIndex: number; x: number; y: number };
  'sapper:planted': { id: string; col: number; row: number };
  'sapper:detonate': { col: number; row: number; x: number; y: number; damage: number };
  'sapper:defused': { col: number; row: number };
  'wave:warning': { type: EnemyType; from: string; in: number };
  'wave:spawn': { count: number; types: EnemyType[] };
  'boss:spawn': { type: EnemyType; name: string };
  'boss:phase': { type: EnemyType; phase: number };
  'boss:died': { type: EnemyType };
  'gate:open': {};

  'track:planned': { col: number; row: number; cost: number };
  'track:unplanned': { col: number; row: number; refund: number };
  'track:blocked': { reason: string };
  'track:autofollow': { col: number; row: number };
  'settlement:reached': { id: string; name: string; type: SettlementType; rewards: Partial<Record<ResourceKey, number>>; passengers: number; crew: CrewSpecialty | null };
  'settlement:consumed': { id: string; name: string; hadPassengers: number };
  'settlement:depart': { id: string };
  'resource:change': { key: ResourceKey; delta: number; x?: number; y?: number };
  'resource:full': { key: ResourceKey };
  'resource:empty': { key: ResourceKey };
  'passengers:board': { count: number };
  'passengers:delivered': { count: number; reward: Partial<Record<ResourceKey, number>> };
  'passengers:lost': { count: number; cause: string };
  'void:advance': { x: number };
  'void:consume': { col: number; row: number };
  'rift:open': { col: number; row: number; x: number; y: number };
  'weather:change': { kind: WeatherKind };
  'lightning': { carIndex: number; x: number; y: number };
  'day:phase': { night: boolean };
  'region:enter': { region: number; name: string };
  'event:show': { defId: string };
  'event:resolved': { defId: string; option: number; summary: string };
  'tutorial:step': { step: number; text: string };
  'ui:notify': { text: string; kind: 'info' | 'warn' | 'good' | 'bad' };
  'ui:shake': { power: number };
  'ui:flash': { color: number; alpha: number };
  'ui:selectCar': { index: number };
  'ui:hoverTile': { col: number; row: number; cost: number; free: boolean; plannable: boolean } | { col: -1; row: -1; cost: 0; free: false; plannable: false };
  'ui:selectSettlement': { id: string | null };
  /** Pointer hovers a settlement marker (screen px); id null when leaving. */
  'ui:hoverSettlement': { id: string | null; x: number; y: number };
  /** Pointer hovers a train car in the world (screen px); index -1 when leaving. */
  'ui:hoverCar': { index: number; x: number; y: number };
  'ui:openPanel': { panel: 'train' | 'shop' | 'settings' | 'pause' | 'none' };
  // loot / relics / bounties / expeditions
  'loot:drop': { id: string; kind: 'scrap' | 'ammo' | 'rails' | 'marks'; amount: number; x: number; y: number };
  'loot:pickup': { id: string; kind: 'scrap' | 'ammo' | 'rails' | 'marks'; amount: number; x: number; y: number };
  'loot:expire': { id: string };
  'marks:change': { delta: number; total: number; why: string };
  'relic:offer': { options: string[]; source: string };
  'relic:taken': { id: string };
  'bounty:new': { id: string; title: string };
  'bounty:progress': { id: string; progress: number; count: number };
  'bounty:done': { id: string; title: string; reward: { marks: number; rails: number; scrap: number } };
  'bounty:failed': { id: string; title: string };
  'expedition:start': { siteId: string; crew: string[]; foes: string[] };
  'expedition:pending': { kind: string; actor: string; foe: string; turn: 'player' | 'enemy' };
  'expedition:hit': { target: 'foe' | 'actor' | 'heal'; name: string; amount: number; timing: 'perfect' | 'good' | 'miss' };
  'expedition:round': { round: number };
  'expedition:end': { outcome: 'won' | 'lost' | 'fled'; summary: string; rounds: number };
  'enemy:elite': { id: string; type: EnemyType };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers: { [K in keyof GameEvents]?: Array<Handler<GameEvents[K]>> } = {};
  private queue: Array<{ name: keyof GameEvents; payload: unknown }> = [];
  public muted = false;

  on<K extends keyof GameEvents>(name: K, h: Handler<GameEvents[K]>): () => void {
    (this.handlers[name] ||= [] as any).push(h as any);
    return () => this.off(name, h);
  }
  off<K extends keyof GameEvents>(name: K, h: Handler<GameEvents[K]>): void {
    const list = this.handlers[name] as Array<Handler<GameEvents[K]>> | undefined;
    if (!list) return;
    const i = list.indexOf(h);
    if (i >= 0) list.splice(i, 1);
  }
  emit<K extends keyof GameEvents>(name: K, payload: GameEvents[K]): void {
    if (this.muted) return;
    const list = this.handlers[name] as Array<Handler<GameEvents[K]>> | undefined;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { console.error('[events]', name, e); }
    }
  }
  /** Defer until flush() (used by sim so render handlers run after a full tick). */
  defer<K extends keyof GameEvents>(name: K, payload: GameEvents[K]): void {
    this.queue.push({ name, payload });
  }
  flush(): void {
    const q = this.queue; this.queue = [];
    for (const e of q) this.emit(e.name, e.payload as any);
  }
  clear(): void { this.handlers = {}; this.queue = []; }
}

export const bus = new EventBus();
