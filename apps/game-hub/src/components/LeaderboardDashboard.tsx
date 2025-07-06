import React, { useState, useEffect } from 'react'
import { Trophy, Users, TrendingUp, Star, Crown, Medal, Award, Gamepad2, BarChart3, Clock, Target } from 'lucide-react'
import { enhancedLeaderboardService, type GameStats, type UserRanking } from '../services/EnhancedLeaderboardService'
import { useAuth } from '../contexts/AuthContext'
import EnhancedLeaderboard from './EnhancedLeaderboard'

interface LeaderboardDashboardProps {
  gameKey?: string
  showUserStats?: boolean
}

const LeaderboardDashboard: React.FC<LeaderboardDashboardProps> = ({
  gameKey,
  showUserStats = true
}) => {
  const [gameStats, setGameStats] = useState<GameStats[]>([])
  const [userRankings, setUserRankings] = useState<UserRanking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'global' | 'game'>('global')
  const { user, isAuthenticated } = useAuth()

  useEffect(() => {
    loadDashboardData()
  }, [gameKey, isAuthenticated])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Load game statistics
      const statsResult = await enhancedLeaderboardService.getGameStatistics()
      if (statsResult.success) {
        setGameStats(statsResult.data)
      }

      // Load user rankings if authenticated and user stats enabled
      if (isAuthenticated && showUserStats) {
        const rankingsResult = await enhancedLeaderboardService.getUserRankings()
        if (rankingsResult.success) {
          setUserRankings(rankingsResult.data)
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTotalStats = () => {
    const totals = gameStats.reduce(
      (acc, game) => ({
        totalPlayers: acc.totalPlayers + game.total_players,
        totalGames: acc.totalGames + game.total_games_played,
        totalScores: acc.totalScores + game.total_scores_submitted,
        highestScore: Math.max(acc.highestScore, game.highest_score)
      }),
      { totalPlayers: 0, totalGames: 0, totalScores: 0, highestScore: 0 }
    )
    
    // Remove duplicates from total players (users who play multiple games)
    const uniquePlayers = new Set(gameStats.flatMap(g => Array(g.total_players).fill(0))).size
    totals.totalPlayers = Math.max(uniquePlayers, totals.totalPlayers / gameStats.length || 0)
    
    return totals
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toLocaleString()
  }

  const getRankBadge = (rank: number, totalPlayers: number) => {
    const percentile = ((totalPlayers - rank + 1) / totalPlayers) * 100
    
    if (rank === 1) return { color: 'text-yellow-500', icon: Crown, label: 'Champion' }
    if (rank <= 3) return { color: 'text-orange-500', icon: Medal, label: 'Podium' }
    if (percentile >= 90) return { color: 'text-purple-500', icon: Star, label: 'Elite' }
    if (percentile >= 75) return { color: 'text-blue-500', icon: Award, label: 'Expert' }
    if (percentile >= 50) return { color: 'text-green-500', icon: Target, label: 'Advanced' }
    return { color: 'text-gray-500', icon: Users, label: 'Player' }
  }

  const totalStats = getTotalStats()

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-white/10 rounded w-1/2"></div>
            </div>
          ))}
        </div>
        <div className="bg-white/5 rounded-lg p-6 animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-white/10 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Global Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-600/10 to-blue-800/10 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold text-blue-400">{formatNumber(totalStats.totalPlayers)}</span>
          </div>
          <h3 className="font-semibold text-white mb-1">Total Players</h3>
          <p className="text-sm text-white/60">Across all games</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-600/10 to-green-800/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Gamepad2 className="w-8 h-8 text-green-400" />
            <span className="text-2xl font-bold text-green-400">{formatNumber(totalStats.totalGames)}</span>
          </div>
          <h3 className="font-semibold text-white mb-1">Games Played</h3>
          <p className="text-sm text-white/60">All time</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-600/10 to-purple-800/10 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-purple-400" />
            <span className="text-2xl font-bold text-purple-400">{formatNumber(totalStats.totalScores)}</span>
          </div>
          <h3 className="font-semibold text-white mb-1">Scores Submitted</h3>
          <p className="text-sm text-white/60">Total attempts</p>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-600/10 to-yellow-800/10 border border-yellow-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Crown className="w-8 h-8 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-400">{formatNumber(totalStats.highestScore)}</span>
          </div>
          <h3 className="font-semibold text-white mb-1">Highest Score</h3>
          <p className="text-sm text-white/60">Network record</p>
        </div>
      </div>

      {/* User Personal Stats */}
      {isAuthenticated && showUserStats && userRankings.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="flex items-center justify-center p-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-2xl">
              <BarChart3 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Your Performance</h2>
              <p className="text-white/60">Rankings across all games</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userRankings.map((ranking) => {
              const badge = getRankBadge(ranking.rank_position, ranking.total_players)
              const BadgeIcon = badge.icon
              
              return (
                <div
                  key={ranking.game_key}
                  className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white capitalize">
                      {ranking.game_key.replace('avoid', ' Avoid')}
                    </h3>
                    <div className={`flex items-center space-x-1 ${badge.color}`}>
                      <BadgeIcon className="w-4 h-4" />
                      <span className="text-xs font-medium">{badge.label}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Best Score:</span>
                      <span className="text-white font-semibold">{ranking.best_score.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Rank:</span>
                      <span className="text-white font-semibold">#{ranking.rank_position} / {ranking.total_players}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Percentile:</span>
                      <span className="text-green-400 font-semibold">{ranking.percentile}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Game Statistics */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex items-center justify-center p-3 bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-2xl">
            <BarChart3 className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Game Statistics</h2>
            <p className="text-white/60">Performance metrics for each game</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gameStats.map((game) => (
            <div
              key={game.game_key}
              className="bg-white/5 border border-white/10 rounded-lg p-5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white capitalize">
                  {game.game_key.replace('avoid', ' Avoid')}
                </h3>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 text-white/60" />
                  <span className="text-xs text-white/60">
                    {new Date(game.last_activity).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Players:</span>
                  <span className="text-white font-semibold">{game.total_players.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Games Played:</span>
                  <span className="text-white font-semibold">{game.total_games_played.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">High Score:</span>
                  <span className="text-yellow-400 font-semibold">{game.highest_score.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Average:</span>
                  <span className="text-blue-400 font-semibold">{Math.round(game.average_score).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard Tabs */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 px-6 py-4 text-center font-semibold transition-colors ${
              activeTab === 'global'
                ? 'bg-purple-600/20 text-purple-300 border-b-2 border-purple-500'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Trophy className="w-5 h-5" />
              <span>Global Leaderboard</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('game')}
            className={`flex-1 px-6 py-4 text-center font-semibold transition-colors ${
              activeTab === 'game'
                ? 'bg-blue-600/20 text-blue-300 border-b-2 border-blue-500'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Gamepad2 className="w-5 h-5" />
              <span>Game Rankings</span>
            </div>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'global' ? (
            <EnhancedLeaderboard
              showGlobal={true}
              limit={50}
            />
          ) : (
            <div>
              {gameKey ? (
                <EnhancedLeaderboard
                  gameKey={gameKey}
                  limit={50}
                />
              ) : (
                <div className="text-center py-12 text-white/60">
                  <Gamepad2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">Select a game to view rankings</p>
                  <p>Choose from the navigation or use specific game pages</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeaderboardDashboard
