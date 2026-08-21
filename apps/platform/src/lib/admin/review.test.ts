import { describe, expect, it } from 'vitest'
import { canTransitionReviewStatus, getReviewTable } from './review'

describe('admin review transitions', () => {
  it('requires a deliberate reviewing step before approval', () => {
    expect(canTransitionReviewStatus('creator_application', 'pending', 'approved')).toBe(false)
    expect(canTransitionReviewStatus('creator_application', 'pending', 'reviewing')).toBe(true)
    expect(canTransitionReviewStatus('creator_application', 'reviewing', 'approved')).toBe(true)
  })

  it('never exposes delete or publish as review transitions', () => {
    expect(canTransitionReviewStatus('game_submission', 'reviewing', 'published')).toBe(false)
    expect(canTransitionReviewStatus('game_submission', 'approved', 'deleted')).toBe(false)
  })

  it('maps only whitelisted entities to tables', () => {
    expect(getReviewTable('score_submission')).toBe('score_submissions')
  })
})
