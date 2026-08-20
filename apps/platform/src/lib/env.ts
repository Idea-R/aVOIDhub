const supabaseUrlPattern = /^https:\/\/[a-z0-9]+\.supabase\.co$/

export type PublicSupabaseConfig = {
  url: string
  publishableKey: string
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey || !supabaseUrlPattern.test(url)) return null
  return { url, publishableKey }
}

export function requirePublicSupabaseConfig(): PublicSupabaseConfig {
  const config = getPublicSupabaseConfig()
  if (!config) {
    throw new Error('Supabase is not configured for the platform runtime.')
  }
  return config
}

export function requireSupabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not configured.')
  return key
}

export function isPlatformRuntimeConfigured(): boolean {
  return Boolean(getPublicSupabaseConfig())
}

export function getSiteUrl(requestUrl?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (requestUrl) return new URL(requestUrl).origin
  return 'http://localhost:3000'
}
