import {
  createWordAvoidPrompt,
  isWordAvoidSeed,
  isWordAvoidV1Mode,
  type WordAvoidRunManifest,
} from './generator'
import {
  WORDAVOID_DICTIONARY_HASH,
  WORDAVOID_DICTIONARY_VERSION,
  type WordAvoidDifficulty,
} from './dictionary.generated'
import {
  calculateAccuracy,
  calculateWordScore,
  calculateWpm,
  normalizeWordAvoidInput,
  TIME_ATTACK_DURATION_MS,
  WORDAVOID_NORMALIZATION_VERSION,
  WORDAVOID_RULESET_VERSION,
  WORD_MISS_DAMAGE,
  type WordAvoidTerminalReason,
} from './scoring'

export const WORDAVOID_MAX_EVENTS = 12_000
export const WORDAVOID_MAX_WALL_DURATION_MS = 2_700_000
export const WORDAVOID_MAX_ACTIVE_DURATION_MS = 1_800_000
export const WORDAVOID_MAX_ACTIVE_PROMPTS = 32

export type WordAvoidRunEvent =
  | { type: 'spawn'; sequence: number; promptId: string; atMs: number }
  | { type: 'attempt'; sequence: number | null; key: string; atMs: number }
  | { type: 'miss'; sequence: number; atMs: number }
  | { type: 'pause'; atMs: number }
  | { type: 'resume'; atMs: number }
  | { type: 'finish'; reason: WordAvoidTerminalReason; atMs: number }

export interface WordAvoidRunSummary {
  score: number
  wordsCompleted: number
  wordsMissed: number
  charactersAttempted: number
  charactersCorrect: number
  maxStreak: number
  accuracy: number
  wpm: number
  activeDurationMs: number
  level: number
  health: number
  terminalReason: WordAvoidTerminalReason
}

export interface WordAvoidRunEvidence {
  runId: string
  rulesetVersion: string
  dictionaryVersion: string
  dictionaryHash: string
  normalizationVersion: string
  events: readonly WordAvoidRunEvent[]
  summary?: WordAvoidRunSummary
}

export type WordAvoidValidationErrorCode =
  | 'invalid_manifest'
  | 'run_identity_mismatch'
  | 'ruleset_mismatch'
  | 'dictionary_mismatch'
  | 'normalization_mismatch'
  | 'invalid_events'
  | 'too_many_events'
  | 'timestamp_invalid'
  | 'timestamp_out_of_order'
  | 'event_during_pause'
  | 'pause_state_invalid'
  | 'spawn_sequence_invalid'
  | 'prompt_mismatch'
  | 'too_many_active_prompts'
  | 'prompt_not_active'
  | 'input_invalid'
  | 'finish_missing'
  | 'finish_duplicate'
  | 'event_after_finish'
  | 'terminal_reason_invalid'
  | 'duration_invalid'
  | 'summary_mismatch'

export interface WordAvoidValidationError {
  code: WordAvoidValidationErrorCode
  eventIndex?: number
  field?: string
}

export type WordAvoidValidationResult =
  | { ok: true; summary: WordAvoidRunSummary }
  | { ok: false; errors: WordAvoidValidationError[] }

interface ActivePrompt {
  promptId: string
  text: string
  difficulty: WordAvoidDifficulty
  level: number
  progress: number
  spawnedAtActiveMs: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0
}

function parseManifest(value: unknown): WordAvoidRunManifest | null {
  if (!isRecord(value)) return null
  if (typeof value.runId !== 'string' || value.runId.length < 1 || value.runId.length > 128) return null
  if (!isWordAvoidSeed(value.seed) || !isWordAvoidV1Mode(value.mode)) return null
  if (value.rulesetVersion !== WORDAVOID_RULESET_VERSION) return null
  if (value.dictionaryVersion !== WORDAVOID_DICTIONARY_VERSION) return null
  if (value.dictionaryHash !== WORDAVOID_DICTIONARY_HASH) return null
  if (value.normalizationVersion !== WORDAVOID_NORMALIZATION_VERSION) return null
  return value as unknown as WordAvoidRunManifest
}

function parseEvidence(value: unknown): WordAvoidRunEvidence | null {
  if (!isRecord(value) || !Array.isArray(value.events)) return null
  if (typeof value.runId !== 'string') return null
  if (typeof value.rulesetVersion !== 'string' || typeof value.dictionaryVersion !== 'string') return null
  if (typeof value.dictionaryHash !== 'string' || typeof value.normalizationVersion !== 'string') return null
  return value as unknown as WordAvoidRunEvidence
}

