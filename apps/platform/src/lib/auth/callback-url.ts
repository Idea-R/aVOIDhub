import { getSafeReturnPath } from './return-path'

const previewHost = /^deploy-preview-\d+--coruscating-squirrel-a47ad9\.netlify\.app$/

function allowedOrigin(url: URL, development: boolean): boolean {
  if (url.username || url.password) return false
  if (url.protocol === 'https:' && !url.port && (url.hostname === 'avoidgame.io' || previewHost.test(url.hostname))) return true
  return development && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
}

/** Never move a PKCE callback or its session between deployments. */
export function getAuthOrigin(requestUrl: string, configuredUrl?: string, development = false): string | null {
  try {
    const requested = new URL(requestUrl)
    if (!allowedOrigin(requested, development)) return null
    if (configuredUrl?.trim()) {
      const configured = new URL(configuredUrl.trim())
      if (!allowedOrigin(configured, development) || configuredUrl.trim().replace(/\/$/, '') !== configured.origin || configured.origin !== requested.origin) return null
    }
    return requested.origin
  } catch {
    return null
  }
}

export function getAuthReturnPath(value: string | null | undefined): string {
  if (!value || value.length > 2048 || /[\\\x00-\x20\x7f]/.test(value)) return '/account/'
  const path = getSafeReturnPath(value)
  if (path.startsWith('//')) return '/account/'
  try {
    const pathname = decodeURIComponent(new URL(path, 'https://avoidgame.io').pathname)
    if (pathname.startsWith('//') || /[\\\x00-\x20\x7f]/.test(pathname) || /%2f|%5c|%0[0-9a-f]|%1[0-9a-f]|%20|%7f/i.test(pathname)) return '/account/'
    if (['/login', '/auth/callback'].includes(pathname.replace(/\/+$/, ''))) return '/account/'
    return path
  } catch {
    return '/account/'
  }
}

export function getAuthCallbackUrl(requestUrl: string, nextPath: string, configuredUrl?: string, development = false): string {
  const origin = getAuthOrigin(requestUrl, configuredUrl, development)
  if (!origin) throw new Error('invalid_auth_origin')
  const callback = new URL('/auth/callback', origin)
  callback.searchParams.set('next', getAuthReturnPath(nextPath))
  return callback.toString()
}
