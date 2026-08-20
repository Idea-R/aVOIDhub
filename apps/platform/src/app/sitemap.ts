import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    { url: 'https://avoidgame.io', lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: 'https://avoidgame.io/leaderboards/', lastModified, changeFrequency: 'daily', priority: 0.8 },
    { url: 'https://avoidgame.io/membership/', lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://avoidgame.io/creators/apply/', lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://avoidgame.io/voidavoid/', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://avoidgame.io/wreckavoid/', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://avoidgame.io/wordavoid/', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://avoidgame.io/privacy/', lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://avoidgame.io/terms/', lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