function compareSummary(actual: WordAvoidRunSummary, submitted: unknown): WordAvoidValidationError[] {
  if (!isRecord(submitted)) return [{ code: 'summary_mismatch' }]
  const errors: WordAvoidValidationError[] = []
  for (const field of Object.keys(actual) as Array<keyof WordAvoidRunSummary>) {
    if (submitted[field] !== actual[field]) errors.push({ code: 'summary_mismatch', field })
  }
  return errors
}

export function validateWordAvoidRun(
  manifestValue: unknown,
  evidenceValue: unknown,
): WordAvoidValidationResult {
  const manifest = parseManifest(manifestValue)
  if (!manifest) return { ok: false, errors: [{ code: 'invalid_manifest' }] }
  const evidence = parseEvidence(evidenceValue)
  if (!evidence) return { ok: false, errors: [{ code: 'invalid_events' }] }

  const headerErrors: WordAvoidValidationError[] = []
  if (evidence.runId !== manifest.runId) headerErrors.push({ code: 'run_identity_mismatch' })
  if (evidence.rulesetVersion !== manifest.rulesetVersion) headerErrors.push({ code: 'ruleset_mismatch' })
  if (
    evidence.dictionaryVersion !== manifest.dictionaryVersion ||
    evidence.dictionaryHash !== manifest.dictionaryHash
  ) headerErrors.push({ code: 'dictionary_mismatch' })
  if (evidence.normalizationVersion !== manifest.normalizationVersion) {
    headerErrors.push({ code: 'normalization_mismatch' })
  }
  if (headerErrors.length > 0) return { ok: false, errors: headerErrors }
  if (evidence.events.length === 0) return { ok: false, errors: [{ code: 'finish_missing' }] }
  if (evidence.events.length > WORDAVOID_MAX_EVENTS) {
    return { ok: false, errors: [{ code: 'too_many_events' }] }
  }

  const errors: WordAvoidValidationError[] = []
  const activePrompts = new Map<number, ActivePrompt>()
  let nextSpawnSequence = 0
  let previousAtMs = -1
  let paused = false
  let pauseStartedAt = 0
  let pausedDurationMs = 0
  let finished = false
  let terminalReason: WordAvoidTerminalReason | null = null
  let finishAtMs = 0
  let score = 0
  let health = 100
  let streak = 0
  let maxStreak = 0
  let wordsCompleted = 0
  let wordsMissed = 0
  let charactersAttempted = 0
  let charactersCorrect = 0
  let finalLevel = 1

  const activeTimeAt = (atMs: number) => atMs - pausedDurationMs - (paused ? atMs - pauseStartedAt : 0)

  for (let eventIndex = 0; eventIndex < evidence.events.length; eventIndex += 1) {
    const event = evidence.events[eventIndex] as unknown
    if (!isRecord(event) || typeof event.type !== 'string' || !isNonNegativeInteger(event.atMs)) {
      errors.push({ code: 'invalid_events', eventIndex })
      continue
    }
    if (event.atMs > WORDAVOID_MAX_WALL_DURATION_MS) errors.push({ code: 'timestamp_invalid', eventIndex })
    if (event.atMs < previousAtMs) errors.push({ code: 'timestamp_out_of_order', eventIndex })
    previousAtMs = event.atMs
    if (finished) {
      errors.push({ code: event.type === 'finish' ? 'finish_duplicate' : 'event_after_finish', eventIndex })
      continue
    }

    if (event.type === 'pause') {
      if (paused) errors.push({ code: 'pause_state_invalid', eventIndex })
      else {
        paused = true
        pauseStartedAt = event.atMs
      }
      continue
    }

    if (event.type === 'resume') {
      if (!paused) errors.push({ code: 'pause_state_invalid', eventIndex })
      else {
        pausedDurationMs += event.atMs - pauseStartedAt
        paused = false
      }
      continue
    }

    if (paused && event.type !== 'finish') {
      errors.push({ code: 'event_during_pause', eventIndex })
      continue
    }

    const eventActiveMs = activeTimeAt(event.atMs)

    if (event.type === 'spawn') {
      if (!isNonNegativeInteger(event.sequence) || typeof event.promptId !== 'string') {
        errors.push({ code: 'invalid_events', eventIndex })
        continue
      }
      if (event.sequence !== nextSpawnSequence) {
        errors.push({ code: 'spawn_sequence_invalid', eventIndex })
        continue
      }
      const expected = createWordAvoidPrompt(manifest.seed, event.sequence)
      if (event.promptId !== expected.promptId) errors.push({ code: 'prompt_mismatch', eventIndex })
      activePrompts.set(event.sequence, {
        promptId: expected.promptId,
        text: expected.text,
        difficulty: expected.difficulty,
        level: expected.level,
        progress: 0,
        spawnedAtActiveMs: eventActiveMs,
      })
      nextSpawnSequence += 1
      finalLevel = expected.level
      if (activePrompts.size > WORDAVOID_MAX_ACTIVE_PROMPTS) {
        errors.push({ code: 'too_many_active_prompts', eventIndex })
      }
      continue
    }

    if (event.type === 'attempt') {
      if (!(event.sequence === null || isNonNegativeInteger(event.sequence)) || typeof event.key !== 'string') {
        errors.push({ code: 'invalid_events', eventIndex })
        continue
      }
      const key = normalizeWordAvoidInput(event.key)
      if (!key) {
        errors.push({ code: 'input_invalid', eventIndex })
        continue
      }
      charactersAttempted += 1
      if (event.sequence === null) continue
      const prompt = activePrompts.get(event.sequence)
      if (!prompt) {
        errors.push({ code: 'prompt_not_active', eventIndex })
        continue
      }
      if (prompt.text[prompt.progress] === key) {
        charactersCorrect += 1
        prompt.progress += 1
        if (prompt.progress === prompt.text.length) {
          score += calculateWordScore({
            length: prompt.text.length,
            difficulty: prompt.difficulty,
            responseMs: eventActiveMs - prompt.spawnedAtActiveMs,
            currentStreak: streak,
            level: prompt.level,
          })
          wordsCompleted += 1
          streak += 1
          maxStreak = Math.max(maxStreak, streak)
          activePrompts.delete(event.sequence)
        }
      } else {
        prompt.progress = 0
      }
      continue
    }

    if (event.type === 'miss') {
      if (!isNonNegativeInteger(event.sequence)) {
        errors.push({ code: 'invalid_events', eventIndex })
        continue
      }
      const prompt = activePrompts.get(event.sequence)
      if (!prompt) {
        errors.push({ code: 'prompt_not_active', eventIndex })
        continue
      }
      activePrompts.delete(event.sequence)
      wordsMissed += 1
      streak = 0
      health = Math.max(0, health - WORD_MISS_DAMAGE[prompt.difficulty])
      continue
    }

    if (event.type === 'finish') {
      if (event.reason !== 'health' && event.reason !== 'timer') {
        errors.push({ code: 'terminal_reason_invalid', eventIndex })
        continue
      }
      if (paused) errors.push({ code: 'pause_state_invalid', eventIndex })
      terminalReason = event.reason
      finishAtMs = event.atMs
      finished = true
      const activeDurationMs = activeTimeAt(event.atMs)
      if (activeDurationMs > WORDAVOID_MAX_ACTIVE_DURATION_MS) errors.push({ code: 'duration_invalid', eventIndex })
      if (event.reason === 'health' && health > 0) errors.push({ code: 'terminal_reason_invalid', eventIndex })
      if (
        event.reason === 'timer' &&
        (manifest.mode !== 'timeAttack' || activeDurationMs < TIME_ATTACK_DURATION_MS || activeDurationMs > TIME_ATTACK_DURATION_MS + 250)
      ) errors.push({ code: 'terminal_reason_invalid', eventIndex })
      continue
    }

    errors.push({ code: 'invalid_events', eventIndex })
  }

  if (!finished || !terminalReason) errors.push({ code: 'finish_missing' })
  if (paused) errors.push({ code: 'pause_state_invalid' })
  if (errors.length > 0 || !terminalReason) return { ok: false, errors }

  const activeDurationMs = finishAtMs - pausedDurationMs
  const summary: WordAvoidRunSummary = {
    score,
    wordsCompleted,
    wordsMissed,
    charactersAttempted,
    charactersCorrect,
    maxStreak,
    accuracy: calculateAccuracy(charactersCorrect, charactersAttempted),
    wpm: calculateWpm(charactersCorrect, activeDurationMs),
    activeDurationMs,
    level: finalLevel,
    health,
    terminalReason,
  }

  if (evidence.summary) {
    const summaryErrors = compareSummary(summary, evidence.summary)
    if (summaryErrors.length > 0) return { ok: false, errors: summaryErrors }
  }

  return { ok: true, summary }
}
