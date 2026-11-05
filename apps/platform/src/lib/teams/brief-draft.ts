import type { TeamAction } from './contract'

export type TeamBriefDraft = { notes: string; expectedRevision: number; conflict: boolean }
export type TeamBriefDrafts = Record<string, TeamBriefDraft>
export type TeamBriefSaveAction = Extract<TeamAction, { action: 'save-notes' }>
type DraftAction =
  | { type: 'edit'; teamId: string; notes: string; savedRevision: number }
  | { type: 'refresh'; teamIds: string[] }
  | { type: 'conflict'; teamId: string }
  | { type: 'saved'; submitted: TeamBriefSaveAction }
  | { type: 'discard'; teamId: string }
  | { type: 'clear' }

export function teamBriefDraftsReducer(drafts: TeamBriefDrafts, action: DraftAction): TeamBriefDrafts {
  if (action.type === 'clear') return {}
  if (action.type === 'refresh') {
    const visibleTeams = new Set(action.teamIds)
    // Refresh can remove inaccessible teams, but must never rebase an edited brief.
    return Object.fromEntries(Object.entries(drafts).filter(([teamId]) => visibleTeams.has(teamId)))
  }
  if (action.type === 'edit') {
    const previous = drafts[action.teamId]
    return { ...drafts, [action.teamId]: { notes: action.notes, expectedRevision: previous?.expectedRevision ?? action.savedRevision, conflict: previous?.conflict ?? false } }
  }
  if (action.type === 'conflict') {
    const draft = drafts[action.teamId]
    return draft ? { ...drafts, [action.teamId]: { ...draft, conflict: true } } : drafts
  }
  const teamId = action.type === 'saved' ? action.submitted.teamId : action.teamId
  if (action.type === 'saved') {
    const draft = drafts[teamId]
    // A delayed/replayed acknowledgement cannot discard a different local draft.
    if (!draft || draft.notes !== action.submitted.notes || draft.expectedRevision !== action.submitted.expectedRevision) return drafts
  }
  const next = { ...drafts }
  delete next[teamId]
  return next
}

export function createTeamBriefSaveAction(teamId: string, draft: TeamBriefDraft): TeamBriefSaveAction {
  return { action: 'save-notes', teamId, notes: draft.notes, expectedRevision: draft.expectedRevision }
}

export function teamBriefProblem(teamId: string, draft: TeamBriefDraft): string | null {
  if (draft.conflict) return 'Someone saved a newer brief. Your draft is kept. Copy anything you want to keep, then use the saved brief before editing again.'
  if (!Number.isInteger(draft.expectedRevision) || draft.expectedRevision < 0 || draft.expectedRevision > 2147483647) return 'This brief could not be loaded. Refresh your teams before editing.'
  if (draft.notes.length > 2000) return 'Shorten the brief to fit the 2,000-character text limit.'
  if (draft.notes.includes('\u0000')) return 'This brief contains an unsupported character. Remove it before saving.'
  const bytes = new TextEncoder().encode(JSON.stringify(createTeamBriefSaveAction(teamId, draft))).byteLength
  if (bytes > 4096) return 'This brief uses too much space to save. Shorten it; emoji and some other characters take extra space.'
  return null
}
