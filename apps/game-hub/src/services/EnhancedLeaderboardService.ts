import { supabase } from '../lib/supabase'
import { logSupabaseError, logInfo } from '../utils/errorTracking'

export interface UserGameStats {
  id: string
  user_id: string
  game_key: string
  total_score: number
  best_score: number
  games_played: number
  total_time_played: number
  last_played_at: string
  achievements: string[]
  metadata: any
  created_at: string
  updated_at: string
}

export interface GlobalUserStats {
  user_id: string
  username: string
  display_name: string
  avatar_url?: string
  country_code?: string
  social_links?: {
    twitter?: string
    instagram?: string
    youtube?: string
    twitch?: string
    github?: string
    website?: string
  }
  is_pro_member: boolean
  total_score: number
  total_games_played: number
  total_time_played: number
  unique_games_played: number
  best_single_score: number
  best_game_key?: string
  average_score: number
  rank_position: number
  total_achievements: number
  last_score_update: string
}

export interface GameStats {
  game_key: string
  total_players: number
  total_games_played: number
  total_scores_submitted: number
  highest_score: number
  average_score: number
  featured_priority: number
  last_activity: string
}

export interface EnhancedLeaderboardEntry {
  user_id: string
  username: string
  display_name: string
  avatar_url?: string
  country_code?: string
  is_pro_member: boolean
  score: number
  games_played: number
  total_score: number
  last_played: string
  rank_position: number
  achievements_count?: number
  social_links?: any
}

export interface UserRanking {
  game_key: string
  best_score: number
  rank_position: number
  total_players: number
  percentile: number
}

export class EnhancedLeaderboardService {
  
