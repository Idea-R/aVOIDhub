'use client'
import { useEffect, useRef, useState } from 'react'
import type { BoardSelection, PublicBoard } from '@/lib/leaderboards/contract'

export function PublicScoreBoard({ game, mode, autoLoad = false, personal = false }: BoardSelection & { autoLoad?: boolean; personal?: boolean }) {
  const [board, setBoard] = useState<PublicBoard | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [best, setBest] = useState<string | null>(null), [bestLoading, setBestLoading] = useState(false), [signIn, setSignIn] = useState(false)
  const pending = useRef<AbortController | null>(null), bestPending = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const bestSubscription = useRef<{ unsubscribe(): void } | null>(null)
  const bestIdentity = useRef<string | null>(null)
  async function load() {
    if (pending.current) return
    const controller = new AbortController(); pending.current = controller; setLoading(true); setError('')
    try {
      const response = await fetch(`/api/leaderboards?game=${encodeURIComponent(game)}&mode=${encodeURIComponent(mode)}`, { credentials: 'omit', signal: controller.signal })
      if (!response.ok) throw new Error('unavailable')
      const result: PublicBoard = await response.json()
      if (!controller.signal.aborted) setBoard(result)
    } catch { if (!controller.signal.aborted) setError('Scores are unavailable right now. Try again later.') }
    finally { if (pending.current === controller) { pending.current = null; if (!controller.signal.aborted) setLoading(false) } }
  }
  useEffect(() => {
    mounted.current = true
    setBoard(null); setError(''); setBest(null); setSignIn(false)
    if (autoLoad) void load()
    return () => { mounted.current = false; pending.current?.abort(); pending.current = null; bestPending.current?.abort(); bestPending.current = null; bestSubscription.current?.unsubscribe(); bestSubscription.current = null }
    // Each selection is keyed by the parent. No polling or focus refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, mode, autoLoad])
  async function loadBest() {
    if (bestPending.current) return
    const controller = new AbortController(); bestPending.current = controller; setBestLoading(true)
    try {
      // Load browser auth only after an explicit private-data request. Public
      // browsing does not start a session lookup or bundle the SDK eagerly.
      if (!bestSubscription.current) {
        const { createClient } = await import('@/lib/supabase/client')
        if (!mounted.current || controller.signal.aborted) return
        const { data } = createClient().auth.onAuthStateChange((event, session) => {
          const identity = session?.user.id ?? null
          if (event !== 'INITIAL_SESSION' && (event === 'SIGNED_OUT' || identity !== bestIdentity.current)) {
            bestPending.current?.abort(); bestPending.current = null
            setBest(null); setBestLoading(false); setSignIn(false)
          }
          bestIdentity.current = identity
        })
        bestSubscription.current = data.subscription
      }
      if (controller.signal.aborted) return
      const response = await fetch(`/api/player/best?game=${encodeURIComponent(game)}&mode=${encodeURIComponent(mode)}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      if (response.status === 401) { if (!controller.signal.aborted) { setSignIn(true); setBest('Sign in to see your best.') } return }
      if (!response.ok) throw new Error('unavailable')
      const result = await response.json()
      if (mounted.current && !controller.signal.aborted) setBest(typeof result.personalBest === 'number' ? result.personalBest.toLocaleString() : 'No accepted run yet.')
    } catch { if (!controller.signal.aborted) setBest('Your best is unavailable right now.') }
    finally { if (bestPending.current === controller) { bestPending.current = null; if (!controller.signal.aborted) setBestLoading(false) } }
  }
  return <div className="scoreSnapshot" aria-busy={loading}>
    <div className="buttonRow"><button type="button" className="secondaryButton" disabled={loading} onClick={() => void load()}>{loading ? 'Loading scores…' : board ? 'Refresh scores' : 'Load scores'}</button>
      {personal && <button type="button" className="secondaryButton" disabled={bestLoading} onClick={() => void loadBest()}>{bestLoading ? 'Loading your best…' : 'Show my best'}</button>}</div>
    <p className="quietNote" role="status">{error || (board ? `${board.legacy ? 'Legacy board · ' : ''}Updated ${new Date(board.observedAt).toLocaleTimeString()} · public scores can lag by a few minutes.` : 'Load the public board when you want to check the scores.')}</p>
    {personal && best !== null && <p className="gamePersonalBest" role="status">Your best: <strong>{best}</strong>{signIn && <a href={`/login/?next=${encodeURIComponent(`/games/${game}/`)}`}>Sign in</a>}</p>}
    {board?.scores.map((row, index) => <div className="gameScoreRow" key={row.id}><span><i>{String(index + 1).padStart(2, '0')}</i>{row.playerName}</span><em className="trustPill">{row.trust}</em><strong>{row.score.toLocaleString()}</strong></div>)}
    {board && !board.scores.length && <p className="gameScoreEmpty">No saved runs yet.</p>}
  </div>
}
