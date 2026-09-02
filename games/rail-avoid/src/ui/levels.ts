/** Car / locomotive upgrade levels (contract landing: Car.level 1..3, train.locoUpgrades). Everything reads defensively. */
import { el } from './dom';
import type { Car, CarType, TrainState } from '../core/types';
import type { SimApi } from '../sim/api';
import { CAR_DEFS } from '../core/cars';

export const MAX_LEVEL = 3;
export const ROMAN = ['', 'I', 'II', 'III'];

export function levelOf(car: Car | null | undefined): number {
  const l = (car as unknown as { level?: number } | null | undefined)?.level;
  return typeof l === 'number' && l >= 1 ? Math.min(MAX_LEVEL, Math.floor(l)) : 1;
}

export type LocoKind = 'speed' | 'power' | 'frame' | 'crew';
export const LOCO_TRACKS: Array<{ kind: LocoKind; name: string; per: string; icon: string }> = [
  { kind: 'speed', name: 'Speed', per: '+12% speed per level', icon: '»' },
  { kind: 'power', name: 'Boiler pressure', per: '+2 power per level', icon: '⚡' },
  { kind: 'frame', name: 'Reinforced frame', per: '+60 HP per level', icon: '▣' },
  { kind: 'crew', name: 'Track crew', per: '+1 plan range per level', icon: '═' },
];

export function locoLevel(t: TrainState | null | undefined, kind: LocoKind): number {
  const u = (t as unknown as { locoUpgrades?: Record<string, number> } | null | undefined)?.locoUpgrades;
  const v = u ? u[kind] : 0;
  return typeof v === 'number' ? Math.max(0, Math.min(MAX_LEVEL, Math.floor(v))) : 0;
}

/** Optional SimApi additions; undefined until the sim contract lands. */
type UpgradeApi = {
  upgradeCar?(carIndex: number): boolean;
  upgradeCost?(carIndex: number): number;
  upgradeLoco?(kind: LocoKind): boolean;
  locoUpgradeCost?(kind: LocoKind): number;
};
export function upgradeApi(sim: SimApi | null): UpgradeApi { return (sim ?? {}) as unknown as UpgradeApi; }
export function hasUpgrades(sim: SimApi | null): boolean { const a = upgradeApi(sim); return typeof a.upgradeCar === 'function' && typeof a.upgradeCost === 'function'; }
export function hasLocoUpgrades(sim: SimApi | null): boolean { const a = upgradeApi(sim); return typeof a.upgradeLoco === 'function' && typeof a.locoUpgradeCost === 'function'; }
export function carUpgradeCost(sim: SimApi | null, i: number): number {
  const a = upgradeApi(sim);
  if (typeof a.upgradeCost !== 'function') return -1;
  try { const c = a.upgradeCost(i); return typeof c === 'number' ? c : -1; } catch { return -1; }
}
export function locoUpgradeCost(sim: SimApi | null, kind: LocoKind): number {
  const a = upgradeApi(sim);
  if (typeof a.locoUpgradeCost !== 'function') return -1;
  try { const c = a.locoUpgradeCost(kind); return typeof c === 'number' ? c : -1; } catch { return -1; }
}

/** What one level does to this car type (tooltip copy). */
export function levelEffect(type: CarType): string {
  const def = CAR_DEFS[type];
  const parts = ['+25% max HP'];
  if (def.weapon) parts.push('weapons +20% damage');
  if (def.powerGen > 0) parts.push('+1 power');
  if (type === 'radiator') parts.push('+2 cooling');
  if (Object.values(def.storage).some(v => (v ?? 0) > 0)) parts.push('+20% storage');
  if (def.passengerCap > 0) parts.push('+4 passengers');
  return parts.join(', ') + ' per level';
}

/** Three pips (filled up to `level`); `level` 0..3. */
export function levelPips(level: number, cls = ''): HTMLElement {
  const wrap = el('span', { class: 'rv-pips' + (cls ? ' ' + cls : ''), title: level > 0 ? `Level ${ROMAN[level] ?? level}` : 'Not upgraded', 'aria-label': `level ${level} of ${MAX_LEVEL}` });
  for (let i = 1; i <= MAX_LEVEL; i++) wrap.appendChild(el('i', { class: i <= level ? 'rv-on' : '' }));
  return wrap;
}
