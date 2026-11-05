import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { TeamWorkspace } from '../../src/components/TeamWorkspace'
import { PublicScoreBoard } from '../../src/components/PublicScoreBoard'
import { AuthForm } from '../../src/components/AuthForm'
import { setFixtureUser } from './auth'
import '../../src/app/globals.css'
import '../../src/app/teams/teams.css'

const owner = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002'
function Fixture() {
  const [status, setStatus] = useState('')
  async function control(userId: string | null) { await fetch('/__fixture/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId }) }); setFixtureUser(userId) }
  return <main className="sectionFrame" style={{ paddingBlock: 24 }}>
    <aside style={{ border: '2px dashed #777', padding: 12, marginBottom: 24 }} aria-label="Local test controls">
      <h1>Local fixtures · synthetic data only</h1><div className="buttonRow">
        <button onClick={() => void control(owner)}>Fixture: owner</button><button onClick={() => void control(other)}>Fixture: other account</button><button onClick={() => void control(null)}>Fixture: sign out</button>
        <button onClick={() => void fetch('/__fixture/control', { method: 'POST', body: JSON.stringify({ delayNext: true }) })}>Fixture: delay next read</button>
        <button onClick={() => void fetch('/__fixture/control', { method: 'POST', body: JSON.stringify({ editBrief: true }) })}>Fixture: concurrent brief edit</button>
        <button onClick={async () => setStatus(JSON.stringify(await (await fetch('/__fixture/status')).json()))}>Inspect fixture requests</button>
        <button onClick={() => void fetch('/__fixture/control', { method: 'POST', body: JSON.stringify({ authMode: 'disabled' }) })}>Fixture: Google disabled</button>
        <button onClick={() => void fetch('/__fixture/control', { method: 'POST', body: JSON.stringify({ authMode: 'failed' }) })}>Fixture: Google fails</button>
        <button onClick={() => void fetch('/__fixture/control', { method: 'POST', body: JSON.stringify({ authMode: 'enabled' }) })}>Fixture: Google available</button>
        <button onClick={() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))}>Fixture: interrupted return</button>
      </div><output style={{ display: 'block', overflowWrap: 'anywhere' }}>{status}</output>
    </aside>
    <h2>Local sign-in fixture</h2><AuthForm enabled nextPath="/teams/" />
    <h2>Public score panel</h2><PublicScoreBoard game="voidavoid" mode="endless" personal />
    <h2 style={{ marginTop: 32 }}>Team workspace</h2><TeamWorkspace initialUserId={new URLSearchParams(window.location.search).has('signed-out') ? null : owner}/>
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
