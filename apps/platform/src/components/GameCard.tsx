import Image from 'next/image'
import { ArrowRight, ArrowUpRight, Clock3, Play } from 'lucide-react'
import type { Game } from '@/data/games'

type GameCardProps = {
  game: Game
  index: number
  compact?: boolean
}

export function GameCard({ game, index, compact = false }: GameCardProps) {
  const content = (
    <>
      <div className="gameCardVisual" data-status={game.status} style={{ '--accent': game.accent } as React.CSSProperties}>
        {game.image ? (
          <Image
            src={game.image}
            alt=""
            fill
            sizes={compact ? '(max-width: 760px) 86vw, 32vw' : '(max-width: 760px) 86vw, 46vw'}
            className="gameCardImage"
          />
        ) : (
          <div className="gameMonogram" aria-hidden="true">{game.title.slice(0, 2)}</div>
        )}
        <span className="gameIndex">0{index + 1}</span>
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
        <span className="gameAction" aria-hidden="true">
          {game.status === 'soon' ? 'Hold position' : game.status === 'external' ? 'Visit game' : 'Launch game'}
          {game.status === 'soon' ? <Clock3 /> : <ArrowRight />}
        </span>
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
    >
      {content}
    </a>
  )
}
