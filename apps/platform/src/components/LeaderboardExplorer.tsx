'use client'
import { useSearchParams } from 'next/navigation'
import { rankedGameRegistry, type RankedGameKey } from '@/lib/games/registry'
import { resolveBoard } from '@/lib/leaderboards/contract'
import { PublicScoreBoard } from './PublicScoreBoard'
export function LeaderboardExplorer() {
  const params = useSearchParams(), fallback = resolveBoard(params.get('game'), undefined) ?? resolveBoard('voidavoid', undefined)!
  const selection = resolveBoard(fallback.game, params.get('mode') ?? undefined) ?? fallback, game = rankedGameRegistry[selection.game]
  return <>
    <nav className="gameTabs" aria-label="Choose a leaderboard">{(Object.keys(rankedGameRegistry) as RankedGameKey[]).map(key => <a key={key} href={`/leaderboards/?game=${key}`} aria-current={key === selection.game ? 'page' : undefined}>{rankedGameRegistry[key].name}</a>)}</nav>
    {game.modes.length > 1 && <nav className="gameTabs" aria-label="Choose a game mode">{game.modes.map(option => <a key={option.key} href={`/leaderboards/?game=${selection.game}&mode=${option.key}`} aria-current={option.key === selection.mode ? 'page' : undefined}>{option.label}</a>)}</nav>}
    <section className="leaderboardPanel" aria-label={`${game.name} ${selection.mode} scores`}><PublicScoreBoard key={`${selection.game}:${selection.mode}`} {...selection} autoLoad personal /></section>
  </>
}
