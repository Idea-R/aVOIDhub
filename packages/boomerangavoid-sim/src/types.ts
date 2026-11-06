// Canonical cross-workspace contract. Gameplay coordinates use x/y; the renderer maps y to world Z.
export const TICK_RATE = 60;
export const RULESET = 'boomerangavoid-v1-rc.5';
export const CONTENT_VERSION = 'garden-3';
export type Mode = 'ffa' | 'teams' | 'relay';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type CharacterId = 'pip' | 'kiln' | 'volt' | 'nori' | 'cairn' | 'comet';
export type UpgradeId =
  | 'guard'
  | 'twin'
  | 'skipstone'
  | 'tailwind'
  | 'frost'
  | 'ember'
  | 'echo'
  | 'magnet';
export interface Vec {
  x: number;
  y: number;
}
export interface Input {
  mx: number;
  my: number;
  ax: number;
  ay: number;
  dash: boolean;
  slash: boolean;
  throw: boolean;
}
export const NEUTRAL: Readonly<Input> = Object.freeze({
  mx: 0,
  my: 0,
  ax: 0,
  ay: 0,
  dash: false,
  slash: false,
  throw: false,
});
export interface Seat {
  id: string;
  name: string;
  character: CharacterId;
  color: number;
  team: number;
  bot: Difficulty | null;
}
export interface Player extends Seat, Vec {
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  alive: boolean;
  score: number;
  kills: number;
  dashUntil: number;
  dashCooldown: number;
  slashUntil: number;
  slashStart: number;
  slashCooldown: number;
  throwAt: number;
  stunUntil: number;
  shieldGraceUntil: number;
  respawnAt: number;
  protectedUntil: number;
  shield: boolean;
  upgrades: UpgradeId[];
}
export type WeaponPhase =
  | 'held'
  | 'windup'
  | 'outbound'
  | 'returning'
  | 'grounded'
  | 'rematerializing'
  | 'inert';
export interface Weapon extends Vec {
  id: string;
  ownerId: string;
  attackerId: string;
  generation: number;
  phase: WeaponPhase;
  vx: number;
  vy: number;
  heading: number;
  launchHeading: number;
  phaseTick: number;
  traveled: number;
  ricochets: number;
  harmless: boolean;
}
export interface Obstacle extends Vec {
  id: string;
  w: number;
  h: number;
  height: number;
  kind: 'stone' | 'hedge' | 'kiln' | 'pillar' | 'shutter';
}
export interface Hazard extends Vec {
  id: string;
  w: number;
  h: number;
  kind: 'vent' | 'gap' | 'wind' | 'gate' | 'conveyor' | 'shutter';
  angle: number;
  period: number;
  active: number;
  offset: number;
  pair?: string;
}
export interface Arena {
  id: string;
  name: string;
  subtitle: string;
  color: number;
  ground: number;
  sky: number;
  width: number;
  height: number;
  spawns: Vec[];
  obstacles: Obstacle[];
  hazards: Hazard[];
  platforms?: MovingPlatform[];
  switches?: ArenaSwitch[];
  targets: Vec[];
}
/** A floor (not a wall), moving from x/y to `to` and back once per period. */
export interface MovingPlatform extends Vec {
  id: string;
  w: number;
  h: number;
  to: Vec;
  period: number;
  offset: number;
}
/** Pressure plate opens its target shutter while occupied and for duration ticks after release. */
export interface ArenaSwitch extends Vec {
  id: string;
  w: number;
  h: number;
  target: string;
  duration: number;
}
export interface Pickup extends Vec {
  id: string;
  upgrade: UpgradeId;
  spawnTick: number;
}
export interface Effect extends Vec {
  id: string;
  kind: 'frost' | 'ember' | 'echo';
  ownerId: string;
  start: number;
  end: number;
  radius: number;
  triggered: boolean;
}
export interface GameEvent extends Vec {
  id: string;
  tick: number;
  type: string;
  actor?: string;
  target?: string;
  weaponId?: string;
  detail?: string;
}
export interface MatchConfig {
  mode: Mode;
  wins: number;
  mapId: string;
  seed: number;
  friendlyFire: boolean;
  upgrades: boolean;
  /** Local studio only. Online admission must continue to use canonical arenas and rules. */
  arenaDraft?: Arena;
  enabledUpgrades?: UpgradeId[];
  stageIds?: string[];
}
export interface Relay {
  carrierId: string | null;
  x: number;
  y: number;
  target: number;
  progress: number;
  lockUntil: number;
  previousCarrier: string | null;
  previousLockUntil: number;
  scores: number[];
  endTick: number;
}
export interface MatchState {
  version: string;
  tick: number;
  round: number;
  phase: 'countdown' | 'playing' | 'roundResults' | 'matchResults';
  phaseUntil: number;
  config: MatchConfig;
  rng: number;
  nextId: number;
  players: Player[];
  weapons: Weapon[];
  pickups: Pickup[];
  effects: Effect[];
  events: GameEvent[];
  roundStart: number;
  winnerIds: string[];
  matchWinnerIds: string[];
  relay: Relay;
  /** Shutter ID -> tick at which its pressure-plate override expires. Serialized for replay. */
  switches?: Record<string, number>;
  /** Serialized controls/bot memory: cloning a state must preserve action edges and perception delays. */
  internal?: import('./index.js').SimulationInternal;
}
