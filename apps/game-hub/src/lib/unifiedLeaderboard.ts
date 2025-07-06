import { supabase } from './supabase'

// Import the unified leaderboard system from shared package
// Note: We need to implement this locally for now since the shared package isn't properly linked
export interface GameScore {
  id: string
  userId: string
  gameKey: string
  score: number
  metadata?: any
  achievedAt: string
  username: string
  userAvatar?: string
}

export interface GlobalScore {
  userId: string
  username: string
  userAvatar?: string
  totalScore: number
  gamesPlayed: number
  averageScore: number
  bestGame: string
  bestGameScore: number
  gameScores: { [gameKey: string]: number }
  rank: number
  lastUpdated: string
}

export interface LeaderboardConfig {
  gameKey: string
  displayName: string
  scoreType: 'high' | 'low' | 'time'
  scoreUnit?: string
  maxEntries: number
  isActive: boolean
}

export class UnifiedLeaderboardSystem {
  private static instance: UnifiedLeaderboardSystem
  private leaderboardConfigs: Map<string, LeaderboardConfig> = new Map()
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
  
  private constructor() {
    this.setupLeaderboardConfigs()
  }

  public static getInstance(): UnifiedLeaderboardSystem {
    if (!UnifiedLeaderboardSystem.instance) {
      UnifiedLeaderboardSystem.instance = new UnifiedLeaderboardSystem()
    }
    return UnifiedLeaderboardSystem.instance
  }

  private setupLeaderboardConfigs() {
    const configs: LeaderboardConfig[] = [
      {
        gameKey: 'voidavoid',
        displayName: 'VOIDaVOID',
        scoreType: 'high',
        scoreUnit: 'points',
        maxEntries: 1000,
        isActive: true
      },
      {
        gameKey: 'tankavoid',
        displayName: 'TankaVOID',
        scoreType: 'high',
        scoreUnit: 'points',
        maxEntries: 1000,
        isActive: true
      },
      {
        gameKey: 'wreckavoid',
        displayName: 'WreckaVOID',
        scoreType: 'high',
        scoreUnit: 'points',
        maxEntries: 1000,
        isActive: true
      },
      {
        gameKey: 'wordavoid',
        displayName: 'WORDaVOID',
        scoreType: 'high',
        scoreUnit: 'wpm',
        maxEntries: 1000,
        isActive: true
      }
    ]

    configs.forEach(config => {
      this.leaderboardConfigs.set(config.gameKey, config)
    })
  }

  public async getGameLeaderboard(
    gameKey: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; data?: GameScore[]; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' }
    }

    const cacheKey = `leaderboard_${gameKey}_${limit}_${offset}`
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return { success: true, data: cached }
    }

    try {
      const config = this.leaderboardConfigs.get(gameKey)
      if (!config) {
        return { success: false, error: 'Game leaderboard not found' }
      }

      // Use the existing leaderboard_scores table instead of game_scores
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select(`
          *,
          user_profiles (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('game_key', gameKey)
        .eq('is_verified', true)
        .order('score', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      const gameScores: GameScore[] = data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        gameKey: row.game_key,
        score: row.score,
        metadata: row.metadata || {},
        achievedAt: row.created_at,
        username: row.user_profiles?.username || row.player_name,
        userAvatar: row.user_profiles?.avatar_url
      }))

      // Cache for 5 minutes
      this.setCache(cacheKey, gameScores, 5 * 60 * 1000)

      return { success: true, data: gameScores }
    } catch (error) {
      console.error('Error fetching game leaderboard:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public async getGlobalLeaderboard(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; data?: GlobalScore[]; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' }
    }

    const cacheKey = `global_leaderboard_${limit}_${offset}`
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return { success: true, data: cached }
    }

    try {
      // Build global leaderboard from existing leaderboard_scores
      const { data: scoresData, error } = await supabase
        .from('leaderboard_scores')
        .select(`
          user_id,
          score,
          game_key,
          user_profiles (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('is_verified', true)
        .not('user_id', 'is', null)

      if (error) {
        throw error
      }

      // Group by user and calculate totals
      const userStats = new Map<string, {
        userId: string
        username: string
        userAvatar?: string
        scores: { [gameKey: string]: number }
        totalScore: number
        gamesPlayed: number
        bestGame: string
        bestGameScore: number
      }>()

      scoresData.forEach((row: any) => {
        const userId = row.user_id
        if (!userId) return

        const existing = userStats.get(userId) || {
          userId,
          username: row.user_profiles?.username || 'Unknown',
          userAvatar: row.user_profiles?.avatar_url,
          scores: {},
          totalScore: 0,
          gamesPlayed: 0,
          bestGame: '',
          bestGameScore: 0
        }

        // Only keep the best score per game per user
        if (!existing.scores[row.game_key] || row.score > existing.scores[row.game_key]) {
          const oldScore = existing.scores[row.game_key] || 0
          existing.scores[row.game_key] = row.score
          existing.totalScore = existing.totalScore - oldScore + row.score

          if (row.score > existing.bestGameScore) {
            existing.bestGameScore = row.score
            existing.bestGame = row.game_key
          }
        }

        existing.gamesPlayed = Object.keys(existing.scores).length
        userStats.set(userId, existing)
      })

      // Convert to array and sort by total score
      const globalScores: GlobalScore[] = Array.from(userStats.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(offset, offset + limit)
        .map((user, index) => ({
          userId: user.userId,
          username: user.username,
          userAvatar: user.userAvatar,
          totalScore: user.totalScore,
          gamesPlayed: user.gamesPlayed,
          averageScore: user.gamesPlayed > 0 ? Math.round(user.totalScore / user.gamesPlayed) : 0,
          bestGame: user.bestGame,
          bestGameScore: user.bestGameScore,
          gameScores: user.scores,
          rank: offset + index + 1,
          lastUpdated: new Date().toISOString()
        }))

      // Cache for 5 minutes
      this.setCache(cacheKey, globalScores, 5 * 60 * 1000)

      return { success: true, data: globalScores }
    } catch (error) {
      console.error('Error fetching global leaderboard:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public async getUserRank(
    userId: string,
    gameKey?: string
  ): Promise<{ success: boolean; rank?: number; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' }
    }

    try {
      if (gameKey) {
        // Get game-specific rank
        const { data: userScore } = await supabase
          .from('leaderboard_scores')
          .select('score')
          .eq('user_id', userId)
          .eq('game_key', gameKey)
          .eq('is_verified', true)
          .order('score', { ascending: false })
          .limit(1)
          .single()

        if (!userScore) {
          return { success: true, rank: -1 }
        }

        // Count how many scores are better
        const { count } = await supabase
          .from('leaderboard_scores')
          .select('*', { count: 'exact', head: true })
          .eq('game_key', gameKey)
          .eq('is_verified', true)
          .gt('score', userScore.score)

        const rank = (count || 0) + 1
        return { success: true, rank }
      } else {
        // Global rank calculation would require implementing global leaderboard
        return { success: true, rank: -1 }
      }
    } catch (error) {
      console.error('Error getting user rank:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public getGameConfig(gameKey: string): LeaderboardConfig | null {
    return this.leaderboardConfigs.get(gameKey) || null
  }

  public getAllGameConfigs(): LeaderboardConfig[] {
    return Array.from(this.leaderboardConfigs.values())
  }

  // Cache management
  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }
}

// Export singleton instance
export const unifiedLeaderboard = UnifiedLeaderboardSystem.getInstance()
export default unifiedLeaderboard
