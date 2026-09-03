/** Enemy catalogue: 6 regular types + 3 bosses. */
import type { EnemyDef, EnemyType } from './types';

const E = (d: Partial<EnemyDef> & Pick<EnemyDef, 'type' | 'name' | 'layer' | 'hp' | 'speed' | 'damage' | 'attackCooldown' | 'range' | 'threatCost' | 'color'>): EnemyDef => ({
  boards: false, armor: 0, resist: {}, radius: 12, xp: 10, ...d,
});

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  raider: E({ type: 'raider', name: 'Raider', layer: 'ground', hp: 32, speed: 78, damage: 2, attackCooldown: 1, range: 26, boards: true, threatCost: 4, radius: 10, color: 0xe06060, xp: 10 }),
  hound: E({ type: 'hound', name: 'Void Hound', layer: 'ground', hp: 24, speed: 124, damage: 2.5, attackCooldown: 1.2, range: 30, threatCost: 3, radius: 9, resist: { shell: 0.6 }, color: 0x8f6fe0, xp: 8 }),
  crawler: E({ type: 'crawler', name: 'Crawler', layer: 'ground', hp: 160, speed: 50, damage: 13, attackCooldown: 4, range: 34, armor: 0.65, resist: { bullet: 0.45, shell: 2, energy: 1.2 }, threatCost: 12, radius: 18, color: 0xb0743c, xp: 40 }),
  harpy: E({ type: 'harpy', name: 'Harpy Drone', layer: 'air', hp: 40, speed: 96, damage: 5, attackCooldown: 2.2, range: 70, threatCost: 6, radius: 12, resist: { bullet: 0.25, shell: 1, energy: 1.3, fire: 0.4 }, color: 0xe8a94f, xp: 18 }),
  sapper: E({ type: 'sapper', name: 'Sapper', layer: 'ground', hp: 30, speed: 70, damage: 50, attackCooldown: 4, range: 20, threatCost: 7, radius: 9, color: 0x60c0a0, xp: 22 }),
  wisp: E({ type: 'wisp', name: 'Void Wisp', layer: 'phase', hp: 45, speed: 60, damage: 2, attackCooldown: 1.5, range: 50, threatCost: 6, radius: 11, resist: { bullet: 0, shell: 0, energy: 1.5, fire: 1.4, melee: 0 }, color: 0x9a6fff, xp: 20 }),
  boss_wagon: E({ type: 'boss_wagon', name: 'The Iron Wagon', layer: 'ground', hp: 950, speed: 0, damage: 15, attackCooldown: 3, range: 340, armor: 0.5, resist: { bullet: 0.45, shell: 1.6, energy: 1, fire: 0.5 }, threatCost: 0, radius: 40, color: 0x8a8f9a, xp: 500 }),
  boss_brood: E({ type: 'boss_brood', name: 'The Brood Mother', layer: 'ground', hp: 1900, speed: 44, damage: 40, attackCooldown: 3.5, range: 46, armor: 0.7, resist: { bullet: 0.25, shell: 1.8, energy: 1.2, fire: 0.8 }, threatCost: 0, radius: 44, color: 0xb0743c, xp: 700 }),
  boss_maw: E({ type: 'boss_maw', name: 'The Void Maw', layer: 'phase', hp: 2400, speed: 0, damage: 12, attackCooldown: 2, range: 380, resist: { bullet: 0, shell: 0.15, energy: 1.5, fire: 1.3, melee: 0 }, threatCost: 0, radius: 70, color: 0x6d5fd6, xp: 1200 }),
};

export const REGULAR_ENEMIES: EnemyType[] = ['raider', 'hound', 'crawler', 'harpy', 'sapper', 'wisp'];

/** Base spawn weights per region (0..3). */
export const REGION_WEIGHTS: Record<EnemyType, number[]> = {
  raider:  [10, 7, 4, 4],
  hound:   [5, 6, 5, 4],
  crawler: [0, 6, 4, 4],
  harpy:   [0, 0, 7, 5],
  sapper:  [0, 4, 3, 4],
  wisp:    [0, 0, 6, 8],
  boss_wagon: [0, 0, 0, 0], boss_brood: [0, 0, 0, 0], boss_maw: [0, 0, 0, 0],
};

/** Which damage classes are ineffective vs a type (used by the adaptive director). */
export function enemyCountersClass(type: EnemyType, cls: string): boolean {
  const r = ENEMY_DEFS[type].resist as Record<string, number>;
  return (r[cls] ?? 1) <= 0.4;
}
