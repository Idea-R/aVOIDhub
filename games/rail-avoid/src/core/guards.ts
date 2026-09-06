import type { Car, SimState } from './types';
import { TRAIN } from './config';

/** Emergency sidearms do not replace a car's main weapon or use its ammo feed. */
export function guardDamage(state: SimState, car: Car): number {
  const crew = state.train.crew.find(c => c.id === car.crewId && c.hp > 0);
  return TRAIN.guardDamage + (crew ? TRAIN.guardCrewBonus : 0) + (crew?.specialty === 'gunner' ? TRAIN.guardGunnerBonus : 0);
}
