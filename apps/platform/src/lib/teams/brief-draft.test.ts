import { describe, expect, it } from 'vitest'
import { createTeamBriefSaveAction, teamBriefDraftsReducer, teamBriefProblem, type TeamBriefDrafts } from './brief-draft'

const teamId = '1f83e60a-0ed5-4aba-922b-7d9b27f3b741'
const edit = (drafts: TeamBriefDrafts, notes: string, savedRevision = 3) => teamBriefDraftsReducer(drafts, { type: 'edit', teamId, notes, savedRevision })

describe('shared team brief drafts', () => {
  it('pins the saved revision at the first edit and preserves verbatim draft text', () => {
    const first = edit({}, '  Our plan\nKeep this spacing.  ')
    const continued = edit(first, '  Revised plan\n  ', 4)
    expect(continued[teamId]).toEqual({ notes: '  Revised plan\n  ', expectedRevision: 3, conflict: false })
  })

  it('refresh preserves unsaved text and the original revision even after newer saved data arrives', () => {
    const drafts = edit({}, 'My unsaved work')
    const refreshed = teamBriefDraftsReducer(drafts, { type: 'refresh', teamIds: [teamId] })
    const continued = edit(refreshed, 'My unsaved work continued', 8)
    expect(createTeamBriefSaveAction(teamId, continued[teamId])).toEqual({ action: 'save-notes', teamId, notes: 'My unsaved work continued', expectedRevision: 3 })
    expect(teamBriefDraftsReducer(refreshed, { type: 'refresh', teamIds: [teamId] })[teamId]).toBe(refreshed[teamId])
  })

  it('preserves the draft and blocks retries after a conflict, including after refresh or further typing', () => {
    const drafts = edit({}, 'Do not overwrite this draft')
    const conflict = teamBriefDraftsReducer(drafts, { type: 'conflict', teamId })
    const refreshed = teamBriefDraftsReducer(conflict, { type: 'refresh', teamIds: [teamId] })
    const edited = edit(refreshed, 'Still my own draft', 9)
    expect(edited[teamId]).toEqual({ notes: 'Still my own draft', expectedRevision: 3, conflict: true })
    expect(teamBriefProblem(teamId, edited[teamId])).toContain('use the saved brief')
  })

  it('rebases only after an explicit discard followed by a new edit of the saved version', () => {
    const drafts = teamBriefDraftsReducer(edit({}, 'Old draft'), { type: 'conflict', teamId })
    const discarded = teamBriefDraftsReducer(drafts, { type: 'discard', teamId })
    expect(discarded[teamId]).toBeUndefined()
    const next = edit(discarded, 'Freshly reviewed text', 9)
    expect(next[teamId]).toEqual({ notes: 'Freshly reviewed text', expectedRevision: 9, conflict: false })
  })

  it('discards only the acknowledged draft and ignores delayed or replayed save acknowledgements', () => {
    const original = edit({}, 'Submitted draft')
    const submitted = createTeamBriefSaveAction(teamId, original[teamId])
    const newer = edit(original, 'New local work')
    expect(teamBriefDraftsReducer(newer, { type: 'saved', submitted })).toBe(newer)
    const saved = teamBriefDraftsReducer(original, { type: 'saved', submitted })
    expect(saved).toEqual({})
    expect(teamBriefDraftsReducer(saved, { type: 'saved', submitted })).toBe(saved)
    const later = edit({}, 'Submitted draft', 4)
    expect(teamBriefDraftsReducer(later, { type: 'saved', submitted })).toBe(later)
  })

  it('clears all drafts on account change and removes drafts for teams no longer accessible', () => {
    const drafts: TeamBriefDrafts = { ...edit({}, 'First team'), other: { notes: 'Another team', expectedRevision: 2, conflict: false } }
    expect(teamBriefDraftsReducer(drafts, { type: 'clear' })).toEqual({})
    expect(teamBriefDraftsReducer(drafts, { type: 'refresh', teamIds: [teamId] })).toEqual({ [teamId]: drafts[teamId] })
  })
})

describe('shared team brief request bounds', () => {
  const draft = (notes: string, expectedRevision = 0) => ({ notes, expectedRevision, conflict: false })
  it('allows empty and 2,000-unit plain text, and keeps HTML-looking content as plain strings', () => {
    expect(teamBriefProblem(teamId, draft(''))).toBeNull()
    expect(teamBriefProblem(teamId, draft('a'.repeat(2000)))).toBeNull()
    expect(createTeamBriefSaveAction(teamId, draft('<script>do not execute</script>')).notes).toBe('<script>do not execute</script>')
    expect(teamBriefProblem(teamId, draft('a'.repeat(2001)))).toContain('2,000')
    expect(teamBriefProblem(teamId, draft('Text\u0000with a null character'))).toContain('unsupported character')
  })

  it('matches UTF16 counting for supplementary characters and checks actual UTF8 JSON bytes', () => {
    expect(teamBriefProblem(teamId, draft('😀'.repeat(1001)))).toContain('2,000')
    expect(teamBriefProblem(teamId, draft('界'.repeat(2000)))).toContain('extra space')
    expect(teamBriefProblem(teamId, draft('\u0001'.repeat(1000)))).toContain('extra space')
    const baselineBytes = new TextEncoder().encode(JSON.stringify(createTeamBriefSaveAction(teamId, draft('')))).byteLength
    const count = Math.floor((4096 - baselineBytes) / 3)
    expect(teamBriefProblem(teamId, draft('界'.repeat(count)))).toBeNull()
    expect(teamBriefProblem(teamId, draft('界'.repeat(count + 1)))).toContain('extra space')
  })

  it.each([-1, 1.5, Number.NaN, 2147483648])('rejects an invalid original revision: %s', revision => {
    expect(teamBriefProblem(teamId, draft('Text', revision))).toContain('Refresh')
  })
})
