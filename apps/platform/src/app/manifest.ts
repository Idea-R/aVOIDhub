import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'aVOIDgame.io',
    short_name: 'aVOID',
    description: 'Independent browser games from Ideas Realized.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f0e8',
    theme_color: '#f4f0e8',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/brand/avoid-meteor-mark.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
