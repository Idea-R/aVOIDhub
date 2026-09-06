/**
 * RAILaVOID shared contracts.
 * Everything in SimState is plain JSON-serializable data (no classes, no functions, no Infinity).
 * Units: distance in hex world px (unprojected), time in seconds of sim time, speed in hex/s unless stated.
 */

// ---------- Map ----------
export type Terrain = 'plains' | 'forest' | 'hills' | 'mountain' | 'water' | 'ruins' | 'ash' | 'crystal';

export interface Tile {
  col: number;
  row: number;
  q: number;
  r: number;
  terrain: Terrain;
  region: number;       // 0..3
  elevation: number;    // 0..1 (rendering & hills)
  threat: number;       // 0..1 base attack pressure while train is here
  void: boolean;        // consumed by void
  voidAt: number;       // sim time when consumed (-1 = not yet)
  settlementId: string | null;
  decor: number;        // small deterministic int for rendering variety
}

export type SettlementType =
  | 'start' | 'village' | 'depot' | 'mine' | 'farm' | 'fuel' | 'clinic' | 'armory' | 'yard' | 'terminus'
  | 'watchtower' | 'shrine' | 'wreck' | 'market' | 'site' | 'mystery' | 'crossroads';

export interface ResourceBundle {
  rails?: number;
  scrap?: number;
  coal?: number;
  ammo?: number;
  food?: number;
}

export type ResourceKey = 'rails' | 'scrap' | 'coal' | 'ammo' | 'food';

export type CrewSpecialty = 'engineer' | 'gunner' | 'medic' | 'surveyor' | 'mechanic' | 'quartermaster' | 'conductor';

export interface Settlement {
  id: string;
  name: string;
  type: SettlementType;
  col: number;
  row: number;
  region: number;
  offers: ResourceBundle;   // collected on first arrival
  passengers: number;       // waiting to board
  crew: CrewSpecialty | null;
  deadline: number;         // sim seconds at which the void takes it (estimate; actual is void front)
  visited: boolean;         // train arrived
  consumed: boolean;        // eaten by void before rescue
  rescued: boolean;         // passengers boarded
}

// ---------- Train ----------
export type LocoUpgradeKind = 'speed' | 'power' | 'frame' | 'crew';
export type LocoUpgrades = Record<LocoUpgradeKind, number>;

export type CarType =
  | 'locomotive' | 'coal_bunker' | 'boiler' | 'reactor' | 'radiator'
  | 'fabricator' | 'foundry' | 'cargo' | 'armored_cargo'
  | 'gatling' | 'cannon' | 'flak' | 'tesla' | 'flamethrower'
  | 'barracks' | 'medical' | 'scout' | 'coach' | 'sleeper'
  | 'rail_layer' | 'armor_plate' | 'signal' | 'caboose';

export type WeaponKind = 'gatling' | 'cannon' | 'flak' | 'tesla' | 'flame' | 'marines';

export type DamageClass = 'bullet' | 'shell' | 'energy' | 'fire' | 'melee';

export interface WeaponDef {
  kind: WeaponKind;
  damageClass: DamageClass;
  range: number;         // world px
  damage: number;        // per shot
  cooldown: number;      // seconds between shots at full power
  hitsGround: boolean;
  hitsAir: boolean;
  hitsPhase: boolean;    // void wisps
  ammoPerShot: number;   // 0 = no ammo needed
  aoe: number;           // radius px (0 = single target)
  chain: number;         // tesla chain count
  projectileSpeed: number; // px/s, 0 = hitscan
  heatPerShot: number;
}

export interface CarDef {
  type: CarType;
  name: string;
  short: string;         // 3-4 letter code for diagram labels
  desc: string;
  tier: 1 | 2 | 3;
  cost: number;          // scrap at yards
  hp: number;
  weight: number;        // tons (abstract)
  powerGen: number;
  powerUse: number;
  heatGen: number;       // per second while active
  cooling: number;       // per second self cooling (radiator etc.)
  storage: ResourceBundle; // capacity added
  passengerCap: number;
  ammoSupplier: boolean;
  weapon: WeaponDef | null;
  planRangeBonus: number;
  trackCostBonus: number;   // negative reduces cost
  blocksBoarders: boolean;
  color: number;            // diagram accent
}

export interface Crew {
  id: string;
  name: string;
  specialty: CrewSpecialty;
  carIndex: number;   // -1 = unassigned (rides in loco)
  hp: number;         // 0..100
}

export interface Car {
  id: string;
  type: CarType;
  hp: number;
  maxHp: number;
  heat: number;             // 0..120
  onFire: boolean;
  boarders: string[];       // enemy ids currently inside this car
  crewId: string | null;
  cooldown: number;         // weapon cooldown remaining
  workTimer: number;        // fabricator/foundry cycle
  passengers: number;       // riding in this car
  disabled: boolean;        // temporarily disabled (e.g. drone sap)
  disabledFor: number;
  level: number;            // 1..3 upgrade level (yards)
  derived: CarDerived;      // recomputed every tick, safe to read from UI
}

export interface CarDerived {
  powerRatio: number;       // 0..1 how much of powerUse is satisfied
  hasAmmoSupply: boolean;
  activity: number;         // 0..1 used for heat generation
  targetEnemyId: string | null;
  heatFlowIn: number;       // net heat flow from neighbours (for UI arrows)
  marinesEngaged: boolean;
}

export interface TrainState {
  cars: Car[];                // index 0 = locomotive
  routeIndex: number;         // index into route.path of the tile the loco is leaving/on
  progress: number;           // 0..1 along edge routeIndex -> routeIndex+1
  speed: number;              // hex/s current
  speedTarget: number;        // hex/s computed
  moving: boolean;
  stopped: boolean;           // at settlement / no route
  stopReason: 'none' | 'no_route' | 'settlement' | 'junction' | 'boss' | 'derailed';
  stopTimer: number;          // seconds stopped (stop pressure)
  stopPressure: number;       // 0..1
  reversing: boolean;         // backing down the traversed track
  locoUpgrades: LocoUpgrades; // engine upgrade tracks bought at yards (0..3 each)
  relics: string[];           // relic ids owned this run
  marks: number;              // Void Marks (rare currency)
  watchUntil: number;         // sim time until which watchtower early warning is active
  hounds: number;             // hound bite stacks (slow)
  resources: Record<ResourceKey, number>;
  capacity: Record<ResourceKey, number>;
  passengers: number;         // total riding
  passengerCap: number;
  passengersDelivered: number;
  morale: number;             // 0..100
  crew: Crew[];
  trailX: number[];           // world px positions of each car (unprojected), computed by sim
  trailY: number[];
  trailAngle: number[];       // radians
  burningScrap: boolean;      // out-of-coal fallback engaged
  distanceTravelled: number;  // hexes
  totalWeight: number;
  totalPowerGen: number;
  totalPowerUse: number;
}

// ---------- Route ----------
export interface RouteState {
  path: Array<[number, number]>;   // [col,row] tiles from start to planned end; index <= routeIndex are behind
  builtLinks: string[];            // edge keys "c1,r1|c2,r2" laid by the player
  railLinks: string[];             // pre-laid rail edges
  /** Pre-laid edge key -> line id (0 Central, 1 Northern, 2 Southern, 3 crossover/branch). */
  railLines: Record<string, number>;
  planRange: number;               // hexes ahead allowed
  blocked: boolean;                // next tile void/impassable
  sapperCharges: Array<{ col: number; row: number; revealed: boolean; timer: number; id: string }>;
}

// ---------- Enemies ----------
export type EnemyType = 'raider' | 'hound' | 'crawler' | 'harpy' | 'sapper' | 'wisp'
  | 'boss_wagon' | 'boss_brood' | 'boss_maw';

export type EnemyLayer = 'ground' | 'air' | 'phase';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  layer: EnemyLayer;
  hp: number;
  speed: number;          // px/s
  damage: number;         // per attack
  attackCooldown: number;
  range: number;          // px, attack reach
  boards: boolean;
  armor: number;          // 0..1 flat reduction vs bullets
  resist: Partial<Record<DamageClass, number>>; // multiplier per damage class (default 1)
  radius: number;         // px
  threatCost: number;     // director budget
  color: number;
  xp: number;             // score
}

