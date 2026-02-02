import { supabase } from '../main';

const GAME_KEY = 'wordavoid';

export interface LeaderboardScore {
  id: string;
  user_id: string | null;
  game_key: string;
  score: number;
  player_name: string;
  is_verified: boolean;
  metadata?: {
    wpm?: number;
    accuracy?: number;
    words_typed?: number;
    mode?: string;
    level?: number;
  };
  created_at: string;
  user_profiles?: {
    username: string;
    display_name: string;
    avatar_url?: string;
    country_code?: string;
    is_pro_member?: boolean;
  };
}

export class LeaderboardAPI {
  static async getTopScores(limit: number = 50): Promise<LeaderboardScore[]> {
    const { data, error } = await supabase
      .from('leaderboard_scores')
      .select(`
        *,
        user_profiles (
          username,
          display_name,
          avatar_url,
          country_code,
          is_pro_member
        )
      `)
      .eq('game_key', GAME_KEY)
      .eq('is_verified', true)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  }

  static async getPlayerRank(score: number): Promise<number> {
    const { count, error } = await supabase
      .from('leaderboard_scores')
      .select('*', { count: 'exact', head: true })
      .eq('game_key', GAME_KEY)
      .eq('is_verified', true)
      .gt('score', score);

    if (error) {
      console.error('Error getting player rank:', error);
      return 0;
    }

    return (count || 0) + 1;
  }

  static async submitGuestScore(
    playerName: string,
    score: number,
    metadata?: LeaderboardScore['metadata']
  ): Promise<{ success: boolean; data?: any }> {
    const gameSessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Submitting guest score:', { playerName, score, gameSessionId });

    const { data, error } = await supabase
      .from('leaderboard_scores')
      .insert({
        player_name: playerName,
        score,
        game_key: GAME_KEY,
        is_verified: false,
        user_id: null,
        game_session_id: gameSessionId,
        metadata
      })
      .select();

    if (error) {
      console.error('Error submitting guest score:', error);
      return { success: false };
    }

    console.log('Guest score submitted successfully:', data);
    return { success: true, data: data?.[0] };
  }

  static async submitVerifiedScore(
    playerName: string,
    score: number,
    userId: string,
    metadata?: LeaderboardScore['metadata']
  ): Promise<boolean> {
    const gameSessionId = `verified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { error } = await supabase
      .from('leaderboard_scores')
      .insert({
        player_name: playerName,
        score,
        game_key: GAME_KEY,
        is_verified: true,
        user_id: userId,
        game_session_id: gameSessionId,
        metadata
      });

    if (error) {
      console.error('Error submitting verified score:', error);
      return false;
    }

    return true;
  }

  static async getUserBestScore(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('leaderboard_scores')
      .select('score')
      .eq('user_id', userId)
      .eq('game_key', GAME_KEY)
      .eq('is_verified', true)
      .order('score', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return 0;
    }

    return data.score;
  }

  static subscribeToLeaderboard(callback: (scores: LeaderboardScore[]) => void) {
    let debounceTimer: NodeJS.Timeout | null = null;

    const debouncedCallback = async () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        const scores = await this.getTopScores();
        callback(scores);
      }, 500);
    };

    const subscription = supabase
      .channel(`leaderboard_changes:${GAME_KEY}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leaderboard_scores',
          filter: `game_key=eq.${GAME_KEY}`
        },
        debouncedCallback
      )
      .subscribe();

    return subscription;
  }
}
