import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Trophy, TrendingUp, Users, Crown, Medal, Award, Gamepad2, ChevronRight } from "lucide-react"
import LeaderboardDashboard from "../components/LeaderboardDashboard"
import { getGames } from '../lib/supabase'

const LeaderboardsPage = () => {
  const { gameKey } = useParams<{ gameKey?: string }>()
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadGames = async () => {
      const { data, error } = await getGames()
      if (data) {
        setGames(data)
      }
      setLoading(false)
    }
    loadGames()
  }, [])

  return (
    <div className="min-h-screen bg-space pt-8 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl mb-6">
            <Trophy className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold glow-text mb-4">
            {gameKey ? `${gameKey.toUpperCase()} Leaderboard` : 'Global Leaderboards'}
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            {gameKey 
              ? `Top players in ${gameKey.toUpperCase()}` 
              : 'Champions across all aVOID games'
            }
          </p>
        </div>

        {/* Game Navigation */}
        {!gameKey && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Choose a Game</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {games.map((game) => (
                <a
                  key={game.id}
                  href={`/leaderboards/${game.game_key}`}
                  className="group bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-purple-300">
                        {game.name}
                      </h3>
                      <p className="text-sm text-white/60 mt-1">
                        View rankings
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-purple-400" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Leaderboard Dashboard */}
        <LeaderboardDashboard
          gameKey={gameKey}
          showUserStats={true}
        />
      </div>
    </div>
  )
}

export default LeaderboardsPage
