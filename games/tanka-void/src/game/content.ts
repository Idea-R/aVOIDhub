import type { EnemyArchetype } from "./types";

export interface EnemyProfile {
  label: string;
  maxHealth: number;
  forwardSpeed: number;
  reverseSpeed: number;
  turnRate: number;
  turretRate: number;
  fireIntervalTicks: number;
  shellDamage: number;
  preferredRange: number;
  minimumRange: number;
  maximumFireRange: number;
}

export interface EnemySpawnDefinition {
  archetype: EnemyArchetype;
  x: number;
  y: number;
}

export interface WaveDefinition {
  number: number;
  title: string;
  cue: string;
  enemies: readonly EnemySpawnDefinition[];
}

export const TANKAVOID_ENEMY_PROFILES: Record<EnemyArchetype, EnemyProfile> = {
  scout: {
    label: "SCOUT",
    maxHealth: 100,
    forwardSpeed: 152,
    reverseSpeed: 82,
    turnRate: Math.PI * 0.92,
    turretRate: Math.PI * 1.05,
    fireIntervalTicks: 120,
    shellDamage: 3,
    preferredRange: 300,
    minimumRange: 210,
    maximumFireRange: 670,
  },
  bruiser: {
    label: "BRUISER",
    maxHealth: 160,
    forwardSpeed: 92,
    reverseSpeed: 54,
    turnRate: Math.PI * 0.42,
    turretRate: Math.PI * 0.72,
    fireIntervalTicks: 138,
    shellDamage: 4,
    preferredRange: 340,
    minimumRange: 255,
    maximumFireRange: 780,
  },
  hunter: {
    label: "HUNTER",
    maxHealth: 130,
    forwardSpeed: 112,
    reverseSpeed: 88,
    turnRate: Math.PI * 0.64,
    turretRate: Math.PI * 0.9,
    fireIntervalTicks: 96,
    shellDamage: 4,
    preferredRange: 525,
    minimumRange: 425,
    maximumFireRange: 910,
  },
  commander: {
    label: "COMMANDER",
    maxHealth: 260,
    forwardSpeed: 112,
    reverseSpeed: 62,
    turnRate: Math.PI * 0.55,
    turretRate: Math.PI * 0.84,
    fireIntervalTicks: 108,
    shellDamage: 5,
    preferredRange: 315,
    minimumRange: 235,
    maximumFireRange: 820,
  },
};

export const TANKAVOID_WAVES: readonly WaveDefinition[] = [
  {
    number: 1,
    title: "Cut the angle",
    cue: "A scout will try to show you your own side plate.",
    enemies: [{ archetype: "scout", x: 925, y: 360 }],
  },
  {
    number: 2,
    title: "Break the line",
    cue: "The bruiser wants the center. Make it earn the lane.",
    enemies: [{ archetype: "bruiser", x: 925, y: 360 }],
  },
  {
    number: 3,
    title: "Crossfire",
    cue: "The scout closes while the hunter keeps its distance.",
    enemies: [
      { archetype: "scout", x: 945, y: 190 },
      { archetype: "hunter", x: 1000, y: 530 },
    ],
  },
  {
    number: 4,
    title: "No safe range",
    cue: "The bruiser takes space. The hunter takes the long shot.",
    enemies: [
      { archetype: "bruiser", x: 930, y: 230 },
      { archetype: "hunter", x: 1000, y: 500 },
    ],
  },
  {
    number: 5,
    title: "Last command",
    cue: "Break the commander while the specialists pull you apart.",
    enemies: [
      { archetype: "commander", x: 900, y: 360 },
      { archetype: "scout", x: 1030, y: 165 },
      { archetype: "hunter", x: 1040, y: 545 },
    ],
  },
] as const;

export const TANKAVOID_WAVE_COUNT = TANKAVOID_WAVES.length;
export const TANKAVOID_FIELD_REPAIR = 28;
