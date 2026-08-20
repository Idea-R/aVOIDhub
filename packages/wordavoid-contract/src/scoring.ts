import type { WordAvoidDifficulty } from './dictionary.generated'

export const WORDAVOID_RULESET_VERSION = 'wordavoid-v1.0.0-rc.1'
export const WORDAVOID_NORMALIZATION_VERSION = 'ascii-lower-v1'
export const TIME_ATTACK_DURATION_MS = 120_000

export type WordAvoidV1Mode = 'classic' | 'timeAttack'
export type WordAvoidTerminalReason = 'health' | 'timer'

export const WORD_DIFFICULTY_MULTIPLIER: Readonly<Record<WordAvoidDifficulty, number>> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  extreme: 3,
  boss: 5,
}

export const WORD_MISS_DAMAGE: Readonly<Record<WordAvoidDifficulty, number>> = {
  easy: 10,
  medium: 15,
  hard: 20,
  extreme: 25,
  boss: 30,
}

export interface WordScoreInput {
  length: number
  difficulty: WordAvoidDifficulty
  responseMs: number
  currentStreak: number
  level: number
}

export function calculateWordScore(input: WordScoreInput): number {
  const baseScore = Math.max(0, input.length) * 10
  const timeBonus = Math.max(0, 100 - Math.max(0, input.responseMs) / 100)
  const streakBonus = Math.max(0, input.currentStreak) * 5
  const levelBonus = Math.max(1, input.level) * 10

  return Math.round(
    (baseScore + timeBonus + streakBonus + levelBonus) * WORD_DIFFICULTY_MULTIPLIER[input.difficulty],
  )
}

export function calculateAccuracy(charactersCorrect: number, charactersAttempted: number): number {
  if (charactersAttempted <= 0) return 100
  const boundedCorrect = Math.min(Math.max(0, charactersCorrect), charactersAttempted)
  return Math.round((boundedCorrect / charactersAttempted) * 100)
}

export function calculateWpm(charactersCorrect: number, activeDurationMs: number): number {
  if (charactersCorrect <= 0 || activeDurationMs <= 0) return 0
  const minutes = activeDurationMs / 60_000
  return Math.round(charactersCorrect / 5 / minutes)
}

export function normalizeWordAvoidInput(value: string): string | null {
  const normalized = value.normalize('NFKC').toLowerCase()
  return /^[a-z]$/.test(normalized) ? normalized : null
}
