import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    { url: 'https://avoidgame.io', lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: 'https://avoidgame.io/voidavoid/', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://avoidgame.io/wreckavoid/', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://avoidgame.io/wordavoid/', lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ]
}
