const fallbackPath = '/account/'

export function getSafeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallbackPath
  }

  try {
    const parsed = new URL(value, 'https://avoidgame.io')
    if (parsed.origin !== 'https://avoidgame.io') return fallbackPath
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallbackPath
  }
}
