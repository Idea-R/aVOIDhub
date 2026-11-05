'use client'

import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, Check, Copy, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import type { TeamAction, TeamInvitation, TeamsSnapshot } from '@/lib/teams/contract'
import { createTeamInviteLink, isTeamInviteToken, readTeamInviteFragment, teamInvitationStatus } from '@/lib/teams/invite-link'
import { createClient } from '@/lib/supabase/client'
import { createTeamBriefSaveAction, teamBriefDraftsReducer, teamBriefProblem } from '@/lib/teams/brief-draft'

type ShareLink = { teamId: string; invitationId: string; url: string; expiresAt: string }

class TeamRequestError extends Error {}

function failureMessage(failure: unknown) {
  return failure instanceof TeamRequestError ? failure.message : messageFor('teams_unavailable')
}

function messageFor(error: string) {
  switch (error) {
    case 'authentication_required': return 'Your session has ended. Sign in again to continue.'
    case 'team_or_invitation_unavailable': return 'This team or invitation is unavailable. The link may have expired, been revoked, or belong to another account.'
    case 'team_action_conflict': return 'That change is no longer available. Refresh your teams before trying again.'
    case 'invalid_team_action': return 'Check the details and try again.'
    case 'body_too_large': return 'This request is too large. Shorten your text and try again.'
    case 'origin_not_allowed': return 'The change could not be confirmed. Reload this page and try again.'
    default: return 'Teams could not be reached. Your changes have not been confirmed. Try again when you are connected.'
  }
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unavailable'
}

function invitationLabel(invite: TeamInvitation) {
  const status = teamInvitationStatus(invite)
  if (status === 'revoked') return `Revoked ${dateLabel(invite.revoked_at!)}`
  if (status === 'accepted') return `Accepted ${dateLabel(invite.accepted_at!)}`
  return `${status === 'expired' ? 'Expired' : 'Expires'} ${dateLabel(invite.expires_at)}`
}

export function TeamWorkspace({ enabled = true, initialUserId = null }: { enabled?: boolean; initialUserId?: string | null }) {
  const [snapshot, setSnapshot] = useState<TeamsSnapshot | null>(null)
  const [loading, setLoading] = useState(enabled && Boolean(initialUserId))
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [authRequired, setAuthRequired] = useState(!initialUserId)
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [briefDrafts, updateBriefDrafts] = useReducer(teamBriefDraftsReducer, {})
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [invalidInvite, setInvalidInvite] = useState(false)
  const [shareLink, setShareLink] = useState<ShareLink | null>(null)
  const [copied, setCopied] = useState(false)
  const busy = useRef(false)
  const mounted = useRef(false)
  const requests = useRef(new Set<AbortController>())
  const accountId = useRef(initialUserId)
  const accountEpoch = useRef(0)

  const clearShareLink = useCallback(() => { setShareLink(null); setCopied(false) }, [])

  const clearAccount = useCallback((nextUserId: string | null) => {
    accountEpoch.current++
    accountId.current = nextUserId
    for (const request of requests.current) request.abort()
    busy.current = false
    setSnapshot(null); setName(''); setEmails({}); setNotice(''); setError(''); updateBriefDrafts({ type: 'clear' })
    setPending(null); setLoading(false); setAuthRequired(true); clearShareLink()
    // Incoming invitation memory is not account data. It survives sign-in in another tab.
  }, [clearShareLink])

  const loadTeams = useCallback(async () => {
    const epoch = accountEpoch.current
    const controller = new AbortController()
    requests.current.add(controller)
    try {
      const response = await fetch('/api/teams', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      if (!mounted.current || epoch !== accountEpoch.current) return
      if (response.status === 401) {
        clearAccount(null)
        throw new TeamRequestError(messageFor('authentication_required'))
      }
      const data = await response.json()
      if (!mounted.current || epoch !== accountEpoch.current) return
      if (!response.ok) {
        throw new TeamRequestError(messageFor(data.error))
      }
      if (!data || typeof data.userId !== 'string' || !Array.isArray(data.teams)) throw new TeamRequestError(messageFor('teams_unavailable'))
      if (accountId.current !== data.userId) clearAccount(data.userId)
      accountId.current = data.userId
      setSnapshot(data); setAuthRequired(false)
      updateBriefDrafts({ type: 'refresh', teamIds: data.teams.map((team: { id: string }) => team.id) })
      return data as TeamsSnapshot
    } finally { requests.current.delete(controller) }
  }, [clearAccount])

  useEffect(() => {
    mounted.current = true
    function readFragment(event?: Event) {
      const invite = readTeamInviteFragment(window.location.href)
      if (window.location.hash) window.history.replaceState(window.history.state, '', invite.cleanHref)
      clearShareLink()
      if (invite.token || invite.invalid || event) { setInviteToken(invite.token); setInvalidInvite(invite.invalid) }
    }
    function clearOnNavigation() { clearAccount(accountId.current); setInviteToken(null); setInvalidInvite(false) }
    readFragment()
    if (initialUserId !== accountId.current) clearAccount(initialUserId)
    window.addEventListener('hashchange', readFragment)
    window.addEventListener('popstate', clearOnNavigation)
    window.addEventListener('pagehide', clearOnNavigation)
    if (enabled && initialUserId) {
      const epoch = accountEpoch.current
      void loadTeams().catch((failure: unknown) => {
        if (mounted.current && epoch === accountEpoch.current && !(failure instanceof DOMException && failure.name === 'AbortError')) setError(failureMessage(failure))
      }).finally(() => { if (mounted.current && epoch === accountEpoch.current) setLoading(false) })
    }
    return () => {
      mounted.current = false
      for (const request of requests.current) request.abort()
      window.removeEventListener('hashchange', readFragment)
      window.removeEventListener('popstate', clearOnNavigation)
      window.removeEventListener('pagehide', clearOnNavigation)
    }
  }, [clearAccount, clearShareLink, enabled, initialUserId, loadTeams])

  useEffect(() => {
    if (!enabled) return
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      if (!mounted.current) return
      const nextUserId = session?.user.id ?? null
      // Browser auth events only invalidate private state. GET verifies the next account.
      if (event === 'SIGNED_OUT' || nextUserId !== accountId.current) clearAccount(nextUserId)
    })
    return () => subscription.unsubscribe()
  }, [clearAccount, enabled])

  async function refresh() {
    if (busy.current) return
    const epoch = accountEpoch.current
    busy.current = true
    setPending('refresh'); setError(''); setNotice(''); clearShareLink()
    try { await loadTeams() }
    catch (failure) { if (mounted.current && epoch === accountEpoch.current) setError(failureMessage(failure)) }
    finally { if (mounted.current && epoch === accountEpoch.current) { setLoading(false); setPending(null); busy.current = false } }
  }

  async function mutate(action: TeamAction) {
    if (!enabled || busy.current || !snapshot || authRequired || snapshot.userId !== accountId.current) return
    if (action.action === 'save-notes') {
      const draft = briefDrafts[action.teamId]
      if (!draft || draft.notes !== action.notes || draft.expectedRevision !== action.expectedRevision) return
      const problem = teamBriefProblem(action.teamId, draft)
      if (problem) { setError(problem); return }
    }
    busy.current = true
    setPending(action.action === 'save-notes' ? `save-notes:${action.teamId}` : action.action); setError(''); setNotice(''); clearShareLink()
    const controller = new AbortController()
    const epoch = accountEpoch.current
    requests.current.add(controller)
    try {
      const response = await fetch('/api/teams', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(action), signal: controller.signal,
      })
      if (!mounted.current || epoch !== accountEpoch.current) return
      if (response.status === 401) {
        clearAccount(null)
        setError(messageFor('authentication_required'))
        return
      }
      const data = await response.json()
      if (!mounted.current || epoch !== accountEpoch.current) return
      if (!response.ok) {
        if (action.action === 'save-notes' && response.status === 409) {
          updateBriefDrafts({ type: 'conflict', teamId: action.teamId })
          throw new TeamRequestError('Someone saved a newer brief. Your draft is kept. Use the saved brief before editing again.')
        }
        throw new TeamRequestError(messageFor(data.error))
      }
      if (action.action === 'save-notes') {
        if (data.teamId !== action.teamId || data.notesRevision !== action.expectedRevision + 1) throw new TeamRequestError('The save could not be confirmed. Your draft is kept. Refresh to check the saved brief before trying again.')
        setSnapshot((current) => current && ({ ...current, teams: current.teams.map((team) => team.id === action.teamId ? { ...team, notes: action.notes, notes_revision: data.notesRevision } : team) }))
        updateBriefDrafts({ type: 'saved', submitted: action })
        setNotice('Team brief saved.')
      } else if (action.action === 'invite') {
        if (!isTeamInviteToken(data.token) || data.teamId !== action.teamId || typeof data.invitationId !== 'string' || !(Date.parse(data.expiresAt) > Date.now())) {
          throw new TeamRequestError('The invitation was created, but its link could not be shown. Refresh the list and revoke it before creating another.')
        }
        setShareLink({ teamId: data.teamId, invitationId: data.invitationId, url: createTeamInviteLink(window.location.origin, data.token), expiresAt: data.expiresAt })
        setEmails((current) => ({ ...current, [action.teamId]: '' }))
        setNotice('Invitation created. Copy the link and share it with the invited person.')
      } else if (action.action === 'accept') {
        setInviteToken(null); setInvalidInvite(false); setNotice('Invitation accepted. You have joined the team.')
      } else if (action.action === 'create') { setName(''); setNotice('Team created.') }
      else if (action.action === 'revoke') setNotice('Invitation revoked. Its link can no longer be used.')
      else if (action.action === 'remove') setNotice('Member removed.')
      else setNotice('You have left the team.')
      try { await loadTeams() }
      catch { if (mounted.current && epoch === accountEpoch.current) setError('Your change was saved, but the team list could not be refreshed. Refresh to see the latest membership.') }
    } catch (failure) {
      if (mounted.current && epoch === accountEpoch.current && !controller.signal.aborted) setError(failureMessage(failure))
    } finally {
      requests.current.delete(controller)
      if (mounted.current && epoch === accountEpoch.current) { setPending(null); busy.current = false }
    }
  }

  async function copyLink() {
    if (!shareLink || snapshot?.userId !== accountId.current) return
    if (!(Date.parse(shareLink.expiresAt) > Date.now())) { clearShareLink(); setError('This invitation has expired. Create a new one to invite this person.'); return }
    try { await navigator.clipboard.writeText(shareLink.url); setCopied(true) }
    catch { setError('The link could not be copied. Select the link below and copy it yourself.') }
  }

  async function useSavedBrief(teamId: string) {
    if (!enabled || busy.current || !snapshot || authRequired || snapshot.userId !== accountId.current) return
    const epoch = accountEpoch.current
    busy.current = true
    setPending(`use-saved:${teamId}`); setError(''); setNotice(''); clearShareLink()
    try {
      const latest = await loadTeams()
      if (!mounted.current || epoch !== accountEpoch.current) return
      if (latest?.teams.some((team) => team.id === teamId)) {
        updateBriefDrafts({ type: 'discard', teamId })
        setNotice('The latest saved brief is loaded. Your draft was discarded.')
      }
    } catch (failure) {
      if (mounted.current && epoch === accountEpoch.current) setError(failureMessage(failure))
    } finally {
      if (mounted.current && epoch === accountEpoch.current) { setPending(null); busy.current = false }
    }
  }

  function createTeam(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void mutate({ action: 'create', name: name.trim() }) }
  const disabled = Boolean(pending) || loading || !snapshot || authRequired

  if (!enabled) return (
    <section className="teamWorkspace teamUnavailable" aria-labelledby="teams-unavailable">
      <ShieldCheck aria-hidden="true" /><div><p className="panelLabel">Private teams</p><h2 id="teams-unavailable">Teams are not available here yet.</h2><p>Return when account services are available. If you opened an invitation, reopen its original link then.</p><a className="secondaryButton" href="/account/">Your account <ArrowUpRight aria-hidden="true" /></a></div>
    </section>
  )

  return (
    <section className="teamWorkspace" aria-labelledby="teams-heading" aria-busy={Boolean(pending) || loading}>
      <div className="teamHeading"><div><p className="panelLabel">Private teams</p><h2 id="teams-heading">Keep your people close.</h2><p>Team roles apply only to this workspace. Creator access and platform permissions stay separate.</p></div>{!authRequired && <button className="secondaryButton" type="button" disabled={Boolean(pending) || loading} onClick={() => void refresh()}><RefreshCw aria-hidden="true" /> {pending === 'refresh' ? 'Refreshing…' : 'Refresh teams'}</button>}</div>

      <div className="teamFeedback" aria-live="polite" aria-atomic="true">{notice && <p className="teamNotice"><Check aria-hidden="true" />{notice}</p>}</div>
      {error && <div className="teamError" role="alert"><p>{error}</p></div>}
      {authRequired && <section className="teamJoin" aria-labelledby="team-sign-in"><ShieldCheck aria-hidden="true" /><div><p className="panelLabel">Your account</p><h3 id="team-sign-in">Sign in to open your teams.</h3><p>Keep this page open while you sign in. Come back here and check sign-in to continue with your invitation.</p><div className="teamActions"><a className="primaryButton" href="/login/?next=/teams/" target="_blank" rel="noopener noreferrer">Sign in in a new tab <ArrowUpRight aria-hidden="true" /></a><button className="secondaryButton" type="button" disabled={Boolean(pending)} onClick={() => void refresh()}>{pending === 'refresh' ? 'Checking…' : 'Check sign-in'}</button></div></div></section>}
      {invalidInvite && <div className="teamError" role="alert"><p>This invitation link is incomplete or invalid. Ask the team owner for a new link.</p><button type="button" onClick={() => setInvalidInvite(false)}>Dismiss</button></div>}
      {inviteToken && <section className="teamJoin" aria-labelledby="team-join-heading"><ShieldCheck aria-hidden="true" /><div><p className="panelLabel">You have an invitation</p><h3 id="team-join-heading">Ready to join?</h3><p>Accept with the account that owns the invited email address. The team is added only after you accept.</p><div className="teamActions"><button className="primaryButton" type="button" disabled={disabled} onClick={() => void mutate({ action: 'accept', token: inviteToken })}>{pending === 'accept' ? 'Joining…' : 'Accept invitation'}</button><button className="secondaryButton" type="button" disabled={Boolean(pending)} onClick={() => { setInviteToken(null); clearShareLink() }}>Dismiss invitation</button></div></div></section>}

      {!authRequired && <form className="teamCreate" onSubmit={createTeam}><div><p className="panelLabel">Start a team</p><label htmlFor="team-name">Team name</label><p>Choose a name your people will recognize.</p></div><div className="teamCreateFields"><input id="team-name" name="teamName" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required autoComplete="off" disabled={disabled} placeholder="Your team name" /><button className="primaryButton" type="submit" disabled={disabled || name.trim().length < 2}><Plus aria-hidden="true" />{pending === 'create' ? 'Creating…' : 'Create team'}</button></div></form>}

      {loading && <p className="teamEmpty" role="status">Loading your teams…</p>}
      {!loading && snapshot?.teams.length === 0 && <div className="teamEmpty"><Users aria-hidden="true" /><h3>No teams yet.</h3><p>Create a team above, or open an invitation from a team owner.</p></div>}
      <div className="teamList">{snapshot?.teams.map((team) => {
        const owner = team.owner_id === snapshot.userId
        const link = shareLink?.teamId === team.id ? shareLink : null
        const brief = briefDrafts[team.id]
        const briefProblem = brief ? teamBriefProblem(team.id, brief) : null
        return (
          <article className="teamCard" key={team.id} aria-labelledby={`team-${team.id}`}>
            <header className="teamCardHeader"><div><p className="panelLabel">{owner ? 'Your team' : 'Team membership'}</p><h3 id={`team-${team.id}`}>{team.name}</h3></div><span className="teamRole">{owner ? 'Owner' : 'Member'}</span></header>
            <section className="teamBrief" aria-labelledby={`brief-${team.id}`}>
              <div className="teamSectionHeading"><h4 id={`brief-${team.id}`}>Team brief</h4><span>{brief ? 'Unsaved draft' : 'Saved brief'}</span></div>
              <p id={`brief-help-${team.id}`}>A shared place for plans and next steps. Every team member can edit it.</p>
              <form onSubmit={(event) => { event.preventDefault(); if (brief) void mutate(createTeamBriefSaveAction(team.id, brief)) }}>
                <label className="visuallyHidden" htmlFor={`brief-text-${team.id}`}>Team brief for {team.name}</label>
                <textarea id={`brief-text-${team.id}`} value={brief?.notes ?? team.notes} onChange={(event) => updateBriefDrafts({ type: 'edit', teamId: team.id, notes: event.target.value, savedRevision: team.notes_revision })} rows={5} maxLength={2000} disabled={disabled} readOnly={brief?.conflict} aria-describedby={`brief-help-${team.id} brief-limit-${team.id}${briefProblem ? ` brief-problem-${team.id}` : ''}`} aria-invalid={Boolean(briefProblem)} placeholder="What are you working on together?" />
                <p className="teamBriefLimit" id={`brief-limit-${team.id}`}>{(brief?.notes ?? team.notes).length.toLocaleString()} / 2,000 text limit. Emoji and some characters take extra space.</p>
                {briefProblem && <p className="teamBriefProblem" id={`brief-problem-${team.id}`} role="alert">{briefProblem}</p>}
                <div className="teamActions"><button className="primaryButton" type="submit" disabled={disabled || !brief || Boolean(briefProblem) || brief.notes === team.notes && brief.expectedRevision === team.notes_revision}>{pending === `save-notes:${team.id}` ? 'Saving.' : 'Save team brief'}</button>{brief && <button className="secondaryButton" type="button" disabled={disabled} onClick={() => void useSavedBrief(team.id)}>{pending === `use-saved:${team.id}` ? 'Loading saved brief.' : 'Use saved brief'}</button>}</div>
              </form>
              {brief && <details className="teamBriefSaved"><summary>Read the saved brief</summary><p>{team.notes || 'No brief has been saved yet.'}</p></details>}
            </section>
            <section aria-labelledby={`members-${team.id}`}><div className="teamSectionHeading"><h4 id={`members-${team.id}`}>Members</h4><span>{team.members.length}</span></div><ul className="teamMembers">{team.members.map((member) => (
              <li key={member.user_id}><div><strong>{member.user_id === snapshot.userId ? 'You' : member.role === 'owner' ? 'Team owner' : 'Team member'}</strong><span className="teamMemberRole">{member.role === 'owner' ? 'Owner' : 'Member'}</span><span className="teamMemberId">Member ID <code>{member.user_id}</code></span></div>{owner && member.user_id !== snapshot.userId && member.role !== 'owner' && <details className="teamConfirm"><summary>Remove member</summary><p>Remove this person from {team.name}?</p><button className="teamDanger" type="button" disabled={disabled} onClick={() => void mutate({ action: 'remove', teamId: team.id, memberId: member.user_id })}>Confirm removal</button></details>}</li>
            ))}</ul></section>

            {owner ? <section className="teamInvitations" aria-labelledby={`invitations-${team.id}`}><div className="teamSectionHeading"><h4 id={`invitations-${team.id}`}>Invitations</h4><span>Only you can manage these</span></div><form className="teamInviteForm" onSubmit={(event) => { event.preventDefault(); void mutate({ action: 'invite', teamId: team.id, email: (emails[team.id] ?? '').trim() }) }}><label htmlFor={`email-${team.id}`}>Invite by email</label><div className="teamInputRow"><input id={`email-${team.id}`} type="email" name="email" value={emails[team.id] ?? ''} onChange={(event) => setEmails((current) => ({ ...current, [team.id]: event.target.value }))} maxLength={254} required autoComplete="email" disabled={disabled} placeholder="person@example.com" /><button className="primaryButton" type="submit" disabled={disabled || !(emails[team.id] ?? '').trim()}>Create invite link</button></div><p>No email is sent. Share the link with this person yourself.</p></form>
              {link && <div className="teamShare" role="region" aria-label="New invitation link"><strong>Copy this link before leaving.</strong><p>The link is shown once. It expires {dateLabel(link.expiresAt)}.</p><label className="visuallyHidden" htmlFor={`link-${team.id}`}>Invitation link</label><textarea id={`link-${team.id}`} readOnly value={link.url} rows={3} onFocus={(event) => event.currentTarget.select()} autoComplete="off" spellCheck={false} /><div className="teamActions"><button className="secondaryButton" type="button" onClick={() => void copyLink()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? 'Copied' : 'Copy invite link'}</button><button className="teamTextButton" type="button" onClick={clearShareLink}>Hide link</button></div></div>}
              {team.invitations.length ? <ul className="teamInviteList">{team.invitations.map((invitation) => <li key={invitation.id}><div><strong>{invitation.email}</strong><span className="teamInviteStatus" data-state={teamInvitationStatus(invitation)}>{teamInvitationStatus(invitation) === 'pending' ? 'Pending' : teamInvitationStatus(invitation).replace(/^./, (letter) => letter.toUpperCase())}</span><small>{invitationLabel(invitation)}</small></div>{teamInvitationStatus(invitation) === 'pending' && <button className="teamTextButton" type="button" disabled={disabled} onClick={() => void mutate({ action: 'revoke', teamId: team.id, invitationId: invitation.id })}>Revoke invitation</button>}</li>)}</ul> : <p className="teamQuiet">No recent invitations.</p>}
            </section> : <div className="teamLeave"><p>The team owner manages invitations and membership.</p><details className="teamConfirm"><summary>Leave team</summary><p>Leave {team.name}? You will need a new invitation to return.</p><button className="teamDanger" type="button" disabled={disabled} onClick={() => void mutate({ action: 'leave', teamId: team.id })}>Confirm leave</button></details></div>}
          </article>
        )
      })}</div>
    </section>
  )
}
