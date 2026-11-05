type Listener = (event: string, session: { user: { id: string } } | null) => void
const listeners = new Set<Listener>()
export function setFixtureUser(userId: string | null) { for (const listener of listeners) listener(userId ? 'SIGNED_IN' : 'SIGNED_OUT', userId ? { user: { id: userId } } : null) }
export function createClient() { return { auth: { onAuthStateChange(listener: Listener) { listeners.add(listener); return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } } } } } }
