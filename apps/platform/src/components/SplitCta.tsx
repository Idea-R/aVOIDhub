'use client'

import { ArrowRight, Gamepad2, Sparkles } from 'lucide-react'
import { useState } from 'react'

export function SplitCta() {
  const [side, setSide] = useState<'games' | 'creators'>('games')

  return (
    <div
      className="splitCta"
      data-side={side}
      role="group"
      aria-label="Explore games or creator hosting"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        setSide(event.clientX - bounds.left < bounds.width / 2 ? 'games' : 'creators')
      }}
    >
      <span className="splitCtaGlow" aria-hidden="true" />
      <a className="splitCtaHalf" href="#games" aria-label="Browse playable games">
        <Gamepad2 size={17} aria-hidden="true" />
        <span>Play</span>
      </a>
      <a className="splitCtaHalf" href="#creators" aria-label="Preview creator hosting">
        <Sparkles size={16} aria-hidden="true" />
        <span>Publish</span>
        <ArrowRight size={15} aria-hidden="true" />
      </a>
    </div>
  )
}
