import React, { useState, useEffect } from 'react'
import { Trophy, Crown, Star, ExternalLink, Lock } from 'lucide-react'
import { unifiedAuth } from '../services/UnifiedAuthService'
import { enhancedLeaderboardService, type GlobalUserStats, type EnhancedLeaderboardEntry } from '../services/EnhancedLeaderboardService'
import { useAuth } from '../contexts/AuthContext'

// Use the enhanced types from the service
type LeaderboardEntry = GlobalUserStats | (EnhancedLeaderboardEntry & {
  total_score: number
  average_score: number
})

interface EnhancedLeaderboardProps {
  gameKey?: string
  showGlobal?: boolean
  limit?: number
}

const EnhancedLeaderboard: React.FC<EnhancedLeaderboardProps> = ({
  gameKey,
  showGlobal = false,
  limit = 20
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [proOnly, setProOnly] = useState(false)
  const { user, isAuthenticated } = useAuth()

  useEffect(() => {
    fetchLeaderboard()
  }, [gameKey, showGlobal, proOnly])

  const fetchLeaderboard = async () => {
    setLoading(true)
    setError('')

    try {
      if (showGlobal) {
        const result = await enhancedLeaderboardService.getGlobalLeaderboard(proOnly, limit)
        if (result.success) {
          setLeaderboard(result.data as LeaderboardEntry[])
        } else {
          setError(result.error || 'Failed to fetch global leaderboard')
        }
      } else if (gameKey) {
        const result = await enhancedLeaderboardService.getGameLeaderboard(gameKey, limit)
        if (result.success) {
          // Convert game leaderboard entries to match the interface
          const convertedData: LeaderboardEntry[] = result.data.map((entry, index) => ({
            user_id: entry.user_id,
            username: entry.username,
            display_name: entry.display_name,
            avatar_url: entry.avatar_url,
            country_code: entry.country_code,
            is_pro_member: entry.is_pro_member,
            score: entry.score,
            rank_position: entry.rank_position,
            total_score: entry.total_score,
            games_played: entry.games_played,
            average_score: entry.games_played > 0 ? entry.total_score / entry.games_played : 0,
            last_played: entry.last_played,
            achievements_count: entry.achievements_count,
            social_links: entry.social_links
          }))
          setLeaderboard(convertedData)
        } else {
          setError(result.error || 'Failed to fetch game leaderboard')
        }
      }
    } catch (error) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />
      case 2:
        return <Trophy className="w-6 h-6 text-gray-400" />
      case 3:
        return <Trophy className="w-6 h-6 text-amber-600" />
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-white/60 font-bold">{rank}</span>
    }
  }

  const renderSocialLinks = (entry: LeaderboardEntry) => {
    if (!entry.is_pro_member || !entry.social_links) return null

    const links = Object.entries(entry.social_links).filter(([_, url]) => url)
    if (links.length === 0) return null

    return (
      <div className="flex space-x-2 mt-2">
        {links.slice(0, 3).map(([platform, url]) => (
          <a
            key={platform}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
            title={`${platform}: ${url}`}
          >
            <ExternalLink size={14} />
          </a>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-4 animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-white/10 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded w-24 mb-2"></div>
                <div className="h-3 bg-white/10 rounded w-16"></div>
              </div>
              <div className="h-6 bg-white/10 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold glow-text mb-2">
            {showGlobal ? 'Global Leaderboard' : `${gameKey?.toUpperCase()} Leaderboard`}
          </h2>
          <p className="text-white/60">
            {showGlobal 
              ? proOnly 
                ? 'Top supporters across all games' 
                : 'Top players across all games'
              : `Best scores in ${gameKey}`
            }
          </p>
        </div>

        {/* Pro Toggle - only for global leaderboard */}
        {showGlobal && (
          <div className="flex items-center space-x-4">
            {!unifiedAuth.canAccessGlobalLeaderboard() && (
              <div className="flex items-center space-x-2 text-amber-400">
                <Lock size={16} />
                <span className="text-sm">Pro required for global rankings</span>
              </div>
            )}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={proOnly}
                onChange={(e) => setProOnly(e.target.checked)}
                className="sr-only"
                disabled={!unifiedAuth.canAccessGlobalLeaderboard()}
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors ${
                proOnly ? 'bg-purple-600' : 'bg-white/20'
              } ${!unifiedAuth.canAccessGlobalLeaderboard() ? 'opacity-50' : ''}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  proOnly ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </div>
              <span className="text-sm text-white/80">Pro Members Only</span>
            </label>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.user_id}
            className={`bg-white/5 border rounded-lg p-4 transition-all hover:bg-white/10 ${
              entry.rank_position <= 3 ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Rank */}
                <div className="flex-shrink-0">
                  {getRankIcon(entry.rank_position)}
                </div>

                {/* Avatar & Info */}
                <div className="flex items-center space-x-3">
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.display_name}
                      className="w-10 h-10 rounded-full border-2 border-white/20"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {entry.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white">
                        {entry.display_name || entry.username}
                      </span>
                      {entry.is_pro_member && (
                        <Crown className="w-4 h-4 text-yellow-500" title="Pro Member" />
                      )}
                      {entry.country_code && (
                        <span className="text-xs bg-white/10 px-2 py-1 rounded">
                          {entry.country_code}
                        </span>
                      )}
                    </div>
                    {renderSocialLinks(entry)}
                  </div>
                </div>
              </div>

              {/* Score Info */}
              <div className="text-right">
                {showGlobal ? (
                  <div>
                    <div className="text-lg font-bold text-white">
                      {entry.total_score.toLocaleString()}
                    </div>
                    <div className="text-sm text-white/60">
                      {entry.games_played} games • Avg: {entry.average_score.toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-lg font-bold text-white">
                    {entry.total_score.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {leaderboard.length === 0 && (
        <div className="text-center py-12 text-white/60">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">No scores yet!</p>
          <p>Be the first to set a record.</p>
        </div>
      )}
    </div>
  )
}

export default EnhancedLeaderboard
