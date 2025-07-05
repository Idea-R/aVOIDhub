// avoid-games-sdk.ts
// Complete SDK for integrating games with the aVOID platform

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export interface AvoidConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  gameKey: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio?: string;
  quote?: string;
  avatar_url?: string;
  banner_url?: string;
  country_code?: string;
  subscription_tier: 'free' | 'pro' | 'premium' | 'developer';
  global_score: number;
  theme_color: string;
  social_links?: SocialLink[];
}

export interface SocialLink {
  platform: string;
  url: string;
  display_order: number;
}

export interface Score {
  id: string;
  user_id: string;
  game_id: string;
  score: number;
  metadata?: any;
  achieved_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user: {
    username: string;
    display_name: string;
    avatar_url?: string;
    country_code?: string;
  };
  score: number;
  achieved_at: string;
}

export interface GameStats {
  games_played: number;
  total_score: number;
  high_score: number;
  average_score: number;
  global_rank: number;
  achievements_unlocked: number;
}

export interface Achievement {
  id: string;
  achievement_key: string;
  name: string;
  description: string;
  icon_url?: string;
  points: number;
  rarity: string;
  unlocked?: boolean;
  unlocked_at?: string;
}

class AvoidGamesSDK {
  private supabase: SupabaseClient;
  private gameKey: string;
  private gameId?: string;
  private currentUser?: User;
  private profile?: Profile;
  
  constructor(config: AvoidConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    this.gameKey = config.gameKey;
    this.initialize();
  }

