import { useParams } from 'react-router-dom'
import { Trophy, Star, TrendingUp, Users } from 'lucide-react'
import UnifiedLeaderboard from '../components/UnifiedLeaderboard'
import { unifiedLeaderboard } from '@avoid/shared'
import { useEffect, useState } from 'react'

const LeaderboardsPage = () => {
  const { gameKey } = useParams<{ gameKey?: string }>()
  const [gameConfigs, setGameConfigs] = useState<any[]>([])

  useEffect(() => {
    // Initialize leaderboard system with Supabase client
    // This would typically be done in a higher-level component or context
    // unifiedLeaderboard.setSupabaseClient(supabase)
    
    // Load game configurations
    const configs = unifiedLeaderboard.getAllGameConfigs()
    setGameConfigs(configs)
  }, [])

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-game font-bold glow-text mb-4">Leaderboards</h1>
          <p className="text-xl text-white/60">See who's dominating the aVOID universe</p>
          
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="stats-card text-center">
              <div className="flex items-center justify-center mb-2">
                <Trophy className="text-yellow-400 mr-2" size={24} />
                <span className="text-2xl font-bold glow-text">{gameConfigs.length}</span>
              </div>
              <div className="text-white/60">Active Leaderboards</div>
            </div>
            
            <div className="stats-card text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="text-blue-400 mr-2" size={24} />
                <span className="text-2xl font-bold glow-text">1.2k+</span>
              </div>
              <div className="text-white/60">Competing Players</div>
            </div>
            
            <div className="stats-card text-center">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="text-green-400 mr-2" size={24} />
                <span className="text-2xl font-bold glow-text">50k+</span>
              </div>
              <div className="text-white/60">Scores Recorded</div>
            </div>
          </div>
        </div>

        {/* Game Selection Info */}
        {gameKey && (
          <div className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-4 mb-8 text-center">
            <div className="text-purple-300 font-medium">
              Viewing leaderboard for {gameConfigs.find(c => c.gameKey === gameKey)?.displayName || gameKey}
            </div>
            <div className="text-white/60 text-sm mt-1">
              Switch to global view to see cross-game rankings
            </div>
          </div>
        )}

        {/* Unified Leaderboard Component */}
        <UnifiedLeaderboard 
          gameKey={gameKey}
          showGlobal={!gameKey}
          limit={100}
          className="w-full"
        />
      </div>
    </div>
  )
}

export default LeaderboardsPage 