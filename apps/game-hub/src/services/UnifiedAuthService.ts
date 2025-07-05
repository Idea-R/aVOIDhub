import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js'

export interface UnifiedUser {
  id: string
  email: string | null
  username: string | null
  avatar_url: string | null
  created_at: string
  last_sign_in_at: string | null
  // Game-specific preferences
  voidavoid_best_score?: number
  wreckavoid_best_score?: number
  tankavoid_best_score?: number
  // Cross-game stats
  total_games_played: number
  total_time_played: number
  favorite_game?: string
  achievements: string[]
}

export interface GameSession {
  user: UnifiedUser
  session: Session
  currentGame: string
  isAuthenticated: boolean
}

export interface LeaderboardEntry {
  id: string
  user_id: string
  game_key: string
  score: number
  username: string
  achieved_at: string
}

export class UnifiedAuthService {
  private supabase: SupabaseClient
  private currentSession: GameSession | null = null
  private authListeners: Array<(session: GameSession | null) => void> = []
  private readonly STORAGE_KEY = 'avoidgame_auth_session'

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase credentials not found - auth will be disabled')
      this.supabase = createClient('https://placeholder.supabase.co', 'placeholder-key')
      return
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey)
    this.initializeAuth()
  }

  private async initializeAuth() {
    // Listen for auth changes
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.id)
      
      if (session?.user) {
        const unifiedUser = await this.getOrCreateUnifiedUser(session.user)
        this.currentSession = {
          user: unifiedUser,
          session,
          currentGame: this.getCurrentGame(),
          isAuthenticated: true
        }
        
        // Store session in localStorage for cross-game persistence
        this.storeSessionData(this.currentSession)
        
        // Update last sign in
        await this.updateLastSignIn(session.user.id)
        
        // Track game session
        await this.trackGameSession(session.user.id, this.getCurrentGame())
      } else {
        this.currentSession = null
        this.clearSessionData()
      }
      
      // Notify all listeners
      this.authListeners.forEach(listener => listener(this.currentSession))
    })

    // Check for existing session
    const { data: { session } } = await this.supabase.auth.getSession()
    if (session?.user) {
      const unifiedUser = await this.getOrCreateUnifiedUser(session.user)
      this.currentSession = {
        user: unifiedUser,
        session,
        currentGame: this.getCurrentGame(),
        isAuthenticated: true
      }
      this.storeSessionData(this.currentSession)
    }
  }

  private getCurrentGame(): string {
    const hostname = window.location.hostname
    const pathname = window.location.pathname
    
    // Determine current game based on URL
    if (hostname.includes('voidavoid') || pathname.includes('/void')) return 'voidavoid'
    if (hostname.includes('wreckavoid') || pathname.includes('/wreck')) return 'wreckavoid'
    if (hostname.includes('tankavoid') || pathname.includes('/tank')) return 'tankavoid'
    if (hostname.includes('wordavoid') || pathname.includes('/word')) return 'wordavoid'
    return 'hub'
  }

  private async getOrCreateUnifiedUser(user: User): Promise<UnifiedUser> {
    try {
      // Check if user profile exists
      const { data: profile, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        // User doesn't exist, create new profile
        const newProfile = {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
          avatar_url: user.user_metadata?.avatar_url || null,
          created_at: new Date().toISOString(),
          total_games_played: 0,
          total_time_played: 0,
          achievements: []
        }

        const { data: insertedProfile, error: insertError } = await this.supabase
          .from('user_profiles')
          .insert([newProfile])
          .select()
          .single()

        if (insertError) {
          console.error('Error creating user profile:', insertError)
          throw insertError
        }

        return insertedProfile as UnifiedUser
      }

      if (error) {
        console.error('Error fetching user profile:', error)
        throw error
      }

      return profile as UnifiedUser
    } catch (error) {
      console.error('Error in getOrCreateUnifiedUser:', error)
      // Fallback to basic user data
      return {
        id: user.id,
        email: user.email ?? null,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
        avatar_url: user.user_metadata?.avatar_url ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        total_games_played: 0,
        total_time_played: 0,
        achievements: []
      }
    }
  }

  private async updateLastSignIn(userId: string) {
    try {
      await this.supabase
        .from('user_profiles')
        .update({ last_sign_in_at: new Date().toISOString() })
        .eq('id', userId)
    } catch (error) {
      console.error('Error updating last sign in:', error)
    }
  }

  private async trackGameSession(userId: string, game: string) {
    try {
      await this.supabase
        .from('game_sessions')
        .insert([{
          user_id: userId,
          game_key: game,
          started_at: new Date().toISOString(),
          last_activity: new Date().toISOString()
        }])
    } catch (error) {
      console.error('Error tracking game session:', error)
    }
  }

  private storeSessionData(session: GameSession) {
    try {
      const sessionData = {
        userId: session.user.id,
        email: session.user.email,
        username: session.user.username,
        avatar_url: session.user.avatar_url,
        currentGame: session.currentGame,
        timestamp: Date.now()
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData))
    } catch (error) {
      console.error('Error storing session data:', error)
    }
  }

  private clearSessionData() {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing session data:', error)
    }
  }

  // Public API methods
  public async signUp(email: string, password: string, username?: string) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0]
          }
        }
      })

      if (error) throw error

      return { success: true, data }
    } catch (error) {
      console.error('Sign up error:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public async signIn(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      return { success: true, data }
    } catch (error) {
      console.error('Sign in error:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut()
      if (error) throw error
      
      this.currentSession = null
      this.clearSessionData()
      
      return { success: true }
    } catch (error) {
      console.error('Sign out error:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public async signInWithGoogle() {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Google sign in error:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public async updateGameScore(game: string, score: number) {
    if (!this.currentSession?.user) return { success: false, error: 'Not authenticated' }

    try {
      const updates: any = {
        [`${game}_best_score`]: score
      }

      const { error } = await this.supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', this.currentSession.user.id)

      if (error) throw error

      // Also save to leaderboard
      await this.saveLeaderboardScore(game, score)

      return { success: true }
    } catch (error) {
      console.error('Error updating game score:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public async saveLeaderboardScore(game: string, score: number) {
    if (!this.currentSession?.user) return { success: false, error: 'Not authenticated' }

    try {
      const { error } = await this.supabase
        .from('leaderboard_scores')
        .insert([{
          user_id: this.currentSession.user.id,
          game_key: game,
          score,
          username: this.currentSession.user.username,
          achieved_at: new Date().toISOString()
        }])

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error saving leaderboard score:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  public async getLeaderboard(game: string, limit: number = 10) {
    try {
      const { data, error } = await this.supabase
        .from('leaderboard_scores')
        .select('*')
        .eq('game_key', game)
        .order('score', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { success: true, data: data as LeaderboardEntry[] }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      return { success: false, error: (error as Error).message, data: [] }
    }
  }

  public getCurrentSession(): GameSession | null {
    return this.currentSession
  }

  public isAuthenticated(): boolean {
    return this.currentSession?.isAuthenticated || false
  }

  public onAuthStateChange(callback: (session: GameSession | null) => void) {
    this.authListeners.push(callback)
    // Return unsubscribe function
    return () => {
      this.authListeners = this.authListeners.filter(listener => listener !== callback)
    }
  }

  public async switchGame(gameKey: string) {
    if (!this.currentSession) return

    // Update current game in session
    this.currentSession.currentGame = gameKey
    this.storeSessionData(this.currentSession)

    // Track the game switch
    await this.trackGameSession(this.currentSession.user.id, gameKey)

    // Notify listeners
    this.authListeners.forEach(listener => listener(this.currentSession))
  }
}

// Export singleton instance
export const unifiedAuth = new UnifiedAuthService()
export default unifiedAuth 