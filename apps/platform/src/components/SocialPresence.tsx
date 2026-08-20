import type { CSSProperties, ReactNode } from 'react'
import { Facebook, Instagram, Linkedin } from 'lucide-react'

type SocialPlatform = 'x' | 'instagram' | 'facebook' | 'linkedin'

type SocialItem = {
  platform: SocialPlatform
  label: string
  handle: string
  href: string
  accent: string
}

const socialItems: readonly SocialItem[] = [
  {
    platform: 'x',
    label: 'X',
    handle: '@Xentrilo',
    href: 'https://twitter.com/Xentrilo',
    accent: '#f3f0e8',
  },
  {
    platform: 'instagram',
    label: 'Instagram',
    handle: '@ideasrealized',
    href: 'https://www.instagram.com/ideasrealized/',
    accent: '#ff6037',
  },
  {
    platform: 'facebook',
    label: 'Facebook',
    handle: '/ideasrealizedai',
    href: 'https://www.facebook.com/ideasrealizedai',
    accent: '#2cbcf0',
  },
  {
    platform: 'linkedin',
    label: 'LinkedIn',
    handle: 'Ideas Realized',
    href: 'https://www.linkedin.com/company/ideas-realized',
    accent: '#c9fb57',
  },
]

function XBrandMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

function SocialMark({ platform }: { platform: SocialPlatform }) {
  const props = { 'aria-hidden': true, strokeWidth: 1.9 } as const

  if (platform === 'x') return <XBrandMark />
  if (platform === 'instagram') return <Instagram {...props} />
  if (platform === 'facebook') return <Facebook {...props} />
  return <Linkedin {...props} />
}

function itemStyle(item: SocialItem, index: number) {
  return {
    '--social-accent': item.accent,
    '--social-index': index,
  } as CSSProperties
}

function SocialControl({ item, inline = false }: { item: SocialItem; inline?: boolean }) {
  const content: ReactNode = (
    <>
      {!inline ? (
        <span className="socialReveal" aria-hidden="true">
          <span>{item.label}</span>
          <strong>{item.handle}</strong>
        </span>
      ) : null}
      <span className="socialIconCard"><SocialMark platform={item.platform} /></span>
    </>
  )

  return (
    <a
      className={inline ? 'socialInlineControl' : 'socialDockControl'}
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ideas Realized on ${item.label}, ${item.handle}`}
    >
      {content}
    </a>
  )
}

export function SocialPresenceDock() {
  return (
    <nav className="socialDock" aria-label="Ideas Realized social profiles">
      <span className="socialDockCode" aria-hidden="true">IR / SIGNAL</span>
      <ul>
        {socialItems.map((item, index) => (
          <li key={item.platform} style={itemStyle(item, index)}>
            <SocialControl item={item} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SocialPresenceInline() {
  return (
    <nav className="socialInline" aria-label="Ideas Realized social profiles in the footer">
      <ul>
        {socialItems.map((item, index) => (
          <li key={item.platform} style={itemStyle(item, index)}>
            <SocialControl item={item} inline />
          </li>
        ))}
      </ul>
    </nav>
  )
}
