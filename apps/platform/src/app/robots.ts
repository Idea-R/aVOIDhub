import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/account/', '/admin/', '/teams/', '/auth/', '/results/', '/creators/dashboard/', '/creators/submit/'] },
    sitemap: 'https://avoidgame.io/sitemap.xml',
  }
}
