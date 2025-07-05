import { useState, useEffect } from 'react';
import { supabase, GameScore } from '../lib/supabase';

export function useLeaderboard() {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_scores')
        .select(`
          *,
          user_profile:user_profiles(*)
        `)
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
      const { data, error } = await supabase
        .from('game_scores')
        .insert({
          user_id: userId,
          score,
          wave,
          survival_time: survivalTime,
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