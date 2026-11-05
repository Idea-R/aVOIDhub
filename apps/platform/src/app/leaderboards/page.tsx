import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PlatformPage } from '@/components/PlatformPage'
import { LeaderboardExplorer } from '@/components/LeaderboardExplorer'
export const dynamic = 'error'
export const metadata: Metadata = { title: 'Leaderboards' }
export default function LeaderboardsPage() {
  return <PlatformPage eyebrow="/ shared competition" title={<>Runs worth<br /><em>believing.</em></>} intro="Every hosted game gets its own board and ruleset. Server replay means the platform rebuilt the score from run evidence. Bounded means it checked a smaller terminal summary. Both remain provisional while anti-cheat work continues.">
    <Suspense fallback={<p className="emptyState">Opening the scoreboards…</p>}><LeaderboardExplorer /></Suspense>
    <noscript>Enable JavaScript to load current public scores. Game information and play links remain available in the game directory.</noscript>
  </PlatformPage>
}
