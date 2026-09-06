/** Car catalogue (23 types). */
import type { CarDef, CarType, WeaponDef } from './types';

const W = (w: Partial<WeaponDef> & Pick<WeaponDef, 'kind' | 'damageClass' | 'range' | 'damage' | 'cooldown'>): WeaponDef => ({
  hitsGround: true, hitsAir: false, hitsPhase: false, ammoPerShot: 1, aoe: 0, chain: 0, projectileSpeed: 0, heatPerShot: 1,
  ...w,
});

const base = (d: Partial<CarDef> & Pick<CarDef, 'type' | 'name' | 'short' | 'desc' | 'tier' | 'cost' | 'hp' | 'weight' | 'color'>): CarDef => ({
  powerGen: 0, powerUse: 0, heatGen: 0, cooling: 0, storage: {}, passengerCap: 0, ammoSupplier: false, weapon: null,
  planRangeBonus: 0, trackCostBonus: 0, blocksBoarders: false,
  ...d,
});

export const CAR_DEFS: Record<CarType, CarDef> = {
  locomotive: base({ type: 'locomotive', name: 'Locomotive', short: 'LOCO', desc: 'The heart of the convoy. Generates 8 power. A conductor guard provides weak short-range defense; if the engine dies, the run ends.', tier: 1, cost: 0, hp: 220, weight: 40, powerGen: 8, heatGen: 2,
    weapon: W({ kind: 'marines', damageClass: 'melee', range: 105, damage: 2.5, cooldown: 0.85, ammoPerShot: 0, heatPerShot: 0 }), color: 0xe8c170 }),
  coal_bunker: base({ type: 'coal_bunker', name: 'Coal Bunker', short: 'COAL', desc: '+80 coal storage. Coal is burned per hex; heavier trains burn more.', tier: 1, cost: 18, hp: 120, weight: 22, storage: { coal: 80 }, color: 0x4a4a52 }),
  boiler: base({ type: 'boiler', name: 'Boiler Car', short: 'BOIL', desc: '+4 power to cars within 3 positions. Runs hot.', tier: 1, cost: 26, hp: 110, weight: 24, powerGen: 4, heatGen: 3, color: 0xd9743a }),
  reactor: base({ type: 'reactor', name: 'Reactor Car', short: 'REAC', desc: '+10 power, +6 heat/s. Explodes violently when destroyed, damaging neighbours.', tier: 3, cost: 70, hp: 140, weight: 30, powerGen: 10, heatGen: 6, color: 0x5ee0b0 }),
  radiator: base({ type: 'radiator', name: 'Radiator Car', short: 'RADR', desc: 'Cools itself by 6/s and neighbours by 3/s. Put it between hot cars.', tier: 1, cost: 22, hp: 100, weight: 14, cooling: 6, color: 0x6fb7e8 }),
  fabricator: base({ type: 'fabricator', name: 'Fabricator', short: 'FAB', desc: 'Turns 2 scrap into 1 rail every 4 s while powered.', tier: 2, cost: 40, hp: 120, weight: 26, powerUse: 3, heatGen: 2, color: 0xc9a54a }),
  foundry: base({ type: 'foundry', name: 'Foundry', short: 'FNDY', desc: 'Turns 1 scrap into 6 ammo every 4 s while powered. Supplies ammo to weapons within 2 cars.', tier: 2, cost: 38, hp: 120, weight: 28, powerUse: 3, heatGen: 3, ammoSupplier: true, color: 0xd98a3a }),
  cargo: base({ type: 'cargo', name: 'Cargo Hold', short: 'CRGO', desc: '+60 to every storage cap. Supplies ammo to weapons within 2 cars.', tier: 1, cost: 20, hp: 125, weight: 20, storage: { rails: 60, scrap: 60, coal: 40, ammo: 60, food: 60 }, ammoSupplier: true, color: 0x8b6b4a }),
  armored_cargo: base({ type: 'armored_cargo', name: 'Armoured Cargo', short: 'ACRG', desc: '+40 storage, double hull. Supplies ammo within 2 cars.', tier: 2, cost: 42, hp: 240, weight: 34, storage: { rails: 40, scrap: 40, coal: 30, ammo: 60, food: 40 }, ammoSupplier: true, color: 0x6b6b7a }),
  gatling: base({ type: 'gatling', name: 'Gatling Turret', short: 'GATL', desc: 'Rapid bullets vs ground. Weak against armour and air. Needs an ammo supplier within 2 cars.', tier: 1, cost: 30, hp: 115, weight: 18, powerUse: 2, heatGen: 2,
    weapon: W({ kind: 'gatling', damageClass: 'bullet', range: 230, damage: 8, cooldown: 0.22, ammoPerShot: 0.25, heatPerShot: 0.35, hitsAir: true }), color: 0xe86f6f }),
  cannon: base({ type: 'cannon', name: 'Cannon Car', short: 'CANN', desc: 'Slow ground-only shells with splash; double damage vs armour. Needs an ammo supplier within 2 cars.', tier: 2, cost: 48, hp: 120, weight: 30, powerUse: 3, heatGen: 4,
    weapon: W({ kind: 'cannon', damageClass: 'shell', range: 330, damage: 42, cooldown: 2.4, ammoPerShot: 4, aoe: 55, projectileSpeed: 420, heatPerShot: 6 }), color: 0xd94f4f }),
  flak: base({ type: 'flak', name: 'Flak Battery', short: 'FLAK', desc: 'Bursts that shred air units; cannot target ground. Needs an ammo supplier within 2 cars.', tier: 2, cost: 40, hp: 100, weight: 22, powerUse: 3, heatGen: 2,
    weapon: W({ kind: 'flak', damageClass: 'shell', range: 300, damage: 14, cooldown: 0.5, hitsGround: false, hitsAir: true, ammoPerShot: 0.5, aoe: 34, projectileSpeed: 560, heatPerShot: 0.8 }), color: 0xe8a94f }),
  tesla: base({ type: 'tesla', name: 'Tesla Coil', short: 'TSLA', desc: 'Chain lightning hits ground, air and wisps. Needs 5 power and no ammo. Weak vs raiders in numbers.', tier: 3, cost: 75, hp: 110, weight: 24, powerUse: 5, heatGen: 3,
    weapon: W({ kind: 'tesla', damageClass: 'energy', range: 210, damage: 22, cooldown: 1.1, hitsAir: true, hitsPhase: true, ammoPerShot: 0, chain: 3, heatPerShot: 3 }), color: 0x8fd3ff }),
  flamethrower: base({ type: 'flamethrower', name: 'Flamethrower', short: 'FLAM', desc: 'Short cone that burns ground units and wisps; purges boarders in adjacent cars. Very hot.', tier: 2, cost: 36, hp: 100, weight: 20, powerUse: 1, heatGen: 4,
    weapon: W({ kind: 'flame', damageClass: 'fire', range: 120, damage: 9, cooldown: 0.3, hitsPhase: true, ammoPerShot: 0, aoe: 40, heatPerShot: 1.6 }), color: 0xff8f3a }),
  barracks: base({ type: 'barracks', name: 'Barracks', short: 'BRKS', desc: 'Marines fight boarders in this car and its neighbours. Also a tough hull.', tier: 1, cost: 34, hp: 160, weight: 24,
    weapon: W({ kind: 'marines', damageClass: 'melee', range: 90, damage: 4, cooldown: 0.5, ammoPerShot: 0, heatPerShot: 0 }), color: 0x6fbf73 }),
  medical: base({ type: 'medical', name: 'Medical Car', short: 'MEDI', desc: 'Heals crew and passengers, resolves sickness events, halves boarder casualties.', tier: 2, cost: 36, hp: 110, weight: 20, powerUse: 1, color: 0xf5f5f5 }),
  scout: base({ type: 'scout', name: 'Scout Car', short: 'SCOT', desc: '+3 planning range, reveals sapper charges, earlier wave warnings.', tier: 1, cost: 28, hp: 90, weight: 12, powerUse: 1, planRangeBonus: 3, color: 0x9fd8ff }),
  coach: base({ type: 'coach', name: 'Passenger Coach', short: 'COCH', desc: 'Carries 12 passengers. Passengers eat food and pay rails when delivered.', tier: 1, cost: 24, hp: 115, weight: 20, passengerCap: 12, color: 0xd6b4f0 }),
  sleeper: base({ type: 'sleeper', name: 'Sleeper Coach', short: 'SLPR', desc: 'Carries 20 passengers in comfort; halves negative passenger events; ashfall-proof.', tier: 2, cost: 44, hp: 120, weight: 28, powerUse: 1, passengerCap: 20, color: 0xb98fe8 }),
  rail_layer: base({ type: 'rail_layer', name: 'Rail Layer', short: 'RAIL', desc: 'Track costs 1 less rail (min 1) and +2 planning range.', tier: 2, cost: 46, hp: 120, weight: 26, powerUse: 2, heatGen: 1, planRangeBonus: 2, trackCostBonus: -1, color: 0xc9c9c9 }),
  armor_plate: base({ type: 'armor_plate', name: 'Armour Plate', short: 'ARMR', desc: 'Massive hull. Boarders cannot walk through it. Great as a rear shield.', tier: 2, cost: 40, hp: 320, weight: 36, blocksBoarders: true, color: 0x8a8f9a }),
  caboose: base({ type: 'caboose', name: 'Caboose', short: 'CABO', desc: 'Rear guard car. The train can reverse at full speed, boarders climbing on from the rear are slowed, and passengers keep their spirits up.', tier: 1, cost: 26, hp: 140, weight: 18, color: 0xc85a3a }),
  signal: base({ type: 'signal', name: 'Signal Car', short: 'SIGN', desc: 'Weather forecast, 20% smaller waves and longer wave warnings.', tier: 2, cost: 38, hp: 100, weight: 16, powerUse: 1, color: 0xf0e36b }),
};

export const CAR_TYPES = Object.keys(CAR_DEFS) as CarType[];
export const BUYABLE_CARS = CAR_TYPES.filter(t => t !== 'locomotive');

export function carDef(t: CarType): CarDef { return CAR_DEFS[t]; }
