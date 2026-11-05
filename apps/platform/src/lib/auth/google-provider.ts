/** Called only after the user chooses Google; never during page rendering. */
export async function isGoogleSignInAvailable(url: string, publishableKey: string): Promise<boolean> {
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok) throw new Error('provider_check_failed')
  const settings = await response.json()
  if (typeof settings?.external?.google !== 'boolean') throw new Error('invalid_provider_settings')
  return settings.external.google
}
