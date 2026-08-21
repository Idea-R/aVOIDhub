'use client'

import { useState } from 'react'
import type { ReviewEntity } from '@/lib/admin/review'

export function AdminReviewActions({
  entity,
  id,
  status,
  actions,
}: {
  entity: ReviewEntity
  id: string
  status: string
  actions: Array<{ status: string; label: string }>
}) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function update(nextStatus: string) {
    setBusy(true)
    setMessage('Writing review state…')
    const response = await fetch('/api/admin/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity, id, currentStatus: status, nextStatus }),
    })
    const result = await response.json().catch(() => ({}))
    if (response.ok) {
      setMessage('Review state saved. Refreshing the queue…')
      window.location.reload()
      return
    }
    setBusy(false)
    setMessage(result.error === 'transition_not_allowed' ? 'That review step is no longer available.' : 'The review state could not be saved.')
  }

  return (
    <div className="reviewActionBlock">
      <div className="reviewActions">
        {actions.map((action) => (
          <button key={action.status} type="button" disabled={busy} onClick={() => update(action.status)}>
            {action.label}
          </button>
        ))}
      </div>
      <p aria-live="polite">{message}</p>
    </div>
  )
}
