import type { Metadata } from 'next'
import { PlatformPage } from '@/components/PlatformPage'
import { TeamWorkspace } from '@/components/TeamWorkspace'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import './teams.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your teams', robots: { index: false, follow: false } }

export default async function TeamsPage() {
  const configured = isPlatformRuntimeConfigured()
  let initialUserId: string | null = null
  if (configured) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    if (!error && data.user) initialUserId = data.user.id
  }

  return (
    <PlatformPage eyebrow="/ private workspace" title={<>Your people.<br /><em>Your teams.</em></>} intro="Create a team, invite someone, and keep your membership in view.">
      <TeamWorkspace enabled={configured} initialUserId={initialUserId} />
    </PlatformPage>
  )
}
