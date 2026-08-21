import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { PlatformPage } from '@/components/PlatformPage'
import { isPlatformRuntimeConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PlayerPage({ params }: { params: Promise<{ username: string }> }) {
  if (!isPlatformRuntimeConfigured()) notFound()
  const { username } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('username, display_name, bio, social_links, created_at')
    .eq('username', username.toLowerCase())
    .eq('is_public', true)
    .maybeSingle()
  if (!profile) notFound()
  const socials = (profile.social_links || {}) as Record<string, string>

  return (
    <PlatformPage eyebrow="/ player profile" title={<>{profile.display_name || profile.username}<br /><em>@{profile.username}</em></>} intro={profile.bio || 'An aVOID player with an unfinished story.'}>
      <section className="platformPanel narrowPanel">
        <p className="panelLabel">Outbound signals</p>
        <div className="profileLinks">
          {Object.entries(socials).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}<ExternalLink size={15} /></a>)}
          {!Object.keys(socials).length && <span>No public social links yet.</span>}
        </div>
      </section>
    </PlatformPage>
  )
}

