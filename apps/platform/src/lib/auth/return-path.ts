const fallbackPath = '/account/'
export function getSafeReturnPath(value: string | null | undefined): string {
  if (!value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return fallbackPath
  try {
    // Reject encoded separators/control bytes as well as literal browser URL normalization tricks.
    const decoded = decodeURIComponent(value.split(/[?#]/, 1)[0])
    if (decoded.startsWith('//') || /[\\\x00-\x20]/.test(decoded)) return fallbackPath
    const parsed = new URL(value, 'https://avoidgame.io')
    if (parsed.origin !== 'https://avoidgame.io') return fallbackPath
    if (['/login','/auth/callback'].includes(parsed.pathname.replace(/\/$/, ''))) return fallbackPath
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch { return fallbackPath }
}


/** Keep approved project deploy previews on their own cookie origin after OAuth. */
export function getAuthCallbackOrigin(requestUrl:string,canonicalUrl:string,development=false):string {
  try {
    const requested=new URL(requestUrl)
    if(requested.protocol==='https:'&&(requested.hostname==='avoidgame.io'||/^deploy-preview-\d+--coruscating-squirrel-a47ad9\.netlify\.app$/.test(requested.hostname)))return requested.origin
    if(development&&requested.protocol==='http:'&&['localhost','127.0.0.1'].includes(requested.hostname))return requested.origin
    return new URL(canonicalUrl).origin
  } catch {return 'https://avoidgame.io'}
}
