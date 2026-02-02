import { createClient } from '@supabase/supabase-js'
import { logSupabaseError, logAuthError, logInfo } from '../utils/errorTracking'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Missing Supabase credentials - using offline mode with mock data')
  console.warn('💡 Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file')
}

// Create Supabase client (will handle missing credentials gracefully)
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
}) : null

// Database Types
export interface User {
  id: string
  username: string
  display_name: string
  email?: string
  avatar_url?: string
  country_code?: string
  created_at: string
  updated_at: string
}

export interface Game {
  id: string
  game_key: string
  name: string
  description?: string
  icon_url?: string
  banner_url?: string
  play_url?: string
  is_active: boolean
  created_at: string
}

export interface LeaderboardScore {
  id: string
  user_id: string
  game_id: string
  score: number
  metadata?: any
  achieved_at: string
  user_profiles?: {
    username: string
    display_name: string
    avatar_url?: string
    country_code?: string
  }
}

export interface GameScore {
  id: string
  user_id: string
  game_id: string
  score: number
  metadata?: any
  session_id?: string
  achieved_at: string
}

// Enhanced User Profile with social media and pro features
export interface UserProfile {
  id: string
  username: string
  display_name: string
  bio?: string
  email?: string
  avatar_url?: string
  country_code?: string
  cursor_color: string
  social_links: {
    twitter?: string
    instagram?: string
    youtube?: string
    twitch?: string
    github?: string
    website?: string
  }
  is_public: boolean
  is_pro_member: boolean
  total_games_played: number
  total_meteors_destroyed: number
  total_survival_time: number
  total_distance_traveled: number
  best_game_score: number
  best_game_meteors: number
  best_game_time: number
  best_game_distance: number
  created_at: string
  updated_at: string
}

// Global leaderboard entry combining all games
export interface GlobalLeaderboardEntry {
  user_id: string
  username: string
  display_name: string
  avatar_url?: string
  country_code?: string
  social_links?: UserProfile['social_links']
  is_pro_member: boolean
  total_score: number
  games_played: number
  average_score: number
  best_game: string
  best_game_score: number
  rank: number
  total_achievements: number
}

// Game popularity for featured games selection
export interface GamePopularity {
  game_key: string
  game_name: string
  total_plays: number
  total_players: number
  average_score: number
  highest_score: number
  is_featured: boolean
}

// Leaderboard entry with enhanced profile data
export interface EnhancedLeaderboardEntry extends LeaderboardScore {
  rank: number
  user_profiles: {
    username: string
    display_name: string
    avatar_url?: string
    country_code?: string
    social_links?: UserProfile['social_links']
    is_pro_member: boolean
  }
}

// Auth helpers
export const signIn = async (email: string, password: string) => {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    logInfo('Sign In Attempt', { email })
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      logAuthError('signIn', error, { metadata: { email } })
    } else {
      logInfo('Sign In Success', { metadata: { userId: data.user?.id } })
    }
    
    return { data, error }
  } catch (error) {
    logAuthError('signIn', error, { metadata: { email } })
    return { data: null, error }
  }
}

export const signUp = async (email: string, password: string, metadata?: any) => {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  })
  return { data, error }
}

export const signOut = async () => {
  if (!supabase) {
    return { error: new Error('Supabase not configured') }
  }
  
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async (): Promise<User | null> => {
  if (!supabase) {
    return null
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Get user profile from our database
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile) {
      return profile as User
    }

    // If no profile exists, return basic user info
    return {
      id: user.id,
      username: user.email?.split('@')[0] || 'user',
      display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
      email: user.email,
      avatar_url: user.user_metadata?.avatar_url,
      created_at: user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  } catch (error) {
    logAuthError('getCurrentUser', error)
    return null
  }
}

// Game data helpers
export const getGames = async () => {
  // If no Supabase client, return mock data immediately
  if (!supabase) {
    logInfo('Using mock data - Supabase not configured')
    return {
      data: [
        { id: '1', game_key: 'voidavoid', name: 'VOIDaVOID', description: 'Navigate through space avoiding obstacles', is_active: true, created_at: new Date().toISOString() },
        { id: '2', game_key: 'tankavoid', name: 'TankaVOID', description: 'Tank warfare meets cursor precision', is_active: true, created_at: new Date().toISOString() },
        { id: '3', game_key: 'wreckavoid', name: 'WreckaVOID', description: 'Demolition chaos with cursor control', is_active: true, created_at: new Date().toISOString() },
        { id: '4', game_key: 'wordavoid', name: 'WORDaVOID', description: 'Test your typing speed while avoiding falling words', is_active: true, created_at: new Date().toISOString() }
      ],
      error: null
    }
  }
  
  try {
    logInfo('Fetching Games')
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('is_active', true)
      .order('name')
    
    if (error) {
      logSupabaseError('getGames', error)
      // Return mock data when Supabase is unavailable
      return {
        data: [
          { id: '1', game_key: 'voidavoid', name: 'VOIDaVOID', description: 'Navigate through space avoiding obstacles', is_active: true, created_at: new Date().toISOString() },
          { id: '2', game_key: 'tankavoid', name: 'TankaVOID', description: 'Tank warfare meets cursor precision', is_active: true, created_at: new Date().toISOString() },
          { id: '3', game_key: 'wreckavoid', name: 'WreckaVOID', description: 'Demolition chaos with cursor control', is_active: true, created_at: new Date().toISOString() },
          { id: '4', game_key: 'wordavoid', name: 'WORDaVOID', description: 'Test your typing speed while avoiding falling words', is_active: true, created_at: new Date().toISOString() }
        ],
        error: null
      }
    } else {
      logInfo('Games Fetched Successfully', { metadata: { count: data?.length } })
    }
    
    return { data, error }
  } catch (error) {
    logSupabaseError('getGames', error)
    // Return mock data for offline/error scenarios
    return {
      data: [
        { id: '1', game_key: 'voidavoid', name: 'VOIDaVOID', description: 'Navigate through space avoiding obstacles', is_active: true, created_at: new Date().toISOString() },
        { id: '2', game_key: 'tankavoid', name: 'TankaVOID', description: 'Tank warfare meets cursor precision', is_active: true, created_at: new Date().toISOString() },
        { id: '3', game_key: 'wreckavoid', name: 'WreckaVOID', description: 'Demolition chaos with cursor control', is_active: true, created_at: new Date().toISOString() },
        { id: '4', game_key: 'wordavoid', name: 'WORDaVOID', description: 'Test your typing speed while avoiding falling words', is_active: true, created_at: new Date().toISOString() }
      ],
      error: null
    }
  }
}

export const getLeaderboard = async (gameKey: string, limit: number = 100) => {
  // If no Supabase client, return mock data immediately
  if (!supabase) {
    logInfo('Using mock leaderboard data - Supabase not configured')
    return {
      data: [
        { id: '1', user_id: 'demo1', score: 15420, achieved_at: new Date().toISOString(), user_profiles: { username: 'SpaceAce', display_name: 'Space Ace', avatar_url: null, country_code: 'US' } },
        { id: '2', user_id: 'demo2', score: 12350, achieved_at: new Date().toISOString(), user_profiles: { username: 'VoidMaster', display_name: 'Void Master', avatar_url: null, country_code: 'CA' } },
        { id: '3', user_id: 'demo3', score: 9875, achieved_at: new Date().toISOString(), user_profiles: { username: 'PixelPilot', display_name: 'Pixel Pilot', avatar_url: null, country_code: 'UK' } }
      ],
      error: null
    }
  }
  
  try {
    logInfo('Fetching Leaderboard', { metadata: { gameKey, limit } })
    const { data, error } = await supabase
      .from('leaderboard_scores')
      .select(`
        *,
        user_profiles (
          username,
          display_name,
          avatar_url,
          country_code
        )
      `)
      .eq('game_key', gameKey)
      .order('score', { ascending: false })
      .limit(limit)
    
    if (error) {
      logSupabaseError('getLeaderboard', error, { metadata: { gameKey, limit } })
      // Return mock leaderboard data
      return {
        data: [
          { id: '1', user_id: 'demo1', score: 15420, achieved_at: new Date().toISOString(), user_profiles: { username: 'SpaceAce', display_name: 'Space Ace', avatar_url: null, country_code: 'US' } },
          { id: '2', user_id: 'demo2', score: 12350, achieved_at: new Date().toISOString(), user_profiles: { username: 'VoidMaster', display_name: 'Void Master', avatar_url: null, country_code: 'CA' } },
          { id: '3', user_id: 'demo3', score: 9875, achieved_at: new Date().toISOString(), user_profiles: { username: 'PixelPilot', display_name: 'Pixel Pilot', avatar_url: null, country_code: 'UK' } }
        ],
        error: null
      }
    } else {
      logInfo('Leaderboard Fetched Successfully', { metadata: { gameKey, count: data?.length } })
    }
    
    return { data, error }
  } catch (error) {
    logSupabaseError('getLeaderboard', error, { metadata: { gameKey, limit } })
    // Return mock leaderboard data for offline scenarios
    return {
      data: [
        { id: '1', user_id: 'demo1', score: 15420, achieved_at: new Date().toISOString(), user_profiles: { username: 'SpaceAce', display_name: 'Space Ace', avatar_url: null, country_code: 'US' } },
        { id: '2', user_id: 'demo2', score: 12350, achieved_at: new Date().toISOString(), user_profiles: { username: 'VoidMaster', display_name: 'Void Master', avatar_url: null, country_code: 'CA' } },
        { id: '3', user_id: 'demo3', score: 9875, achieved_at: new Date().toISOString(), user_profiles: { username: 'PixelPilot', display_name: 'Pixel Pilot', avatar_url: null, country_code: 'UK' } }
      ],
      error: null
    }
  }
}

export const submitScore = async (gameKey: string, score: number, metadata?: any) => {
  const user = await getCurrentUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase
    .from('leaderboard_scores')
    .insert({
      user_id: user.id,
      game_key: gameKey,
      score,
      metadata
    })
    .select()
    .single()
  
  return { data, error }
}

export const getUserProfile = async (userId?: string) => {
  const targetUserId = userId || (await getCurrentUser())?.id
  if (!targetUserId) {
    return { data: null, error: new Error('No user ID provided') }
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', targetUserId)
    .single()
  
  return { data, error }
}

export const updateUserProfile = async (updates: Partial<User>) => {
  const user = await getCurrentUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()
  
  return { data, error }
}

// Real-time subscriptions
export const subscribeToLeaderboard = (gameKey: string, callback: (payload: any) => void) => {
  return supabase
    .channel(`leaderboard:${gameKey}`)
    .on('postgres_changes', 
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

export const subscribeToUserProfile = (userId: string, callback: (payload: any) => void) => {
  return supabase
    .channel(`profile:${userId}`)
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_profiles',
        filter: `id=eq.${userId}`
      },
      callback
    )
    .subscribe()
}

// Platform stats for homepage
export interface PlatformStats {
  activePlayers: number
  gamesAvailable: number
  highScores: number
}

export const getPlatformStats = async (): Promise<PlatformStats> => {
  // Default stats
  const defaultStats: PlatformStats = {
    activePlayers: 0,
    gamesAvailable: 4, // We know we have 4 games
    highScores: 0
  }

  if (!supabase) {
    return defaultStats
  }

  try {
    // Get unique player count from leaderboard scores
    const { count: playerCount } = await supabase
      .from('leaderboard_scores')
      .select('user_id', { count: 'exact', head: true })

    // Get total high scores count
    const { count: scoresCount } = await supabase
      .from('leaderboard_scores')
      .select('*', { count: 'exact', head: true })

    // Get active games count
    const { count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    return {
      activePlayers: playerCount || 0,
      gamesAvailable: gamesCount || 4,
      highScores: scoresCount || 0
    }
  } catch (error) {
    logSupabaseError('getPlatformStats', error)
    return defaultStats
  }
} 