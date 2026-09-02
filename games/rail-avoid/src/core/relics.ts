/** Relics: permanent run passives chosen 1-of-3 from elites, bosses, expeditions and markets. */
export type RelicRarity = 'common' | 'rare' | 'legendary';

export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  rarity: RelicRarity;
  icon: string;   // short glyph for the UI
}

export const RELICS: RelicDef[] = [
  { id: 'coal_heart', name: 'Coal Heart', desc: 'Coal burn −20%.', rarity: 'common', icon: '🔥' },
  { id: 'grease_tin', name: 'Grease Tin', desc: 'Train speed +8%.', rarity: 'common', icon: '🛢' },
  { id: 'void_compass', name: 'Void Compass', desc: 'Planning range +1.', rarity: 'common', icon: '🧭' },
  { id: 'lucky_spike', name: 'Lucky Spike', desc: 'Track on plains, ruins and ash costs 1 less rail (min 1).', rarity: 'common', icon: '⛏' },
  { id: 'salvage_hooks', name: 'Salvage Hooks', desc: 'Enemies drop salvage twice as often.', rarity: 'common', icon: '🪝' },
  { id: 'cargo_nets', name: 'Cargo Nets', desc: 'Salvage is collected from twice as far.', rarity: 'common', icon: '🕸' },
  { id: 'ledger', name: "Quartermaster's Ledger", desc: 'All storage +20%.', rarity: 'common', icon: '📒' },
  { id: 'old_timetable', name: 'Old Timetable', desc: 'Settlement stops are twice as short.', rarity: 'common', icon: '⏱' },
  { id: 'signal_lantern', name: 'Signal Lantern', desc: 'Wave warnings come 4 s earlier.', rarity: 'common', icon: '🏮' },
  { id: 'hound_whistle', name: 'Hound Whistle', desc: 'Void Hound bites no longer slow the train.', rarity: 'rare', icon: '🐕' },
  { id: 'sappers_manual', name: "Sapper's Manual", desc: 'Every sapper charge is revealed the moment it is planted.', rarity: 'rare', icon: '📘' },
  { id: 'ember_gloves', name: 'Ember Gloves', desc: 'Heat and fire damage to cars halved.', rarity: 'rare', icon: '🧤' },
  { id: 'militia_banner', name: 'Militia Banner', desc: 'Haven militia deal double damage.', rarity: 'rare', icon: '🚩' },
  { id: 'tinkers_kit', name: "Tinker's Kit", desc: 'Every car slowly self-repairs (0.4 HP/s).', rarity: 'rare', icon: '🔧' },
  { id: 'bounty_board', name: 'Bounty Board', desc: 'Bounty rewards +50%.', rarity: 'rare', icon: '📜' },
  { id: 'conductors_watch', name: "Conductor's Watch", desc: 'Resolving a passenger event pays 2 Void Marks.', rarity: 'rare', icon: '⌚' },
  { id: 'iron_couplings', name: 'Iron Couplings', desc: 'A destroyed middle car no longer sheds the cars behind it.', rarity: 'legendary', icon: '⛓' },
  { id: 'ashfall_cloak', name: 'Ashfall Cloak', desc: 'Passengers are immune to ashfall; storms no longer strike the train.', rarity: 'legendary', icon: '🧥' },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map(r => [r.id, r]));

export function relicDef(id: string): RelicDef | undefined { return RELIC_BY_ID[id]; }
