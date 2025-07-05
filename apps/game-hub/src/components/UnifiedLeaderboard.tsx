import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Trophy, 
  Medal, 
  Crown, 
  Star, 
  TrendingUp, 
  Users, 
  Timer,
  Filter,
  ArrowUpDown,
  ChevronDown
} from 'lucide-react'
import { unifiedLeaderboard, type GameScore, type GlobalScore, type LeaderboardConfig } from '@avoid/shared'
import { useAuth } from '../contexts/AuthContext'

interface UnifiedLeaderboardProps {
  gameKey?: string // If provided, shows game-specific leaderboard
  showGlobal?: boolean // If true, shows global leaderboard
  limit?: number
  className?: string
}

const UnifiedLeaderboard: React.FC<UnifiedLeaderboardProps> = ({
  gameKey,
  showGlobal = false,
  limit = 50,
  className = ''
}) => {
  const { user } = useAuth()
  const [gameScores, setGameScores] = useState<GameScore[]>([])
  const [globalScores, setGlobalScores] = useState<GlobalScore[]>([])
  const [gameConfigs, setGameConfigs] = useState<LeaderboardConfig[]>([])
  const [selectedGame, setSelectedGame] = useState<string>(gameKey || 'all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRank, setUserRank] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'rank'>('score')
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month'>('all')

  useEffect(() => {
    loadLeaderboardData()
    loadGameConfigs()
  }, [selectedGame, showGlobal, limit])

  useEffect(() => {
    if (user && selectedGame !== 'all') {
      loadUserRank()
    }
  }, [user, selectedGame])

  const loadGameConfigs = () => {
    const configs = unifiedLeaderboard.getAllGameConfigs()
    setGameConfigs(configs)
  }

  const loadLeaderboardData = async () => {
    setLoading(true)
    setError(null)

    try {
      if (showGlobal || selectedGame === 'all') {
        // Load global leaderboard
        const result = await unifiedLeaderboard.getGlobalLeaderboard(limit)
        if (result.success && result.data) {
          setGlobalScores(result.data)
        } else {
          setError(result.error || 'Failed to load global leaderboard')
        }
      } else if (selectedGame) {
        // Load game-specific leaderboard
        const result = await unifiedLeaderboard.getGameLeaderboard(selectedGame, limit)
        if (result.success && result.data) {
          setGameScores(result.data)
        } else {
          setError(result.error || 'Failed to load game leaderboard')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Leaderboard loading error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUserRank = async () => {
    if (!user || !selectedGame || selectedGame === 'all') return

    try {
      const result = await unifiedLeaderboard.getUserRank(user.id, selectedGame)
      if (result.success && result.rank && result.rank > 0) {
        setUserRank(result.rank)
      }
    } catch (err) {
      console.error('Error loading user rank:', err)
    }
  }

  const handleGameSelect = (game: string) => {
    setSelectedGame(game)
    setUserRank(null)
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="text-yellow-400" size={20} />
      case 2:
        return <Medal className="text-gray-400" size={20} />
      case 3:
        return <Medal className="text-amber-600" size={20} />
      default:
        return <span className="text-white/60 text-sm">#{rank}</span>
    }
  }

  const formatScore = (score: number, gameKey?: string) => {
    const config = gameConfigs.find(c => c.gameKey === gameKey)
    const unit = config?.scoreUnit || 'points'
    
    if (unit === 'time') {
      // Convert milliseconds to readable time format
      const minutes = Math.floor(score / 60000)
      const seconds = Math.floor((score % 60000) / 1000)
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
    
    return score.toLocaleString() + (unit !== 'points' ? ` ${unit}` : '')
  }

  if (loading) {
    return (
      <div className={`leaderboard-container ${className}`}>
        <div className="flex items-center justify-center p-8">
          <div className="loading-spinner"></div>
          <span className="ml-3 text-white">Loading leaderboard...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`leaderboard-container ${className}`}>
        <div className="text-center p-8">
          <div className="text-red-400 mb-4">Error loading leaderboard</div>
          <div className="text-white/60 text-sm">{error}</div>
          <button 
            onClick={loadLeaderboardData}
            className="btn-secondary mt-4"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`leaderboard-container ${className}`}>
      {/* Header */}
      <div className="leaderboard-header mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Trophy className="text-yellow-400" size={24} />
            <h2 className="text-2xl font-bold glow-text">
              {showGlobal || selectedGame === 'all' ? 'Global Champions' : 
               gameConfigs.find(c => c.gameKey === selectedGame)?.displayName || 'Leaderboard'}
            </h2>
          </div>
          
          {/* Game Selector */}
          {!gameKey && (
            <div className="relative">
              <select
                value={selectedGame}
                onChange={(e) => handleGameSelect(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">Global Leaderboard</option>
                {gameConfigs.map(config => (
                  <option key={config.gameKey} value={config.gameKey}>
                    {config.displayName}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/60 pointer-events-none" size={16} />
            </div>
          )}
        </div>

        {/* User Rank Display */}
        {user && userRank && selectedGame !== 'all' && (
          <div className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {user.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <div className="text-white font-medium">{user.username || user.email}</div>
                  <div className="text-white/60 text-sm">Your rank</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-purple-300">#{userRank}</div>
                <div className="text-sm text-white/60">
                  {userRank <= 10 ? 'Top 10!' : 
                   userRank <= 100 ? 'Top 100!' : 
                   'Keep climbing!'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-white/60" />
            <span className="text-white/60">Filters:</span>
          </div>
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1 rounded ${timeFilter === 'all' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'}`}
          >
            All Time
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-3 py-1 rounded ${timeFilter === 'month' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'}`}
          >
            This Month
          </button>
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-3 py-1 rounded ${timeFilter === 'week' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'}`}
          >
            This Week
          </button>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-2">
        {showGlobal || selectedGame === 'all' ? (
          // Global Leaderboard
          globalScores.length > 0 ? (
            globalScores.map((entry, index) => (
              <div
                key={entry.userId}
                className={`leaderboard-entry p-4 rounded-lg transition-all hover:bg-white/5 ${
                  user?.id === entry.userId ? 'ring-2 ring-purple-500/50 bg-purple-600/10' : 'bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-12 h-12">
                      {getRankIcon(entry.rank)}
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {entry.userAvatar ? (
                        <img 
                          src={entry.userAvatar} 
                          alt={entry.username}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">
                            {entry.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      <div>
                        <div className="text-white font-medium">{entry.username}</div>
                        <div className="text-white/60 text-sm flex items-center space-x-3">
                          <span>{entry.gamesPlayed} games played</span>
                          <span>•</span>
                          <span>Best: {entry.bestGame}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl font-bold glow-text">
                      {entry.totalScore.toLocaleString()}
                    </div>
                    <div className="text-white/60 text-sm">
                      Avg: {entry.averageScore.toLocaleString()}
                    </div>
                  </div>
                </div>
                
                {/* Game Breakdown */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {Object.entries(entry.gameScores).map(([gameKey, score]) => {
                      const config = gameConfigs.find(c => c.gameKey === gameKey)
                      return (
                        <div key={gameKey} className="text-center">
                          <div className="text-white/60 text-xs">{config?.displayName || gameKey}</div>
                          <div className="text-white font-medium">
                            {formatScore(score as number, gameKey)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-8 text-white/60">
              No global scores yet. Be the first to set a record!
            </div>
          )
        ) : (
          // Game-specific Leaderboard
          gameScores.length > 0 ? (
            gameScores.map((entry, index) => (
              <div
                key={entry.id}
                className={`leaderboard-entry p-4 rounded-lg transition-all hover:bg-white/5 ${
                  user?.id === entry.userId ? 'ring-2 ring-purple-500/50 bg-purple-600/10' : 'bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-12 h-12">
                      {getRankIcon(index + 1)}
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {entry.userAvatar ? (
                        <img 
                          src={entry.userAvatar} 
                          alt={entry.username}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">
                            {entry.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      <div>
                        <div className="text-white font-medium">{entry.username}</div>
                        <div className="text-white/60 text-sm">
                          {new Date(entry.achievedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl font-bold glow-text">
                      {formatScore(entry.score, entry.gameKey)}
                    </div>
                    {entry.metadata && entry.metadata.wave && (
                      <div className="text-white/60 text-sm">
                        Wave {entry.metadata.wave}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-8 text-white/60">
              No scores yet for this game. Be the first to set a record!
            </div>
          )
        )}
      </div>

      {/* Load More Button */}
      {(gameScores.length >= limit || globalScores.length >= limit) && (
        <div className="text-center mt-6">
          <button 
            onClick={() => {
              // Implementation for loading more entries
              console.log('Load more entries')
            }}
            className="btn-secondary"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  )
}

export default UnifiedLeaderboard
