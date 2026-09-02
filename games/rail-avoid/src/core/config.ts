/** Balance & tuning. All time in seconds, distances in world px (unprojected). */
import type { Terrain, WeatherKind, ResourceKey } from './types';

export const HEX_R = 34;                 // circumradius px
export const HEX_W = HEX_R * 2;
export const HEX_H = Math.sqrt(3) * HEX_R;
export const ISO_Y = 0.62;               // vertical squash for isometric look
export const MAP_W = 160;
export const MAP_H = 36;
export const REGION_W = 40;
export const REGIONS = 4;

export const SIM_DT = 0.05;              // fixed step
export const TEST_SEED = 12345;
export const SAVE_VERSION = 1;

export const MAX_CARS = 10;              // including locomotive

export const TRACK_COST: Record<Terrain, number> = {
  plains: 1, forest: 2, ruins: 1, ash: 2, hills: 2, crystal: 2, water: 3, mountain: 999,
};
export const TERRAIN_SPEED: Record<Terrain, number> = {
  plains: 1, forest: 0.9, ruins: 0.95, ash: 0.9, hills: 0.78, crystal: 0.85, water: 0.9, mountain: 0.5,
};

export const TRAIN = {
  baseSpeed: 0.38,          // hex/s at power/weight ratio 1 (~2.6 s per hex)
  minSpeedFactor: 0.45,
  maxSpeedFactor: 1.3,
  weightPerPower: 16,       // tons that 1 power hauls at factor 1
  coalPerHex: 0.4,
  coalPerTonPerHex: 0.004,
  scrapBurnRatio: 2,        // scrap per coal when burning scrap
  basePlanRange: 8,
  reverseSpeedMul: 0.5,     // without a caboose
  baseCapacity: { rails: 60, scrap: 60, coal: 60, ammo: 100, food: 40 } as Record<ResourceKey, number>,
  startResources: { rails: 30, scrap: 30, coal: 50, ammo: 90, food: 24 } as Record<ResourceKey, number>,
  powerRange: 3,
  ammoRange: 2,
  heatDiffusion: 0.15,
  heatDamageAt: 80,
  heatFireAt: 100,
  heatDamage: 2,
  fireDamage: 5,
  fireSpreadHeat: 12,       // heat/s pushed into neighbours by a burning car
  baseCooling: 1.0,
  unpoweredFireRate: 0.4,
  boarderWalkTime: 4,
  boarderDamage: 1.8,        // per second per boarder
  marineDps: 9,
  flameBoarderDps: 30,
  passengerFoodPerMin: 0.08,
  houndSlowPerStack: 0.08,
  houndDecay: 0.1,           // stacks per second
  stopPressureRate: 1 / 45,  // reaches 1 after 45s stopped
  stopPressureDecay: 1 / 15,
  settlementStopTime: 12,
  autoDepart: true,
  splitOnDestroy: true,
  detachLureTime: 20,
  crewHeal: 2,
  mechanicRepair: 1,
};

export const VOID = {
  baseSpeed: 4.6,           // px/s eastward (train at 0.22 hex/s is about 13 px/s along track, less in x on detours)
  regionSpeedMul: [1, 1.12, 1.25, 1.4],
  noiseAmp: 80,
  catchUpBoost: 1.6,        // when very far behind train, speeds up (keeps pressure honest)
  catchUpDistance: 900,
  slowNearDistance: 200,    // when very close to loco, slows (grace)
  slowNearMul: 0.5,
  riftGrowth: 22,           // px/s radius
};

export const DAY = {
  cycleSeconds: 240,
  nightStart: 0.55,
  nightEnd: 0.95,
  nightAggression: 1.3,
};

export const WEATHER: Record<WeatherKind, { minDur: number; maxDur: number; speedMul: number; rangeMul: number; cooling: number; regions: number[] }> = {
  clear:   { minDur: 60, maxDur: 120, speedMul: 1,    rangeMul: 1,   cooling: 0,   regions: [0, 1, 2, 3] },
  rain:    { minDur: 40, maxDur: 80,  speedMul: 0.9,  rangeMul: 0.9, cooling: 2,   regions: [0, 1, 2] },
  fog:     { minDur: 35, maxDur: 70,  speedMul: 0.95, rangeMul: 0.7, cooling: 0.5, regions: [0, 1, 3] },
  storm:   { minDur: 30, maxDur: 60,  speedMul: 0.8,  rangeMul: 0.85, cooling: 3,  regions: [1, 2, 3] },
  ashfall: { minDur: 40, maxDur: 80,  speedMul: 0.9,  rangeMul: 0.8, cooling: -1,  regions: [2, 3] },
};

export const DIRECTOR = {
  baseInterval: [38, 34, 30, 27],      // seconds between waves per region
  budgetPerWave: [10, 19, 30, 42],
  havenMilitiaDps: 14,                 // settlement defenders while the train is stopped there
  havenRadius: 330,
  budgetGrowthPerMin: [1.2, 1.8, 2.4, 3.2],
  threatMul: 1.6,                      // multiplied by tile threat
  stopPressureMul: 1.8,
  adaptiveBias: 0.55,
  warningLead: 6,
  maxEnemies: 60,
  spawnDistance: 520,
};

export const EVENTS = {
  interval: 85,
  firstAfter: 70,
  variance: 25,
};

export const SCORE = {
  settlement: 250,
  passenger: 30,
  carIntact: 120,
  boss: 800,
  kill: 5,
  timeBonusPerSecondUnder: 2, // under 30 minutes
  victory: 3000,
};

export const UPGRADES = {
  carCostMul: [0, 0.7, 1.1],       // × CarDef.cost for level 2, 3
  carHpMul: 0.25,                  // +25% max HP per level above 1
  carDamageMul: 0.2,
  carStorageMul: 0.2,
  carPowerAdd: 1,
  carCoolingAdd: 2,
  coachPaxAdd: 4,
  locoCost: { speed: [30, 45, 65], power: [28, 42, 60], frame: [24, 36, 52], crew: [26, 40, 58] },
  locoSpeedPerLevel: 0.12,
  locoPowerPerLevel: 2,
  locoHpPerLevel: 60,
  locoRangePerLevel: 1,
  watchtowerSeconds: 300,
};

export const LOOT = {
  dropChance: 0.35,
  ttl: 28,
  pickupRadius: 70,
  maxDrops: 40,
  eliteMarks: [2, 4],
  bossMarks: 8,
  eliteChancePerWave: [0, 0.45, 0.6, 0.7],
  eliteHpMul: 1.6,
};

export const BOUNTY = {
  maxActive: 2,
  postChance: 0.6,
  killCount: [6, 10],
  killSeconds: 180,
  reachSeconds: 240,
  deliverCount: [6, 10],
  deliverSeconds: 300,
};

export const EXPEDITION = {
  maxCrew: 3,
  maxRounds: 6,
  strike: 9,
  voidSecondsPerRound: 8,
  marks: [4, 7],
  rescueChance: 0.3,
};

export const REGION_NAMES = ['The Greenbelt', 'The Rust Reaches', 'The Ash Steppe', 'The Void Frontier'];
export const REGION_COLORS = [0x6fbf73, 0xc98a4b, 0x9a8fa6, 0x6d5fd6];
