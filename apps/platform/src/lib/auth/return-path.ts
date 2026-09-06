const fallbackPath = '/account/'

type ReturnPathValue = string | string[] | null | undefined

function firstValue(value: ReturnPathValue): string | null | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function getSafeReturnPath(value: ReturnPathValue): string {
  const candidate = firstValue(value)
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return fallbackPath
  }

  try {
    const decoded = decodeURIComponent(candidate)
    if (decoded.startsWith('//') || decoded.includes('\\')) return fallbackPath

    const parsed = new URL(candidate, 'https://avoidgame.io')
    if (parsed.origin !== 'https://avoidgame.io') return fallbackPath
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallbackPath
  }
}

export function getLoginReturnPath(
  next: ReturnPathValue,
  legacyReturnTo: ReturnPathValue,
): string {
  return getSafeReturnPath(next !== undefined ? next : legacyReturnTo)
}
