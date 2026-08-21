export const reviewEntities = ['creator_application', 'game_submission', 'score_submission'] as const
export type ReviewEntity = (typeof reviewEntities)[number]

export const reviewStatuses = {
  creator_application: ['pending', 'reviewing', 'approved', 'declined', 'withdrawn'],
  game_submission: ['draft', 'submitted', 'reviewing', 'changes_requested', 'approved', 'declined', 'withdrawn'],
  score_submission: ['accepted', 'review', 'rejected'],
} as const

const transitions: Record<ReviewEntity, Record<string, readonly string[]>> = {
  creator_application: {
    pending: ['reviewing', 'declined'],
    reviewing: ['approved', 'declined'],
    approved: ['reviewing'],
    declined: ['reviewing'],
    withdrawn: [],
  },
  game_submission: {
    draft: [],
    submitted: ['reviewing', 'declined'],
    reviewing: ['changes_requested', 'approved', 'declined'],
    changes_requested: ['reviewing', 'declined'],
    approved: ['reviewing'],
    declined: ['reviewing'],
    withdrawn: [],
  },
  score_submission: {
    accepted: ['review', 'rejected'],
    review: ['accepted', 'rejected'],
    rejected: ['review'],
  },
}

export function canTransitionReviewStatus(entity: ReviewEntity, from: string, to: string): boolean {
  return transitions[entity][from]?.includes(to) ?? false
}

export function getReviewTable(entity: ReviewEntity): 'creator_applications' | 'game_submissions' | 'score_submissions' {
  if (entity === 'creator_application') return 'creator_applications'
  if (entity === 'game_submission') return 'game_submissions'
  return 'score_submissions'
}
