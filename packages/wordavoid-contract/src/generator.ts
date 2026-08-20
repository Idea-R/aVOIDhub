import {
  WORDAVOID_DICTIONARY,
  WORDAVOID_DICTIONARY_HASH,
  WORDAVOID_DICTIONARY_VERSION,
  type WordAvoidDictionaryEntry,
  type WordAvoidDifficulty,
} from './dictionary.generated'
import {
  WORDAVOID_NORMALIZATION_VERSION,
  WORDAVOID_RULESET_VERSION,
  type WordAvoidV1Mode,
} from './scoring'

const dictionaryByDifficulty = Object.freeze({
  easy: WORDAVOID_DICTIONARY.filter((entry) => entry.difficulty === 'easy'),
  medium: WORDAVOID_DICTIONARY.filter((entry) => entry.difficulty === 'medium'),
  hard: WORDAVOID_DICTIONARY.filter((entry) => entry.difficulty === 'hard'),
  extreme: WORDAVOID_DICTIONARY.filter((entry) => entry.difficulty === 'extreme'),
  boss: WORDAVOID_DICTIONARY.filter((entry) => entry.difficulty === 'boss'),
}) satisfies Readonly<Record<WordAvoidDifficulty, readonly WordAvoidDictionaryEntry[]>>

export interface WordAvoidRunManifest {
  runId: string
  seed: string
  mode: WordAvoidV1Mode
  rulesetVersion: typeof WORDAVOID_RULESET_VERSION
  dictionaryVersion: typeof WORDAVOID_DICTIONARY_VERSION
  dictionaryHash: typeof WORDAVOID_DICTIONARY_HASH
  normalizationVersion: typeof WORDAVOID_NORMALIZATION_VERSION
}

export interface WordAvoidPrompt {
  sequence: number
  promptId: string
  text: string
  difficulty: WordAvoidDifficulty
  level: number
  angleTurn: number
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mix32(value: number): number {
  let mixed = value >>> 0
  mixed ^= mixed >>> 16
  mixed = Math.imul(mixed, 0x7feb352d)
  mixed ^= mixed >>> 15
  mixed = Math.imul(mixed, 0x846ca68b)
  mixed ^= mixed >>> 16
  return mixed >>> 0
}

function sample(seed: string, sequence: number, lane: string): number {
  return mix32(fnv1a32(`${seed}|${sequence}|${lane}`))
}

export function isWordAvoidV1Mode(value: unknown): value is WordAvoidV1Mode {
  return value === 'classic' || value === 'timeAttack'
}

export function isWordAvoidSeed(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value)
}

export function levelForPromptSequence(sequence: number): number {
  if (!Number.isInteger(sequence) || sequence < 0) throw new Error('invalid_prompt_sequence')
  return Math.floor(sequence / 5) + 1
}

export function difficultyForLevel(level: number): WordAvoidDifficulty {
  if (level > 40) return 'boss'
  if (level > 30) return 'extreme'
  if (level > 20) return 'hard'
  if (level > 10) return 'medium'
  return 'easy'
}

export function createWordAvoidPrompt(seed: string, sequence: number): WordAvoidPrompt {
  if (!isWordAvoidSeed(seed)) throw new Error('invalid_run_seed')
  const level = levelForPromptSequence(sequence)
  const difficulty = difficultyForLevel(level)
  const pool = dictionaryByDifficulty[difficulty]
  const entry = pool[sample(seed, sequence, 'word') % pool.length]

  return {
    sequence,
    promptId: entry.id,
    text: entry.text,
    difficulty,
    level,
    angleTurn: sample(seed, sequence, 'angle') % 65_536,
  }
}

export function createWordAvoidManifest(input: {
  runId: string
  seed: string
  mode: WordAvoidV1Mode
}): WordAvoidRunManifest {
  if (input.runId.length < 1 || input.runId.length > 128) throw new Error('invalid_run_id')
  if (!isWordAvoidSeed(input.seed)) throw new Error('invalid_run_seed')
  if (!isWordAvoidV1Mode(input.mode)) throw new Error('invalid_run_mode')

  return {
    ...input,
    rulesetVersion: WORDAVOID_RULESET_VERSION,
    dictionaryVersion: WORDAVOID_DICTIONARY_VERSION,
    dictionaryHash: WORDAVOID_DICTIONARY_HASH,
    normalizationVersion: WORDAVOID_NORMALIZATION_VERSION,
  }
}