  private async initialize() {
    // Get game ID
    const { data: game } = await this.supabase
      .from('games')
      .select('id')
      .eq('game_key', this.gameKey)
      .single();
    
    if (game) {
      this.gameId = game.id;
    }

    // Check for existing session
    const { data: { user } } = await this.supabase.auth.getUser();
    if (user) {
      this.currentUser = user;
      await this.loadProfile();
    }

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      this.currentUser = session?.user || undefined;
      if (this.currentUser) {
        await this.loadProfile();
      } else {
        this.profile = undefined;
      }
    });
  }

  // Authentication methods
  async signUp(email: string, password: string, username: string, displayName?: string) {
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    if (authData.user) {
      // Create profile
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username,
          display_name: displayName || username,
        });

      if (profileError) throw profileError;
      
      await this.loadProfile();
    }

    return authData;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    
    await this.loadProfile();
    return data;
  }

  async signInWithProvider(provider: 'google' | 'facebook' | 'twitter') {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    
    this.currentUser = undefined;
    this.profile = undefined;
  }

  // Profile methods
  async loadProfile() {
    if (!this.currentUser) return null;

    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        *,
        social_links (
          platform,
          url,
          display_order
        )
      `)
      .eq('id', this.currentUser.id)
      .single();

    if (error) throw error;
    
    this.profile = data;
    return data;
  }

  async updateProfile(updates: Partial<Profile>) {
    if (!this.currentUser) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', this.currentUser.id)
      .select()
      .single();

    if (error) throw error;
    
    this.profile = data;
    return data;
  }

  async addSocialLink(platform: string, url: string) {
    if (!this.currentUser) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('social_links')
      .upsert({
        user_id: this.currentUser.id,
        platform,
        url,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Score and leaderboard methods
  async submitScore(score: number, metadata?: any) {
    if (!this.currentUser || !this.gameId) {
      throw new Error('Not authenticated or game not found');
    }

    // Get default leaderboard
    const { data: leaderboard } = await this.supabase
      .from('leaderboards')
      .select('id')
      .eq('game_id', this.gameId)
      .eq('leaderboard_key', 'high_score')
      .single();

    if (!leaderboard) {
      throw new Error('Leaderboard not found');
    }

    const { data, error } = await this.supabase
      .from('scores')
      .insert({
        user_id: this.currentUser.id,
        game_id: this.gameId,
        leaderboard_id: leaderboard.id,
        score,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;

    // Get rank
    const { count } = await this.supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('leaderboard_id', leaderboard.id)
      .gt('score', score);

    const rank = (count || 0) + 1;

    return {
      ...data,
      rank,
      isPersonalBest: await this.isPersonalBest(score, leaderboard.id),
    };
  }

  private async isPersonalBest(score: number, leaderboardId: string): Promise<boolean> {
    if (!this.currentUser) return false;

    const { data } = await this.supabase
      .from('scores')
      .select('score')
      .eq('user_id', this.currentUser.id)
      .eq('leaderboard_id', leaderboardId)
      .order('score', { ascending: false })
      .limit(1)
      .single();

    return !data || score > data.score;
  }

  async getLeaderboard(
    options: {
      limit?: number;
      offset?: number;
      timeframe?: 'all' | 'daily' | 'weekly' | 'monthly';
      scope?: 'global' | 'country' | 'friends';
    } = {}
  ): Promise<LeaderboardEntry[]> {
    if (!this.gameId) throw new Error('Game not found');

    const { limit = 100, offset = 0, timeframe = 'all' } = options;

    // Get leaderboard ID
    const { data: leaderboard } = await this.supabase
      .from('leaderboards')
      .select('id')
      .eq('game_id', this.gameId)
      .eq('leaderboard_key', 'high_score')
      .single();

    if (!leaderboard) throw new Error('Leaderboard not found');

    let query = this.supabase
      .from('scores')
      .select(`
        score,
        achieved_at,
        user:profiles!user_id (
          username,
          display_name,
          avatar_url,
          country_code
        )
      `)
      .eq('leaderboard_id', leaderboard.id)
      .order('score', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply timeframe filter
    if (timeframe !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (timeframe) {
        case 'daily':
          startDate = new Date(now.setDate(now.getDate() - 1));
          break;
        case 'weekly':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'monthly':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          startDate = new Date(0);
      }

      query = query.gte('achieved_at', startDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map((entry, index) => ({
      rank: offset + index + 1,
      user: entry.user,
      score: entry.score,
      achieved_at: entry.achieved_at,
    }));
  }

  async getGlobalLeaderboard(limit: number = 100): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('global_leaderboard')
      .select('*')
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getUserStats(userId?: string): Promise<GameStats> {
    const targetUserId = userId || this.currentUser?.id;
    if (!targetUserId || !this.gameId) {
      throw new Error('User ID and game ID required');
    }

    const { data: scores } = await this.supabase
      .from('scores')
      .select('score')
      .eq('user_id', targetUserId)
      .eq('game_id', this.gameId);

    if (!scores || scores.length === 0) {
      return {
        games_played: 0,
        total_score: 0,
        high_score: 0,
        average_score: 0,
        global_rank: 0,
        achievements_unlocked: 0,
      };
    }

    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    const highScore = Math.max(...scores.map(s => s.score));

    // Get global rank
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('global_score')
      .eq('id', targetUserId)
      .single();

    const { count: rankCount } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gt('global_score', profile?.global_score || 0);

    return {
      games_played: scores.length,
      total_score: totalScore,
      high_score: highScore,
      average_score: Math.round(totalScore / scores.length),
      global_rank: (rankCount || 0) + 1,
      achievements_unlocked: 0, // TODO: Implement achievements count
    };
  }

  // Achievement methods
  async getAchievements(): Promise<Achievement[]> {
    if (!this.gameId) throw new Error('Game not found');

    const { data, error } = await this.supabase
      .from('achievements')
      .select(`
        *,
        user_achievements!left (
          unlocked_at
        )
      `)
      .eq('game_id', this.gameId)
      .eq('user_achievements.user_id', this.currentUser?.id);

    if (error) throw error;

    return data.map(achievement => ({
      ...achievement,
      unlocked: !!achievement.user_achievements?.[0],
      unlocked_at: achievement.user_achievements?.[0]?.unlocked_at,
    }));
  }

  async unlockAchievement(achievementKey: string) {
    if (!this.currentUser || !this.gameId) {
      throw new Error('Not authenticated or game not found');
    }

    // Get achievement
    const { data: achievement } = await this.supabase
      .from('achievements')
      .select('id, points')
      .eq('game_id', this.gameId)
      .eq('achievement_key', achievementKey)
      .single();

    if (!achievement) throw new Error('Achievement not found');

    // Unlock achievement
    const { error } = await this.supabase
      .from('user_achievements')
      .insert({
        user_id: this.currentUser.id,
        achievement_id: achievement.id,
      });

    if (error && error.code !== '23505') { // Ignore if already unlocked
      throw error;
    }

    return achievement;
  }

  // Subscription methods
  async getSubscriptionStatus() {
    if (!this.profile) return null;

    return {
      tier: this.profile.subscription_tier,
      hasAdsDisabled: this.profile.subscription_tier !== 'free',
      canUploadGames: ['developer', 'premium'].includes(this.profile.subscription_tier),
      customizationLevel: this.getCustomizationLevel(this.profile.subscription_tier),
    };
  }

  private getCustomizationLevel(tier: string): number {
    const levels: Record<string, number> = {
      free: 1,
      pro: 2,
      premium: 3,
      developer: 3,
    };
    return levels[tier] || 1;
  }

  // Real-time subscriptions
  subscribeToLeaderboard(callback: (payload: any) => void) {
    if (!this.gameId) throw new Error('Game not found');

    return this.supabase
      .channel(`leaderboard:${this.gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scores',
          filter: `game_id=eq.${this.gameId}`,
        },
        callback
      )
      .subscribe();
  }

  subscribeToMessages(callback: (payload: any) => void) {
    if (!this.currentUser) throw new Error('Not authenticated');

    return this.supabase
      .channel(`messages:${this.currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${this.currentUser.id}`,
        },
        callback
      )
      .subscribe();
  }

  // Friend system
  async sendFriendRequest(username: string) {
    if (!this.currentUser) throw new Error('Not authenticated');

    // Get friend's ID
    const { data: friend } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (!friend) throw new Error('User not found');

    const { error } = await this.supabase
      .from('friendships')
      .insert({
        user_id: this.currentUser.id,
        friend_id: friend.id,
        status: 'pending',
      });

    if (error) throw error;
  }

  async getFriends() {
    if (!this.currentUser) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('friendships')
      .select(`
        friend:profiles!friend_id (
          id,
          username,
          display_name,
          avatar_url,
          global_score
        )
      `)
      .eq('user_id', this.currentUser.id)
      .eq('status', 'accepted');

    if (error) throw error;
    return data.map(f => f.friend);
  }

  // Developer features
  async uploadGame(gameData: {
    game_key: string;
    name: string;
    description: string;
    play_url: string;
    icon_url?: string;
    banner_url?: string;
    repo_url?: string;
    tags?: string[];
  }) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    // Check if user has developer privileges
    if (!['developer', 'premium'].includes(this.profile?.subscription_tier || '')) {
      throw new Error('Developer or Premium subscription required');
    }

    const { data, error } = await this.supabase
      .from('games')
      .insert({
        ...gameData,
        developer_id: this.currentUser.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getMyGames() {
    if (!this.currentUser) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('games')
      .select('*')
      .eq('developer_id', this.currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getGameStats(gameKey: string, dateRange?: { start: Date; end: Date }) {
    if (!this.currentUser) throw new Error('Not authenticated');

    // Get game
    const { data: game } = await this.supabase
      .from('games')
      .select('id')
      .eq('game_key', gameKey)
      .eq('developer_id', this.currentUser.id)
      .single();

    if (!game) throw new Error('Game not found or access denied');

    let query = this.supabase
      .from('developer_stats')
      .select('*')
      .eq('game_id', game.id)
      .order('date', { ascending: false });

    if (dateRange) {
      query = query
        .gte('date', dateRange.start.toISOString())
        .lte('date', dateRange.end.toISOString());
    } else {
      query = query.limit(30); // Last 30 days by default
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Ad-related methods
  async recordAdImpression(adType: 'banner' | 'interstitial' | 'rewarded') {
    if (!this.gameId) return;

    await this.supabase
      .from('ad_impressions')
      .insert({
        user_id: this.currentUser?.id,
        game_id: this.gameId,
        ad_type: adType,
      });
  }

  async shouldShowAds(): Promise<boolean> {
    if (!this.profile) return true;
    return this.profile.show_ads && this.profile.subscription_tier === 'free';
  }

  // Utility methods
  async searchUsers(query: string, limit: number = 10) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getGame(gameKey: string) {
    const { data, error } = await this.supabase
      .from('games')
      .select('*')
      .eq('game_key', gameKey)
      .single();

    if (error) throw error;
    return data;
  }

  async getAllGames(options: {
    limit?: number;
    offset?: number;
    category?: string;
    sortBy?: 'popular' | 'newest' | 'rating';
  } = {}) {
    const { limit = 20, offset = 0, category, sortBy = 'popular' } = options;

    let query = this.supabase
      .from('games')
      .select('*')
      .eq('status', 'approved')
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    switch (sortBy) {
      case 'popular':
        query = query.order('total_players', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'rating':
        query = query.order('rating', { ascending: false });
        break;
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Helper methods
  getCurrentUser() {
    return this.currentUser;
  }

  getProfile() {
    return this.profile;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  async uploadFile(file: File, bucket: string = 'avatars'): Promise<string> {
    if (!this.currentUser) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${this.currentUser.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await this.supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return data.publicUrl;
  }
}

// Export types and SDK
export default AvoidGamesSDK;
export type { AvoidGamesSDK };

// Usage example for game developers
/*
// Initialize SDK in your game
const avoidSDK = new AvoidGamesSDK({
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  gameKey: 'your-game-key'
});

// Sign in
await avoidSDK.signIn('player@example.com', 'password');

// Submit score
const result = await avoidSDK.submitScore(10000, {
  level: 5,
  time_played: 300,
  enemies_destroyed: 50
});

console.log(`You ranked #${result.rank}!`);

// Get leaderboard
const leaderboard = await avoidSDK.getLeaderboard({ limit: 10 });

// Subscribe to real-time updates
avoidSDK.subscribeToLeaderboard((payload) => {
  console.log('New high score!', payload);
});
*/