import type { Metadata, Viewport } from 'next'
import { SocialPresenceDock } from '@/components/SocialPresence'
import './globals.css'

const adsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim()
const verifiedAdsenseClient = adsenseClient && /^ca-pub-\d{16}$/.test(adsenseClient)
  ? adsenseClient
  : undefined

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'aVOIDgame.io',
  url: 'https://avoidgame.io/',
  description: 'Independent browser games from Ideas Realized.',
  creator: {
    '@type': 'Organization',
    name: 'Ideas Realized',
    url: 'https://ideas-realized.com/',
    sameAs: [
      'https://www.linkedin.com/company/ideas-realized',
      'https://www.facebook.com/ideasrealizedai',
      'https://www.instagram.com/ideasrealized/',
      'https://twitter.com/Xentrilo',
    ],
  },
}

export const metadata: Metadata = {
  metadataBase: new URL('https://avoidgame.io'),
  applicationName: 'aVOIDgame.io',
  title: {
    default: 'aVOIDgame.io | Small games. Sharp ideas.',
    template: '%s | aVOIDgame.io',
  },
  description: 'Play the aVOID originals and discover other games by Ideas Realized.',
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'aVOIDgame.io | Small games. Sharp ideas.',
    description: 'Play the aVOID originals and discover other games by Ideas Realized.',
    url: 'https://avoidgame.io',
    siteName: 'aVOIDgame.io',
    images: [{ url: '/avoid-hero.webp', width: 900, height: 900 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'aVOIDgame.io | Small games. Sharp ideas.',
    description: 'Play the aVOID originals and discover other games by Ideas Realized.',
    images: ['/avoid-hero.webp'],
  },
  other: verifiedAdsenseClient
    ? { 'google-adsense-account': verifiedAdsenseClient }
    : undefined,
}

export const viewport: Viewport = {
  themeColor: '#f4f0e8',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        {children}
        <SocialPresenceDock />
      </body>
    </html>
  )
}
