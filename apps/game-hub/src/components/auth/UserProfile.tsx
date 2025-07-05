import React, { useState, useEffect } from 'react'
import { LogOut, Trophy, Star, Clock, Gamepad2, Award, User } from 'lucide-react'
import { unifiedAuth, GameSession, LeaderboardEntry } from '../../services/UnifiedAuthService'

interface UserProfileProps {
  session: GameSession
  onSignOut: () => void
}

const UserProfile: React.FC<UserProfileProps> = ({ session, onSignOut }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserStats()
  }, [session.user.id])

  const loadUserStats = async () => {
    setLoading(true)
    try {
      // Load leaderboard data for all games
      const games = ['voidavoid', 'wreckavoid', 'tankavoid']
      const leaderboardData: Record<string, LeaderboardEntry[]> = {}
      
      for (const game of games) {
        const result = await unifiedAuth.getLeaderboard(game, 10)
        if (result.success) {
          leaderboardData[game] = result.data || []
        }
      }
      
      setLeaderboards(leaderboardData)
    } catch (error) {
      console.error('Error loading user stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await unifiedAuth.signOut()
    onSignOut()
  }

  const getUserRank = (game: string): number | null => {
    const leaderboard = leaderboards[game] || []
    const userEntry = leaderboard.find(entry => entry.user_id === session.user.id)
    if (!userEntry) return null
    return leaderboard.indexOf(userEntry) + 1
  }

  const getBestScore = (game: string): number => {
    const key = `${game}_best_score` as keyof typeof session.user
    return (session.user[key] as number) || 0
  }

  const getGameDisplayName = (gameKey: string): string => {
    const names: Record<string, string> = {
      voidavoid: 'VOIDaVOID',
      wreckavoid: 'WreckaVOID',
      tankavoid: 'TankaVOID'
    }
    return names[gameKey] || gameKey
  }

  if (!isExpanded) {
    return (
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center space-x-3 p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            {session.user.avatar_url ? (
              <img 
                src={session.user.avatar_url} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <User size={16} className="text-white" />
            )}
          </div>
          <div className="text-left">
            <div className="text-white font-medium">{session.user.username}</div>
            <div className="text-white/60 text-sm">Level Up Gaming!</div>
          </div>
        </button>
        
        <button
          onClick={handleSignOut}
          className="p-3 text-white/60 hover:text-white transition-colors"
          title="Sign Out"
        >
          <LogOut size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-gray-900 border border-purple-500/20 rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                {session.user.avatar_url ? (
                  <img 
                    src={session.user.avatar_url} 
                    alt="Avatar" 
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <User size={24} className="text-white" />
                )}
              </div>
              <div>
                <h2 className="text-3xl font-bold glow-text">{session.user.username}</h2>
                <p className="text-white/60">{session.user.email}</p>
                <p className="text-white/60 text-sm">
                  Member since {new Date(session.user.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="stats-card text-center">
              <div className="flex items-center justify-center mb-2">
                <Gamepad2 className="text-purple-400" size={20} />
              </div>
              <div className="text-2xl font-bold glow-text">{session.user.total_games_played}</div>
              <div className="text-white/60 text-sm">Games Played</div>
            </div>
            
            <div className="stats-card text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="text-blue-400" size={20} />
              </div>
              <div className="text-2xl font-bold glow-text">
                {Math.floor(session.user.total_time_played / 60)}h
              </div>
              <div className="text-white/60 text-sm">Time Played</div>
            </div>
            
            <div className="stats-card text-center">
              <div className="flex items-center justify-center mb-2">
                <Award className="text-yellow-400" size={20} />
              </div>
              <div className="text-2xl font-bold glow-text">{session.user.achievements.length}</div>
              <div className="text-white/60 text-sm">Achievements</div>
            </div>
            
            <div className="stats-card text-center">
              <div className="flex items-center justify-center mb-2">
                <Star className="text-green-400" size={20} />
              </div>
              <div className="text-2xl font-bold glow-text">
                {session.user.favorite_game ? getGameDisplayName(session.user.favorite_game) : 'None'}
              </div>
              <div className="text-white/60 text-sm">Favorite Game</div>
            </div>
          </div>

          {/* Game Stats */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <Trophy className="mr-2 text-yellow-400" size={20} />
              Game Performance
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="loading-spinner"></div>
                <span className="ml-3 text-white/60">Loading stats...</span>
              </div>
            ) : (
              <div className="grid gap-4">
                {['voidavoid', 'wreckavoid', 'tankavoid'].map(game => {
                  const bestScore = getBestScore(game)
                  const rank = getUserRank(game)
                  
                  return (
                    <div key={game} className="game-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center">
                            <Gamepad2 size={20} className="text-purple-400" />
                          </div>
                          <div>
                            <h4 className="font-bold text-white">{getGameDisplayName(game)}</h4>
                            <p className="text-white/60 text-sm">
                              {bestScore > 0 ? `Best: ${bestScore.toLocaleString()}` : 'Not played yet'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {rank ? (
                            <div className="text-lg font-bold text-yellow-400">
                              #{rank}
                            </div>
                          ) : (
                            <div className="text-white/60 text-sm">
                              No ranking
                            </div>
                          )}
                          <div className="text-white/60 text-xs">
                            on leaderboard
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Current Game Status */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Current Session</h3>
            <div className="game-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">
                    Currently in: {getGameDisplayName(session.currentGame)}
                  </div>
                  <div className="text-white/60 text-sm">
                    Cross-game authentication active
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm">Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4">
            <button
              onClick={() => setIsExpanded(false)}
              className="flex-1 btn-secondary"
            >
              Close
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 btn-primary bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-2"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserProfile 