import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormEvent } from 'react'

// Exercise the component's real handlers and JSX with persistent hook state.
// No DOM library is installed; these checks do not claim browser rendering coverage.
const fixture = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, busy: { current: false },
  create: vi.fn(), otp: vi.fn(), oauth: vi.fn(), available: vi.fn(), config: vi.fn(),
  effects: [] as Array<() => void | (() => void)>,
}))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = fixture.cursor++
    if (!(index in fixture.states)) fixture.states[index] = initial
    return [fixture.states[index], (value: unknown) => { fixture.states[index] = value }]
  },
  useRef: () => fixture.busy,
  useEffect: (effect: () => void | (() => void)) => { fixture.effects.push(effect) },
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: fixture.create }))
vi.mock('@/lib/auth/google-provider', () => ({ isGoogleSignInAvailable: fixture.available }))
vi.mock('@/lib/env', () => ({ getPublicSupabaseConfig: fixture.config }))
import { AuthForm } from '@/components/AuthForm'

type Node = { type: unknown; props: Record<string, any> }
let enabled = true
let nextPath = '/teams/?view=mine'
function render() {
  fixture.cursor = 0
  return AuthForm({ enabled, nextPath }) as Node
}
function find(node: Node, predicate: (node: Node) => boolean): Node {
  if (predicate(node)) return node
  for (const child of [node.props.children].flat(Infinity)) {
    if (child && typeof child === 'object' && 'props' in child) {
      try { return find(child, predicate) } catch { /* Search remaining siblings. */ }
    }
  }
  throw new Error('Element not found')
}
const google = (tree = render()) => find(tree, node => node.type === 'button' && node.props.type === 'button')
const email = (tree = render()) => find(tree, node => node.type === 'input')
const submit = () => render().props.onSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>)
const status = () => find(render(), node => node.props.className === 'formStatus').props.children
function idle() {
  expect(render().props['aria-busy']).toBe(false)
  expect(google().props.disabled).toBe(false)
}
beforeEach(() => {
  vi.resetAllMocks()
  fixture.states = []
  fixture.busy.current = false
  fixture.effects = []
  enabled = true
  nextPath = '/teams/?view=mine'
  vi.stubGlobal('window', { location: { origin: 'https://avoidgame.io' } })
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://avoidgame.io')
  fixture.config.mockReturnValue({ url: 'https://fixture.supabase.co', publishableKey: 'fixture-public' })
  fixture.create.mockReturnValue({ auth: { signInWithOtp: fixture.otp, signInWithOAuth: fixture.oauth } })
  fixture.available.mockResolvedValue(true)
  fixture.oauth.mockResolvedValue({ data: { url: 'https://fixture.supabase.co/auth/v1/authorize?provider=google' }, error: null })
  fixture.otp.mockResolvedValue({ error: null })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('authentication form actions', () => {
  it('does no provider, configuration or auth work just by rendering', () => {
    render()
    expect(fixture.available).not.toHaveBeenCalled()
    expect(fixture.config).not.toHaveBeenCalled()
    expect(fixture.create).not.toHaveBeenCalled()
    expect(google().props.type).toBe('button')
  })
  it('keeps a disabled review build inert even if handlers are invoked', async () => {
    enabled = false
    expect(google().props.disabled).toBe(true)
    await google().props.onClick()
    await submit()
    expect(fixture.create).not.toHaveBeenCalled()
    expect(fixture.available).not.toHaveBeenCalled()
  })
  it('opens OAuth on click through the current client with only provider and safe redirect', async () => {
    await google().props.onClick()
    expect(fixture.available).toHaveBeenCalledExactlyOnceWith('https://fixture.supabase.co', 'fixture-public')
    expect(fixture.oauth).toHaveBeenCalledExactlyOnceWith({
      provider: 'google', options: { redirectTo: 'https://avoidgame.io/auth/callback?next=%2Fteams%2F%3Fview%3Dmine' },
    })
    expect(render().props['aria-busy']).toBe(true)
    expect(google().props.disabled).toBe(true)
    expect(email().props.disabled).toBe(true)
    expect(status()).toBe('Opening Google sign-in.')
    await google().props.onClick()
    await submit()
    expect(fixture.oauth).toHaveBeenCalledOnce()
    expect(fixture.otp).not.toHaveBeenCalled()
  })
  it('locks both actions immediately while availability is pending', async () => {
    let finish!: (value: boolean) => void
    fixture.available.mockReturnValue(new Promise<boolean>(resolve => { finish = resolve }))
    const click = google().props.onClick()
    await google().props.onClick()
    await submit()
    expect(fixture.available).toHaveBeenCalledOnce()
    expect(render().props['aria-busy']).toBe(true)
    expect(fixture.create).not.toHaveBeenCalled()
    finish(false)
    await click
    idle()
  })
  it('unlocks a restored page after an interrupted provider navigation and cleans its listener', async () => {
    const add = vi.fn()
    const remove = vi.fn()
    vi.stubGlobal('window', { location: { origin: 'https://avoidgame.io' }, addEventListener: add, removeEventListener: remove })
    const tree = render()
    const cleanup = fixture.effects[0]()
    expect(add).toHaveBeenCalledWith('pageshow', expect.any(Function))
    await google(tree).props.onClick()
    const restore = add.mock.calls[0][1]
    restore({ persisted: false })
    expect(render().props['aria-busy']).toBe(true)
    restore({ persisted: true })
    idle()
    expect(status()).toContain('interrupted')
    expect(fixture.oauth).toHaveBeenCalledOnce()
    if (cleanup) cleanup()
    expect(remove).toHaveBeenCalledWith('pageshow', restore)
  })
  it.each(['disabled', 'missing config'])('keeps email usable when Google has %s', async mode => {
    if (mode === 'disabled') fixture.available.mockResolvedValue(false)
    else fixture.config.mockReturnValue(null)
    await google().props.onClick()
    expect(status()).toContain('not enabled')
    expect(fixture.oauth).not.toHaveBeenCalled()
    idle()
    email().props.onChange({ target: { value: 'player@example.com' } })
    await submit()
    expect(fixture.otp).toHaveBeenCalledOnce()
    expect(status()).toContain('Check your inbox')
  })
  it.each(['settings', 'returned OAuth error', 'thrown OAuth error', 'missing URL', 'client'])('recovers from %s', async mode => {
    if (mode === 'settings') fixture.available.mockRejectedValue(new Error('fixture'))
    if (mode === 'returned OAuth error') fixture.oauth.mockResolvedValue({ data: { url: null }, error: { message: 'fixture' } })
    if (mode === 'thrown OAuth error') fixture.oauth.mockRejectedValue(new Error('fixture'))
    if (mode === 'missing URL') fixture.oauth.mockResolvedValue({ data: { url: null }, error: null })
    if (mode === 'client') fixture.create.mockImplementation(() => { throw new Error('fixture') })
    await google().props.onClick()
    expect(status()).toContain('could not open')
    idle()
  })
  it('fails before contacting a provider when deployment configuration conflicts', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://deploy-preview-65--coruscating-squirrel-a47ad9.netlify.app' } })
    await google().props.onClick()
    expect(fixture.available).not.toHaveBeenCalled()
    expect(fixture.create).not.toHaveBeenCalled()
    idle()
  })
  it('preserves the email OTP contract and safe next path', async () => {
    nextPath = '//evil.example'
    email().props.onChange({ target: { value: 'player@example.com' } })
    await submit()
    expect(fixture.otp).toHaveBeenCalledExactlyOnceWith({
      email: 'player@example.com', options: { emailRedirectTo: 'https://avoidgame.io/auth/callback?next=%2Faccount%2F' },
    })
    expect(fixture.available).not.toHaveBeenCalled()
    expect(fixture.oauth).not.toHaveBeenCalled()
    expect(status()).toContain('Check your inbox')
    idle()
  })
  it('prevents duplicate email submission and Google while email is pending', async () => {
    let finish!: (value: { error: null }) => void
    fixture.otp.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const sending = submit()
    await submit()
    await google().props.onClick()
    expect(fixture.otp).toHaveBeenCalledOnce()
    expect(fixture.available).not.toHaveBeenCalled()
    expect(email().props.disabled).toBe(true)
    finish({ error: null })
    await sending
    idle()
  })
  it.each(['returned', 'thrown'])('recovers from %s email failure', async mode => {
    if (mode === 'returned') fixture.otp.mockResolvedValue({ error: { message: 'fixture' } })
    else fixture.otp.mockRejectedValue(new Error('fixture'))
    await submit()
    expect(status()).toContain('could not be sent')
    idle()
  })
})
