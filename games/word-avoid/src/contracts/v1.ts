import type { Difficulty, GameMode } from '../types/game';

export const WORDAVOID_RULESET_VERSION = 'wordavoid-v1-draft.1';
export const WORDAVOID_DICTIONARY_VERSION = 'wordavoid-dictionary-2026-08-20';
export const TIME_ATTACK_DURATION_MS = 120_000;

export type V1GameMode = Extract<GameMode, 'classic' | 'timeAttack'>;
export type ModeReleaseStatus = 'v1' | 'deferred';
export type ModeImplementationStatus = 'implemented' | 'partial' | 'duplicate';

export interface ModeContract {
  id: GameMode;
  name: string;
  summary: string;
  releaseStatus: ModeReleaseStatus;
  implementationStatus: ModeImplementationStatus;
  terminalCondition: string;
  competitive: boolean;
  deferredReason?: string;
}

export const WORDAVOID_MODE_CONTRACTS = [
  {
    id: 'classic',
    name: 'Classic Survival',
    summary: 'Type incoming words before they reach the center. The run ends at zero health.',
    releaseStatus: 'v1',
    implementationStatus: 'implemented',
    terminalCondition: 'Player health reaches zero.',
    competitive: true,
  },
  {
    id: 'timeAttack',
    name: 'Time Attack',
    summary: 'Score as many points as possible during one two-minute run.',
    releaseStatus: 'v1',
    implementationStatus: 'implemented',
    terminalCondition: '120,000 milliseconds of active simulation time elapse, or player health reaches zero.',
    competitive: true,
  },
  {
    id: 'perfectRun',
    name: 'Perfect Run',
    summary: 'A proposed one-mistake challenge.',
    releaseStatus: 'deferred',
    implementationStatus: 'duplicate',
    terminalCondition: 'Not versioned.',
    competitive: false,
    deferredReason: 'The current runtime falls through to Classic and does not end on the first mistake.',
  },
  {
    id: 'dailyChallenge',
    name: 'Daily Challenge',
    summary: 'A proposed reproducible daily word sequence.',
    releaseStatus: 'deferred',
    implementationStatus: 'duplicate',
    terminalCondition: 'Not versioned.',
    competitive: false,
    deferredReason: 'The current runtime falls through to Classic and has no date, seed, or daily ruleset.',
  },
  {
    id: 'waveDefense',
    name: 'Wave Defense',
    summary: 'An experimental wave-based difficulty variant.',
    releaseStatus: 'deferred',
    implementationStatus: 'partial',
    terminalCondition: 'Not versioned.',
    competitive: false,
    deferredReason: 'Wave progression exists, but its score, balance, and completion contract are unfinished.',
  },
  {
    id: 'skillTraining',
    name: 'Skill Training',
    summary: 'An experimental targeted-word practice mode.',
    releaseStatus: 'deferred',
    implementationStatus: 'partial',
    terminalCondition: 'Not versioned.',
    competitive: false,
    deferredReason: 'Only one hard-coded word skill is reachable and no training-session contract exists.',
  },
  {
    id: 'digitAssault',
    name: 'Digit Assault',
    summary: 'An experimental character, number, and symbol mode.',
    releaseStatus: 'deferred',
    implementationStatus: 'partial',
    terminalCondition: 'Not versioned.',
    competitive: false,
    deferredReason: 'Bespoke mechanics exist, but its statistics and score are not comparable with word modes.',
  },
  {
    id: 'geometricTyping',
    name: 'Geometric Typing',
    summary: 'An experimental keyboard-pattern mode.',
    releaseStatus: 'deferred',
    implementationStatus: 'partial',
    terminalCondition: 'Not versioned.',
    competitive: false,
    deferredReason: 'Bespoke mechanics exist, but its pattern evidence and competitive rules are not versioned.',
  },
] as const satisfies readonly ModeContract[];

export const V1_MODE_CONTRACTS = WORDAVOID_MODE_CONTRACTS.filter(
  (mode): mode is (typeof WORDAVOID_MODE_CONTRACTS)[number] & { id: V1GameMode; releaseStatus: 'v1' } =>
    mode.releaseStatus === 'v1',
);

export const DEFERRED_MODE_CONTRACTS = WORDAVOID_MODE_CONTRACTS.filter(
  (mode) => mode.releaseStatus === 'deferred',
);

export function isV1GameMode(mode: GameMode): mode is V1GameMode {
  return mode === 'classic' || mode === 'timeAttack';
}

export const WORD_DIFFICULTY_MULTIPLIER: Readonly<Record<Difficulty, number>> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  extreme: 3,
  boss: 5,
};

export interface WordScoreInput {
  length: number;
  difficulty: Difficulty;
  responseMs: number;
  currentStreak: number;
  level: number;
}

export function calculateWordScore(input: WordScoreInput): number {
  const baseScore = Math.max(0, input.length) * 10;
  const timeBonus = Math.max(0, 100 - Math.max(0, input.responseMs) / 100);
  const streakBonus = Math.max(0, input.currentStreak) * 5;
  const levelBonus = Math.max(1, input.level) * 10;

  return Math.round(
    (baseScore + timeBonus + streakBonus + levelBonus) * WORD_DIFFICULTY_MULTIPLIER[input.difficulty],
  );
}

export function calculateAccuracy(charactersCorrect: number, charactersAttempted: number): number {
  if (charactersAttempted <= 0) return 100;
  const boundedCorrect = Math.min(Math.max(0, charactersCorrect), charactersAttempted);
  return Math.round((boundedCorrect / charactersAttempted) * 100);
}

export function calculateWpm(charactersCorrect: number, activeDurationMs: number): number {
  if (charactersCorrect <= 0 || activeDurationMs <= 0) return 0;
  const minutes = activeDurationMs / 60_000;
  return Math.round(charactersCorrect / 5 / minutes);
}
