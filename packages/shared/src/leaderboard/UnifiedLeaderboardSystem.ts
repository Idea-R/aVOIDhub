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
  private supabase: any // Will be injected
  private leaderboardConfigs: Map<string, LeaderboardConfig> = new Map()
  private listeners: Map<string, Function[]> = new Map()
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

  public setSupabaseClient(supabase: any) {
    this.supabase = supabase
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

  public async submitScore(
    userId: string,
    gameKey: string,
    score: number,
    metadata?: any
  ): Promise<{ success: boolean; rank?: number; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not initialized' }
    }

    const config = this.leaderboardConfigs.get(gameKey)
    if (!config || !config.isActive) {
      return { success: false, error: 'Game leaderboard not found or inactive' }
    }

    try {
      // Get user profile
      const { data: profile } = await this.supabase
        .from('user_profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single()

      if (!profile) {
        return { success: false, error: 'User profile not found' }
      }

      // Insert new score
      const { data: scoreData, error: scoreError } = await this.supabase
        .from('game_scores')
        .insert({
          user_id: userId,
          game_key: gameKey,
          score,
          metadata: metadata || {},
          achieved_at: new Date().toISOString(),
          username: profile.username,
          user_avatar: profile.avatar_url
        })
        .select()
        .single()

      if (scoreError) {
        throw scoreError
      }

      // Calculate rank
      const rank = await this.calculateRank(gameKey, score)

      // Update global leaderboard
      await this.updateGlobalLeaderboard(userId)

      // Clear relevant caches
      this.invalidateCache(`leaderboard_${gameKey}`)
      this.invalidateCache('global_leaderboard')
      this.invalidateCache(`user_scores_${userId}`)

      // Emit events
      this.emit('score-submitted', {
        userId,
        gameKey,
        score,
        rank,
        scoreData
      })

      return { success: true, rank }
    } catch (error) {
      console.error('Error submitting score:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public async getGameLeaderboard(
    gameKey: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; data?: GameScore[]; error?: string }> {
    if (!this.supabase) {
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

      const ascending = config.scoreType === 'low'

      const { data, error } = await this.supabase
        .from('game_scores')
        .select('*')
        .eq('game_key', gameKey)
        .order('score', { ascending })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      const gameScores: GameScore[] = data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        gameKey: row.game_key,
        score: row.score,
        metadata: row.metadata,
        achievedAt: row.achieved_at,
        username: row.username,
        userAvatar: row.user_avatar
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
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not initialized' }
    }

    const cacheKey = `global_leaderboard_${limit}_${offset}`
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return { success: true, data: cached }
    }

    try {
      const { data, error } = await this.supabase
        .from('global_leaderboard')
        .select('*')
        .order('total_score', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      const globalScores: GlobalScore[] = data.map((row: any, index: number) => ({
        userId: row.user_id,
        username: row.username,
        userAvatar: row.user_avatar,
        totalScore: row.total_score,
        gamesPlayed: row.games_played,
        averageScore: row.average_score,
        bestGame: row.best_game,
        bestGameScore: row.best_game_score,
        gameScores: row.game_scores || {},
        rank: offset + index + 1,
        lastUpdated: row.last_updated
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
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not initialized' }
    }

    try {
      if (gameKey) {
        // Get game-specific rank
        const { data: userScore } = await this.supabase
          .from('game_scores')
          .select('score')
          .eq('user_id', userId)
          .eq('game_key', gameKey)
          .order('score', { ascending: false })
          .limit(1)
          .single()

        if (!userScore) {
          return { success: true, rank: -1 }
        }

        const rank = await this.calculateRank(gameKey, userScore.score)
        return { success: true, rank }
      } else {
        // Get global rank
        const { data: globalRank } = await this.supabase
          .from('global_leaderboard')
          .select('rank')
          .eq('user_id', userId)
          .single()

        return {
          success: true,
          rank: globalRank ? globalRank.rank : -1
        }
      }
    } catch (error) {
      console.error('Error getting user rank:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  private async calculateRank(gameKey: string, score: number): Promise<number> {
    const config = this.leaderboardConfigs.get(gameKey)
    if (!config) return -1

    const ascending = config.scoreType === 'low'
    const operator = ascending ? 'lt' : 'gt'

    const { count } = await this.supabase
      .from('game_scores')
      .select('*', { count: 'exact', head: true })
      .eq('game_key', gameKey)
      .filter('score', operator, score)

    return (count || 0) + 1
  }

  private async updateGlobalLeaderboard(userId: string): Promise<void> {
    if (!this.supabase) return

    try {
      // Get all user scores
      const { data: userScores } = await this.supabase
        .from('game_scores')
        .select('game_key, score')
        .eq('user_id', userId)

      if (!userScores || userScores.length === 0) return

      // Get user profile
      const { data: profile } = await this.supabase
        .from('user_profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single()

      // Calculate global stats
      const gameScores: { [key: string]: number } = {}
      let totalScore = 0
      let bestGameScore = 0
      let bestGame = ''

      // Get best score for each game
      const gameGroups = userScores.reduce((acc: any, score: any) => {
        if (!acc[score.game_key] || score.score > acc[score.game_key]) {
          acc[score.game_key] = score.score
        }
        return acc
      }, {})

      Object.entries(gameGroups).forEach(([gameKey, score]: [string, any]) => {
        gameScores[gameKey] = score
        totalScore += score
        if (score > bestGameScore) {
          bestGameScore = score
          bestGame = gameKey
        }
      })

      const gamesPlayed = Object.keys(gameScores).length
      const averageScore = gamesPlayed > 0 ? totalScore / gamesPlayed : 0

      // Update global leaderboard entry
      const { error } = await this.supabase
        .from('global_leaderboard')
        .upsert({
          user_id: userId,
          username: profile?.username || 'Unknown',
          user_avatar: profile?.avatar_url || null,
          total_score: totalScore,
          games_played: gamesPlayed,
          average_score: Math.round(averageScore),
          best_game: bestGame,
          best_game_score: bestGameScore,
          game_scores: gameScores,
          last_updated: new Date().toISOString()
        })

      if (error) {
        console.error('Error updating global leaderboard:', error)
      }

      // Update ranks
      await this.updateGlobalRanks()
    } catch (error) {
      console.error('Error in updateGlobalLeaderboard:', error)
    }
  }

  private async updateGlobalRanks(): Promise<void> {
    if (!this.supabase) return

    try {
      // Get all global leaderboard entries ordered by total score
      const { data: entries } = await this.supabase
        .from('global_leaderboard')
        .select('user_id, total_score')
        .order('total_score', { ascending: false })

      if (!entries) return

      // Update ranks in batches
      const batchSize = 100
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize)
        const updates = batch.map((entry: any, batchIndex: number) => ({
          user_id: entry.user_id,
          rank: i + batchIndex + 1
        }))

        await this.supabase
          .from('global_leaderboard')
          .upsert(updates)
      }
    } catch (error) {
      console.error('Error updating global ranks:', error)
    }
  }

  public addGame(config: LeaderboardConfig): void {
    this.leaderboardConfigs.set(config.gameKey, config)
    this.emit('game-added', { gameKey: config.gameKey, config })
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

  private invalidateCache(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  // Event system
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  public off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }
}

// Export singleton instance
export const unifiedLeaderboard = UnifiedLeaderboardSystem.getInstance()
export default unifiedLeaderboard
