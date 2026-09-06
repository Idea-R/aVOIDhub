/** Pure availability contract shared by UI and simulation. No RNG or side effects. */
import type { PassengerEventOption, SimState } from './types';
import { CAR_DEFS } from './cars';
import { RELICS } from './relics';

export function unmetEventRequirement(s: SimState, option: PassengerEventOption): string | null {
  const r = option.requires;
  if (!r) return null;
  if (r.car && !s.train.cars.some(c => c.type === r.car && c.hp > 0)) return `Requires a ${CAR_DEFS[r.car]?.name ?? r.car}`;
  if (r.crew && !s.train.crew.some(c => c.specialty === r.crew && c.hp > 20)) return `Requires a ${r.crew} above 20 HP`;
  if (r.relic && !s.train.relics?.includes(r.relic)) return `Requires ${RELICS.find(x => x.id === r.relic)?.name ?? r.relic}`;
  if (r.fitCrew && !s.train.crew.some(c => c.hp > 20)) return 'No crew above 20 HP. Choose another option; wounded crew stay aboard.';
  if (r.resource && s.train.resources[r.resource] < (r.amount ?? 1)) return `Requires ${r.amount ?? 1} ${r.resource} (have ${Math.floor(s.train.resources[r.resource])})`;
  if (r.marks && (s.train.marks ?? 0) < r.marks) return `Requires ${r.marks} Void Marks (have ${Math.floor(s.train.marks ?? 0)})`;
  return null;
}
