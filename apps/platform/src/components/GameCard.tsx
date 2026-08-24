'use client'

import Image from 'next/image'
import { ArrowUpRight, Clock3, Play } from 'lucide-react'
import type { CSSProperties, PointerEvent } from 'react'
import type { Game } from '@/data/games'

type GameCardProps = {
  game: Game
  index: number
  compact?: boolean
}

export function GameCard({ game, index, compact = false }: GameCardProps) {
  const moveCard = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === 'touch') return

    const card = event.currentTarget
    const bounds = card.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))

    card.style.setProperty('--card-rx', `${(0.5 - y) * 8}deg`)
    card.style.setProperty('--card-ry', `${(x - 0.5) * 11}deg`)
    card.style.setProperty('--glow-x', `${x * 100}%`)
    card.style.setProperty('--glow-y', `${y * 100}%`)
  }

  const resetCard = (event: PointerEvent<HTMLAnchorElement>) => {
    const card = event.currentTarget
    card.style.removeProperty('--card-rx')
    card.style.removeProperty('--card-ry')
    card.style.removeProperty('--glow-x')
    card.style.removeProperty('--glow-y')
  }

  const content = (
    <>
      <div className="gameCardVisual" data-status={game.status} style={{ '--accent': game.accent } as CSSProperties}>
        {game.image ? (
          <Image
            src={game.image}
            alt=""
            fill
            sizes={compact ? '(max-width: 760px) 86vw, 32vw' : '(max-width: 760px) 86vw, 46vw'}
            className="gameCardImage"
            style={game.imagePosition ? { objectPosition: game.imagePosition } : undefined}
          />
        ) : (
          <div className="gameMonogram" aria-hidden="true">{game.title.slice(0, 2)}</div>
        )}
        <span className="gameIndex">0{index + 1}</span>
        {game.status === 'external' ? <span className="gameCaptureLabel">Live site capture</span> : null}
        <span className="gameStatus">
          {game.status === 'soon' ? <Clock3 size={13} /> : game.status === 'external' ? <ArrowUpRight size={13} /> : <Play size={12} fill="currentColor" />}
          {game.meta}
        </span>
        <span className="gameLaunchKey" aria-hidden="true">
          {game.status === 'soon' ? <Clock3 /> : game.status === 'external' ? <ArrowUpRight /> : <Play fill="currentColor" />}
        </span>
      </div>
      <div className="gameCardCopy">
        <p>{game.eyebrow}</p>
        <h3>{game.title}</h3>
        <span className="gameDescription">{game.description}</span>
      </div>
    </>
  )

  if (game.status === 'soon') {
    return (
      <article className={`gameCard gameCardSoon ${compact ? 'gameCardCompact' : ''}`} aria-disabled="true">
        <span className="soonSlash" aria-hidden="true">COMING SOON</span>
        {content}
      </article>
    )
  }

  return (
    <a
      className={`gameCard ${compact ? 'gameCardCompact' : ''}`}
      href={game.href}
      target={game.status === 'external' ? '_blank' : undefined}
      rel={game.status === 'external' ? 'noreferrer' : undefined}
      aria-label={`${game.title}: ${game.meta}`}
      onPointerMove={moveCard}
      onPointerLeave={resetCard}
      onPointerCancel={resetCard}
    >
      {content}
    </a>
  )
}