  /**
   * Submit a score and trigger all stat updates
   */
  async submitScore(gameKey: string, score: number, metadata?: any): Promise<{ success: boolean; error?: string; data?: any }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      logInfo('Submitting Enhanced Score', { gameKey, score })
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: 'User not authenticated' }
      }

      // Get user profile to ensure username exists
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, display_name')
        .eq('id', user.id)
        .single()

      if (!profile) {
        return { success: false, error: 'User profile not found' }
      }

      // Submit score - triggers will handle the rest
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .insert({
          user_id: user.id,
          game_key: gameKey,
          score,
          player_name: profile.username || profile.display_name || 'Anonymous',
          metadata,
          is_verified: true
        })
        .select()
        .single()

      if (error) {
        logSupabaseError('submitScore', error, { gameKey, score })
        return { success: false, error: error.message }
      }

      logInfo('Score Submitted Successfully', { gameKey, score, scoreId: data.id })
      return { success: true, data }
    } catch (error) {
      logSupabaseError('submitScore', error, { gameKey, score })
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Get global leaderboard with enhanced user data
   */
  async getGlobalLeaderboard(proOnly: boolean = false, limit: number = 50, offset: number = 0): Promise<{ success: boolean; error?: string; data: GlobalUserStats[] }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured', data: [] }
    }

    try {
      logInfo('Fetching Global Leaderboard', { proOnly, limit, offset })

      // Use the stored procedure if it exists, otherwise fall back to direct query
      const { data, error } = await supabase
        .rpc('get_global_leaderboard', {
          p_limit: limit,
          p_offset: offset,
          p_pro_only: proOnly
        })

      if (error) {
        // Fallback to direct query if stored procedure doesn't exist
        logSupabaseError('getGlobalLeaderboard RPC failed, using fallback', error)
        return this.getGlobalLeaderboardFallback(proOnly, limit, offset)
      }

      logInfo('Global Leaderboard Fetched Successfully', { count: data?.length })
      return { success: true, data: data || [] }
    } catch (error) {
      logSupabaseError('getGlobalLeaderboard', error)
      return this.getGlobalLeaderboardFallback(proOnly, limit, offset)
    }
  }

  /**
   * Fallback method for global leaderboard when stored procedure isn't available
   */
  private async getGlobalLeaderboardFallback(proOnly: boolean, limit: number, offset: number): Promise<{ success: boolean; error?: string; data: GlobalUserStats[] }> {
    try {
      logInfo('Using Global Leaderboard Fallback Method')

      // Aggregate scores by user across all games
      const { data: aggregatedData, error } = await supabase
        .from('leaderboard_scores')
        .select(`
          user_id,
          score,
          game_key,
          created_at,
          user_profiles (
            username,
            display_name,
            avatar_url,
            country_code,
            social_links,
            is_pro_member
          )
        `)
        .order('score', { ascending: false })

      if (error) {
        throw error
      }

      // Process and aggregate the data
      const userStats = new Map<string, GlobalUserStats>()
      
      aggregatedData?.forEach(entry => {
        const userId = entry.user_id
        const profile = entry.user_profiles as any
        
        if (!profile || (proOnly && !profile.is_pro_member)) {
          return
        }

        if (!userStats.has(userId)) {
          userStats.set(userId, {
            user_id: userId,
            username: profile.username || 'Anonymous',
            display_name: profile.display_name || profile.username || 'Anonymous',
            avatar_url: profile.avatar_url,
            country_code: profile.country_code,
            social_links: profile.social_links || {},
            is_pro_member: profile.is_pro_member || false,
            total_score: 0,
            total_games_played: 0,
            total_time_played: 0,
            unique_games_played: 0,
            best_single_score: 0,
            best_game_key: '',
            average_score: 0,
            rank_position: 0,
            total_achievements: 0,
            last_score_update: entry.created_at
          })
        }

        const userStat = userStats.get(userId)!
        userStat.total_score += entry.score
        userStat.total_games_played += 1
        
        if (entry.score > userStat.best_single_score) {
          userStat.best_single_score = entry.score
          userStat.best_game_key = entry.game_key
        }

        if (entry.created_at > userStat.last_score_update) {
          userStat.last_score_update = entry.created_at
        }
      })

      // Calculate unique games and averages
      for (const [userId, stats] of userStats) {
        const uniqueGames = new Set(
          aggregatedData?.filter(e => e.user_id === userId).map(e => e.game_key) || []
        )
        stats.unique_games_played = uniqueGames.size
        stats.average_score = stats.total_games_played > 0 ? stats.total_score / stats.total_games_played : 0
      }

      // Sort by total score and assign ranks
      const sortedUsers = Array.from(userStats.values())
        .sort((a, b) => b.total_score - a.total_score || a.total_games_played - b.total_games_played)
        .slice(offset, offset + limit)
        .map((user, index) => ({
          ...user,
          rank_position: offset + index + 1
        }))

      return { success: true, data: sortedUsers }
    } catch (error) {
      logSupabaseError('getGlobalLeaderboardFallback', error)
      return { success: false, error: (error as Error).message, data: [] }
    }
  }

  /**
   * Get game-specific leaderboard with enhanced data
   */
  async getGameLeaderboard(gameKey: string, limit: number = 50, offset: number = 0): Promise<{ success: boolean; error?: string; data: EnhancedLeaderboardEntry[] }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured', data: [] }
    }

    try {
      logInfo('Fetching Game Leaderboard', { gameKey, limit, offset })

      // Try to use the stored procedure first
      const { data, error } = await supabase
        .rpc('get_game_leaderboard', {
          p_game_key: gameKey,
          p_limit: limit,
          p_offset: offset
        })

      if (error) {
        // Fallback to direct query
        return this.getGameLeaderboardFallback(gameKey, limit, offset)
      }

      const formattedData: EnhancedLeaderboardEntry[] = data?.map((entry: any, index: number) => ({
        user_id: entry.user_id,
        username: entry.username,
        display_name: entry.display_name,
        avatar_url: entry.avatar_url,
        country_code: entry.country_code,
        is_pro_member: entry.is_pro_member,
        score: entry.best_score,
        games_played: entry.games_played,
        total_score: entry.total_score,
        last_played: entry.last_played,
        rank_position: entry.rank_position || (offset + index + 1)
      })) || []

      logInfo('Game Leaderboard Fetched Successfully', { gameKey, count: formattedData.length })
      return { success: true, data: formattedData }
    } catch (error) {
      logSupabaseError('getGameLeaderboard', error, { gameKey })
      return this.getGameLeaderboardFallback(gameKey, limit, offset)
    }
  }

  /**
   * Fallback method for game-specific leaderboard
   */
  private async getGameLeaderboardFallback(gameKey: string, limit: number, offset: number): Promise<{ success: boolean; error?: string; data: EnhancedLeaderboardEntry[] }> {
    try {
      logInfo('Using Game Leaderboard Fallback Method', { gameKey })

      // Get best scores per user for the specific game
      const { data: scores, error } = await supabase
        .from('leaderboard_scores')
        .select(`
          user_id,
          score,
          created_at,
          user_profiles (
            username,
            display_name,
            avatar_url,
            country_code,
            is_pro_member
          )
        `)
        .eq('game_key', gameKey)
        .order('score', { ascending: false })

      if (error) {
        throw error
      }

      // Group by user and get their best scores
      const userBestScores = new Map<string, any>()
      const userGameCounts = new Map<string, number>()
      const userTotalScores = new Map<string, number>()

      scores?.forEach(entry => {
        const userId = entry.user_id
        const currentBest = userBestScores.get(userId)
        
        // Track game count and total score
        userGameCounts.set(userId, (userGameCounts.get(userId) || 0) + 1)
        userTotalScores.set(userId, (userTotalScores.get(userId) || 0) + entry.score)

        if (!currentBest || entry.score > currentBest.score) {
          userBestScores.set(userId, entry)
        }
      })

      // Format the data
      const leaderboardData: EnhancedLeaderboardEntry[] = Array.from(userBestScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(offset, offset + limit)
        .map((entry, index) => {
          const profile = entry.user_profiles as any
          return {
            user_id: entry.user_id,
            username: profile?.username || 'Anonymous',
            display_name: profile?.display_name || profile?.username || 'Anonymous',
            avatar_url: profile?.avatar_url,
            country_code: profile?.country_code,
            is_pro_member: profile?.is_pro_member || false,
            score: entry.score,
            games_played: userGameCounts.get(entry.user_id) || 1,
            total_score: userTotalScores.get(entry.user_id) || entry.score,
            last_played: entry.created_at,
            rank_position: offset + index + 1
          }
        })

      return { success: true, data: leaderboardData }
    } catch (error) {
      logSupabaseError('getGameLeaderboardFallback', error, { gameKey })
      return { success: false, error: (error as Error).message, data: [] }
    }
  }

  /**
   * Get user's rankings across all games
   */
  async getUserRankings(userId?: string): Promise<{ success: boolean; error?: string; data: UserRanking[] }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured', data: [] }
    }

    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id
      if (!targetUserId) {
        return { success: false, error: 'User not found', data: [] }
      }

      logInfo('Fetching User Rankings', { userId: targetUserId })

      // Try stored procedure first
      const { data, error } = await supabase
        .rpc('get_user_rankings', { p_user_id: targetUserId })

      if (error) {
        // Fallback implementation
        return this.getUserRankingsFallback(targetUserId)
      }

      logInfo('User Rankings Fetched Successfully', { userId: targetUserId, count: data?.length })
      return { success: true, data: data || [] }
    } catch (error) {
      logSupabaseError('getUserRankings', error, { userId })
      return { success: false, error: (error as Error).message, data: [] }
    }
  }

  /**
   * Fallback method for user rankings
   */
  private async getUserRankingsFallback(userId: string): Promise<{ success: boolean; error?: string; data: UserRanking[] }> {
    try {
      // Get user's best scores per game
      const { data: userScores, error: userError } = await supabase
        .from('leaderboard_scores')
        .select('game_key, score')
        .eq('user_id', userId)

      if (userError) throw userError

      const rankings: UserRanking[] = []

      // For each game the user has played
      for (const userScore of userScores || []) {
        // Get total players and user's ranking for this game
        const { data: gameScores, error: gameError } = await supabase
          .from('leaderboard_scores')
          .select('user_id, score')
          .eq('game_key', userScore.game_key)
          .order('score', { ascending: false })

        if (gameError) continue

        // Find user's best score for this game
        const userBestScore = Math.max(...userScores.filter(s => s.game_key === userScore.game_key).map(s => s.score))
        
        // Calculate ranking
        const uniqueUsers = new Map<string, number>()
        gameScores?.forEach(entry => {
          const currentBest = uniqueUsers.get(entry.user_id) || 0
          if (entry.score > currentBest) {
            uniqueUsers.set(entry.user_id, entry.score)
          }
        })

        const sortedScores = Array.from(uniqueUsers.values()).sort((a, b) => b - a)
        const userRank = sortedScores.findIndex(score => score === userBestScore) + 1
        const totalPlayers = uniqueUsers.size
        const percentile = totalPlayers > 0 ? Math.round((1 - (userRank / totalPlayers)) * 100 * 100) / 100 : 0

        // Only add if not already added for this game
        if (!rankings.find(r => r.game_key === userScore.game_key)) {
          rankings.push({
            game_key: userScore.game_key,
            best_score: userBestScore,
            rank_position: userRank,
            total_players: totalPlayers,
            percentile
          })
        }
      }

      return { success: true, data: rankings }
    } catch (error) {
      logSupabaseError('getUserRankingsFallback', error, { userId })
      return { success: false, error: (error as Error).message, data: [] }
    }
  }

  /**
   * Get game statistics
   */
  async getGameStatistics(): Promise<{ success: boolean; error?: string; data: GameStats[] }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured', data: [] }
    }

    try {
      logInfo('Fetching Game Statistics')

      // Try to get from game_statistics table first
      const { data: gameStats, error: statsError } = await supabase
        .from('game_statistics')
        .select('*')
        .order('total_players', { ascending: false })

      if (!statsError && gameStats && gameStats.length > 0) {
        logInfo('Game Statistics Fetched from Table', { count: gameStats.length })
        return { success: true, data: gameStats }
      }

      // Fallback: calculate from leaderboard_scores
      const { data: scores, error } = await supabase
        .from('leaderboard_scores')
        .select('game_key, score, user_id, created_at')

      if (error) throw error

      // Aggregate statistics per game
      const gameStatsMap = new Map<string, GameStats>()

      scores?.forEach(entry => {
        const gameKey = entry.game_key
        if (!gameStatsMap.has(gameKey)) {
          gameStatsMap.set(gameKey, {
            game_key: gameKey,
            total_players: 0,
            total_games_played: 0,
            total_scores_submitted: 0,
            highest_score: 0,
            average_score: 0,
            featured_priority: 0,
            last_activity: entry.created_at
          })
        }

        const stats = gameStatsMap.get(gameKey)!
        stats.total_games_played += 1
        stats.total_scores_submitted += 1
        stats.highest_score = Math.max(stats.highest_score, entry.score)
        
        if (entry.created_at > stats.last_activity) {
          stats.last_activity = entry.created_at
        }
      })

      // Calculate unique players and average scores
      for (const [gameKey, stats] of gameStatsMap) {
        const gameScores = scores?.filter(s => s.game_key === gameKey) || []
        const uniqueUsers = new Set(gameScores.map(s => s.user_id))
        stats.total_players = uniqueUsers.size
        stats.average_score = gameScores.length > 0 ? 
          gameScores.reduce((sum, s) => sum + s.score, 0) / gameScores.length : 0
      }

      const result = Array.from(gameStatsMap.values())
        .sort((a, b) => b.total_players - a.total_players)

      logInfo('Game Statistics Calculated Successfully', { count: result.length })
      return { success: true, data: result }
    } catch (error) {
      logSupabaseError('getGameStatistics', error)
      return { success: false, error: (error as Error).message, data: [] }
    }
  }

  /**
   * Update global rankings (admin function)
   */
  async updateGlobalRankings(): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      logInfo('Updating Global Rankings')

      const { error } = await supabase.rpc('update_global_rankings')
      
      if (error) {
        logSupabaseError('updateGlobalRankings', error)
        return { success: false, error: error.message }
      }

      logInfo('Global Rankings Updated Successfully')
      return { success: true }
    } catch (error) {
      logSupabaseError('updateGlobalRankings', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Subscribe to leaderboard changes for real-time updates
   */
  subscribeToLeaderboardChanges(gameKey: string, callback: (payload: any) => void) {
    if (!supabase) return null

    return supabase
      .channel(`leaderboard:${gameKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard_scores',
          filter: `game_key=eq.${gameKey}`
        },
        callback
      )
      .subscribe()
  }

  /**
   * Subscribe to global leaderboard changes
   */
  subscribeToGlobalChanges(callback: (payload: any) => void) {
    if (!supabase) return null

    return supabase
      .channel('global_leaderboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_user_stats'
        },
        callback
      )
      .subscribe()
  }
}

// Export singleton instance
export const enhancedLeaderboardService = new EnhancedLeaderboardService()
export default enhancedLeaderboardService
