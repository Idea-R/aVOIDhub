import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://avoidgame.io'),
  title: {
    default: 'aVOIDgame.io — Small games. Sharp ideas.',
    template: '%s | aVOIDgame.io',
  },
  description: 'Play the aVOID originals and discover other games by Ideas Realized.',
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
