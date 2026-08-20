'use client'

import { useState, type FormEvent } from 'react'

type SocialLinks = { website?: string; instagram?: string; x?: string }

export function ProfileForm({ profile }: { profile: { username?: string | null; display_name?: string | null; bio?: string | null; is_public?: boolean | null; social_links?: SocialLinks | null } }) {
  const [status, setStatus] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatus('Saving…')
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: form.get('username'),
        displayName: form.get('displayName'),
        bio: form.get('bio'),
        isPublic: form.get('isPublic') === 'on',
        socials: { website: form.get('website'), instagram: form.get('instagram'), x: form.get('x') },
      }),
    })
    const data = await response.json()
    setStatus(response.ok ? 'Profile saved.' : data.error === 'username_taken' ? 'That player handle is already taken.' : 'The profile could not be saved.')
  }

  return (
    <form className="platformForm" onSubmit={submit}>
      <label htmlFor="username">Player handle</label>
      <input id="username" name="username" defaultValue={profile.username || ''} minLength={3} maxLength={24} pattern="[a-z0-9][a-z0-9_-]*[a-z0-9]" required />
      <label htmlFor="displayName">Display name</label>
      <input id="displayName" name="displayName" defaultValue={profile.display_name || profile.username || ''} minLength={2} maxLength={60} required />
      <label htmlFor="bio">Bio</label>
      <textarea id="bio" name="bio" defaultValue={profile.bio || ''} maxLength={500} rows={4} />
      <div className="profileSocialGrid">
        <label>Website<input name="website" type="url" defaultValue={profile.social_links?.website || ''} placeholder="https://" /></label>
        <label>Instagram<input name="instagram" type="url" defaultValue={profile.social_links?.instagram || ''} placeholder="https://instagram.com/…" /></label>
        <label>X<input name="x" type="url" defaultValue={profile.social_links?.x || ''} placeholder="https://x.com/…" /></label>
      </div>
      <label className="checkLabel"><input name="isPublic" type="checkbox" defaultChecked={profile.is_public !== false} /> Let people find this profile</label>
      <button className="primaryButton" type="submit">Save profile</button>
      <p className="formStatus" aria-live="polite">{status}</p>
    </form>
  )
}