export type EnemyState = 'spawn' | 'approach' | 'attack' | 'boarding' | 'boarded' | 'planting' | 'fleeing' | 'dead';

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  state: EnemyState;
  targetCar: number;      // car index it is attacking / heading to
  boardedCar: number;     // -1 if not boarded
  timer: number;          // generic state timer
  attackTimer: number;
  revealed: boolean;      // for sappers
  phase: number;          // bosses
  burning: number;        // seconds of burn left
  stunned: number;
  angle: number;
  spawnT: number;
  lastHitBy: DamageClass | null;
  extra: Record<string, number>; // per-type scratch (json safe)
}

export interface Projectile {
  id: string;
  kind: 'shell' | 'flak' | 'tracer' | 'bolt' | 'flame' | 'enemy_shell';
  x: number; y: number;
  tx: number; ty: number;
  speed: number;
  damage: number;
  damageClass: DamageClass;
  aoe: number;
  targetId: string | null;
  fromCar: number;
  life: number;
  hitsAir: boolean;
}

// ---------- Campaign / world ----------
export type WeatherKind = 'clear' | 'rain' | 'fog' | 'storm' | 'ashfall';

export interface WeatherState {
  kind: WeatherKind;
  next: WeatherKind;
  timer: number;        // seconds until change
  intensity: number;    // 0..1 ramps in/out
  lightningTimer: number;
}

export interface VoidState {
  front: number[];      // per row: world px x of the void edge (unprojected)
  speed: number;        // px/s base advance
  rifts: Array<{ col: number; row: number; radius: number; openAt: number; id: string; opened: boolean }>;
}

export interface BossState {
  active: boolean;
  type: EnemyType | null;
  enemyId: string | null;
  phase: number;
  timer: number;
  defeated: EnemyType[];
  loopTiles: Array<[number, number]>; // Void Maw loop
  gateOpen: boolean;
}

export interface PassengerEventOption {
  label: string;
  desc: string;
  requires?: { car?: CarType; resource?: ResourceKey; amount?: number; marks?: number; crew?: CrewSpecialty; relic?: string; fitCrew?: boolean };
}

export interface PassengerEventDef {
  id: string;
  title: string;
  text: string;
  options: PassengerEventOption[];
  negative: boolean;
}

export interface ActiveEvent {
  defId: string;
  startedAt: number;
  locationId?: string;
  preparingExpedition?: boolean;
  arrival?: { passengers: number; crewName?: string };
  dialogue?: {
    step: 'arrival' | 'briefing' | 'receipt';
    approach?: 'help' | 'mechanic' | 'kit';
    receipt?: string;
  };
}

export interface WaveDirectorState {
  budget: number;
  nextWaveIn: number;
  waveCount: number;
  killsByClass: Record<DamageClass, number>;
  lastWaveTypes: EnemyType[];
  warning: { type: EnemyType; from: 'west' | 'north' | 'south' | 'east'; in: number } | null;
}

export type RunPhase = 'title' | 'running' | 'paused' | 'event' | 'shop' | 'relic' | 'expedition' | 'victory' | 'defeat';

// ---------- Loot / bounties / expeditions ----------
export interface LootDrop { id: string; x: number; y: number; kind: 'scrap' | 'ammo' | 'rails' | 'marks'; amount: number; ttl: number }

export interface Bounty {
  id: string;
  kind: 'kill' | 'deliver' | 'reach';
  fromId: string;
  fromName: string;
  status: 'active' | 'done' | 'failed';
  target: string;          // enemy type, settlement id or 'yard'
  targetName: string;
  count: number;
  progress: number;
  expiresAt: number;
  reward: { marks: number; rails: number; scrap: number };
  title: string;
  desc: string;
}

export type ExpeditionTiming = 'perfect' | 'good' | 'miss';
export type ExpeditionActionKind = 'strike' | 'guard' | 'special' | 'swap' | 'flee';
export type ExpeditionPosition = 'front' | 'middle' | 'rear';
export type ExpeditionStageKey = 'ruin_approach' | 'buried_concourse' | 'void_sanctum';
export interface ExpeditionActor { id: string; name: string; specialty: CrewSpecialty; hp: number; maxHp: number; guard: number; down: boolean; position: ExpeditionPosition }
export interface ExpeditionFoe { id: string; kind: string; name: string; hp: number; maxHp: number; atk: number; speed: number; stunned: number; desc: string; range: 'melee' | 'ranged' }
export interface ExpeditionState {
  siteId: string;
  /** Return to the original location decision after withdrawal; serialized with the fight. */
  returnEvent?: ActiveEvent;
  summary?: string;
  round: number;
  rounds: number;
  stage: number;
  stageCount: number;
  stageKey: ExpeditionStageKey;
  awaitingAdvance: boolean;
  turn: 'player' | 'enemy';
  activeActor: number;
  activeFoe: number;
  actors: ExpeditionActor[];
  foes: ExpeditionFoe[];
  rally: number;
  pending: { kind: ExpeditionActionKind; actorIndex: number; foeIndex: number; swapActorIndex?: number } | null;
  foeSwingsLeft?: number;
  log: string[];
  outcome: 'won' | 'lost' | 'fled' | null;
  rewardRelic: boolean;
}

export interface Stats {
  kills: Record<string, number>;
  settlementsRescued: number;
  settlementsLost: number;
  carsLost: number;
  railsLaid: number;
  damageTaken: number;
  damageDealt: number;
  bossesDefeated: number;
  eventsResolved: number;
  score: number;
  relicsTaken?: number;
  lootCollected?: number;
  bountiesDone?: number;
  expeditionsWon?: number;
}

export interface SimState {
  version: number;
  seed: number;
  time: number;               // sim seconds
  tick: number;
  phase: RunPhase;
  speedMul: 0 | 1 | 2 | 4;
  mapW: number;
  mapH: number;
  tiles: Tile[];              // row-major: index = row*mapW + col
  settlements: Settlement[];
  train: TrainState;
  route: RouteState;
  enemies: Enemy[];
  projectiles: Projectile[];
  weather: WeatherState;
  dayTime: number;            // 0..1 (0=dawn, .25=noon, .5=dusk, .75=midnight)
  isNight: boolean;
  void: VoidState;
  boss: BossState;
  director: WaveDirectorState;
  activeEvent: ActiveEvent | null;
  eventCooldown: number;
  loot: LootDrop[];
  bounties: Bounty[];
  pendingRelicChoice: { options: string[]; source: string } | null;
  phaseBeforeRelic: RunPhase | null;
  pendingEliteRelic: number;
  expedition: ExpeditionState | null;
  phaseBeforeExpedition: RunPhase | null;
  usedEvents: string[];
  /** Small run-scoped story memory, absent in older saves. Not account progression. */
  storyFlags?: string[];
  region: number;             // current region of loco
  regionsEntered: number[];
  stats: Stats;
  defeatReason: string | null;
  nextId: number;
  tutorialStep: number;
  log: Array<{ t: number; text: string; kind: 'info' | 'warn' | 'good' | 'bad' }>;
  rngState: { world: number; waves: number; events: number; combat: number };
}

// ---------- Settings / persistence ----------
export interface Settings {
  masterVolume: number;   // 0..1
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number; // engine, weather and void beds
  uiVolume: number;       // interface clicks and notifications
  muted: boolean;
  reducedMotion: boolean;
  screenShake: boolean;
  highContrast: boolean;
  largeText: boolean;
  /** Overall HUD chrome footprint. Text accessibility remains independently controllable. */
  uiScale: number;          // 0.75..1.1
  colorblind: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  quality: 'auto' | 'high' | 'medium' | 'low';
  showTutorial: boolean;
  autoFollowRail: boolean;
  showSeedField: boolean;
  showLog: boolean;        // event log feed visible in the HUD
  compactHud: boolean;     // slimmer HUD chrome
  customCursor: boolean;
}

export interface MetaProgress {
  runs: number;
  victories: number;
  bestScore: number;
  bestRegion: number;
  totalKills: number;
  lastSeed: number;
  unlockedNotes: string[];
  introSeen?: boolean;
}

export interface SaveGame {
  version: number;
  savedAt: number;
  state: SimState;
}
