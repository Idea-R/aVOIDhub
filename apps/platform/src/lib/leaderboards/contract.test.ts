import { describe, expect, it } from 'vitest'
import { publicScores, resolveBoard, type StoredScore } from './contract'
const row = (extra: Partial<StoredScore> = {}): StoredScore => ({ id: 'score-id', user_id: 'private-user-uuid', player_name: 'Player', score: 42, verification_level: 'provisional', metadata: { secret: 'private-metadata', validationCapability: 'server_recomputed' }, created_at: '2026-11-05T00:00:00Z', ...extra })
describe('public leaderboard boundary', () => {
  it.each(['__proto__', 'constructor', 'toString', 'missing', null, {}])('rejects non-registry game %s', value => expect(resolveBoard(value, undefined)).toBeNull())
  it('validates finite mode choices', () => {
    expect(resolveBoard('wordavoid', 'classic')).toEqual({ game: 'wordavoid', mode: 'classic' })
    expect(resolveBoard('wordavoid', 'private-mode')).toBeNull()
    expect(resolveBoard('voidavoid', undefined)?.mode).toBe('endless')
  })
  it('publishes an allowlisted DTO without user IDs or arbitrary metadata', () => {
    const result = publicScores([row()])
    expect(result).toEqual([{ id: 'score-id', playerName: 'Player', score: 42, trust: 'server replay', recordedAt: '2026-11-05T00:00:00Z' }])
    expect(JSON.stringify(result)).not.toContain('private-')
  })
  it('keeps only the first sorted result per player and bounds the payload', () => {
    expect(publicScores([row(), row({ id: 'duplicate' })])).toHaveLength(1)
    expect(publicScores(Array.from({ length: 200 }, (_, index) => row({ id: `${index}`, user_id: `user-${index}` })))).toHaveLength(50)
    expect(publicScores([row({ score: NaN })])).toEqual([])
  })
  it('does not promote legacy verification flags or unrecognized trust', () => {
    expect(publicScores([row()], true)[0].trust).toBe('legacy')
    expect(publicScores([row({ metadata: {}, verification_level: '<script>' })])[0].trust).toBe('provisional')
  })
})
