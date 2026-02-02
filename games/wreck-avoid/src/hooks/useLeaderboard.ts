import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const GAME_KEY = 'wreckavoid';

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  game_key: string;
  score: number;
  player_name: string;
  metadata?: {
    wave?: number;
    survival_time?: number;
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

export function useLeaderboard() {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
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
        .order('score', { ascending: false })
        .limit(50);

      if (error) throw error;

      setScores(data || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const submitScore = async (score: number, wave: number, survivalTime: number, userId: string) => {
    // Don't submit if no user ID (guest mode)
    if (!userId) {
      return { data: null, error: null };
    }

    try {
      // Get user profile for player name
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, display_name')
        .eq('id', userId)
        .single();

      const playerName = profile?.username || profile?.display_name || 'Anonymous';

      const { data, error } = await supabase
        .from('leaderboard_scores')
        .insert({
          user_id: userId,
          game_key: GAME_KEY,
          score,
          player_name: playerName,
          metadata: {
            wave,
            survival_time: survivalTime,
          },
          is_verified: true
        })
        .select()
        .single();

      if (error) throw error;

      await fetchLeaderboard();
      return { data, error: null };
    } catch (error) {
      console.error('Error submitting score:', error);
      return { data: null, error };
    }
  };

  return {
    scores,
    loading,
    submitScore,
    refetch: fetchLeaderboard,
  };
}
