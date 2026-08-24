import { useState, useEffect } from "react";
import {
  supabase,
  supabaseConfigured,
  GameScore,
} from "../lib/supabase";
import { finishPlatformRun } from "../api/platformRuns";
import type { GameState } from "../types/Game";
import { WRECK_RUN_RULESET_VERSION } from "../game/WreckRunDirector";

export function useLeaderboard() {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async () => {
    if (!supabaseConfigured) {
      setScores([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('id, user_id, player_name, score, metadata, created_at')
        .eq('game_key', 'wreckavoid')
        .contains('metadata', { rulesetVersion: WRECK_RUN_RULESET_VERSION })
        .order('score', { ascending: false })
        .limit(50);

      if (error) throw error;
      const userIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean))] as string[];
      const { data: profiles } = userIds.length
        ? await supabase.from('user_profiles').select('*').in('id', userIds)
        : { data: [] };
      const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));

      setScores((data || []).map((row) => {
        const metadata = (row.metadata || {}) as { wave?: number; survival_time?: number };
        const profile = row.user_id ? profilesById.get(row.user_id) : undefined;
        return {
          id: row.id,
          user_id: row.user_id || '',
          score: row.score,
          wave: Number(metadata.wave || 0),
          survival_time: Number(metadata.survival_time || 0),
          created_at: row.created_at || '',
          user_profile: profile || (row.player_name ? { id: '', username: row.player_name, bio: '', created_at: '', updated_at: '' } : undefined),
        };
      }));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching leaderboard:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const submitScore = async (
    score: number,
    wave: number,
    survivalTime: number,
    bossesDefeated: number,
    outcome: GameState["runOutcome"],
  ) => {
    try {
      const accepted = await finishPlatformRun(
        score,
        wave,
        survivalTime,
        bossesDefeated,
        outcome,
      );
      await fetchLeaderboard();
      return { data: accepted ? { score, wave, survival_time: survivalTime } : null, error: null };
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
