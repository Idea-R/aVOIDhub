import type { Metadata, Viewport } from 'next'
import './globals.css'

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
      'https://twitter.com/Xentrilo',
    ],
  },
}

export const metadata: Metadata = {
  metadataBase: new URL('https://avoidgame.io'),
  applicationName: 'aVOIDgame.io',
  title: {
    default: 'aVOIDgame.io — Small games. Sharp ideas.',
    template: '%s | aVOIDgame.io',
  },
  description: 'Play the aVOID originals and discover other games by Ideas Realized.',
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'aVOIDgame.io — Small games. Sharp ideas.',
    description: 'Play the aVOID originals and discover other games by Ideas Realized.',
    url: 'https://avoidgame.io',
    siteName: 'aVOIDgame.io',
    images: [{ url: '/avoid-hero.webp', width: 900, height: 900 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'aVOIDgame.io — Small games. Sharp ideas.',
    description: 'Play the aVOID originals and discover other games by Ideas Realized.',
    images: ['/avoid-hero.webp'],
  },
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
      </body>
    </html>
  )
}
