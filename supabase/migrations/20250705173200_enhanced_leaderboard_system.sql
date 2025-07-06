-- Enhanced Global Leaderboard System Migration
-- This migration adds comprehensive leaderboard support with triggers and functions

-- Create enhanced user stats tracking
CREATE TABLE IF NOT EXISTS user_game_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  game_key TEXT NOT NULL,
  total_score BIGINT DEFAULT 0,
  best_score BIGINT DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  total_time_played INTEGER DEFAULT 0, -- in seconds
  last_played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  achievements JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, game_key)
);

-- Create global user statistics aggregation table
CREATE TABLE IF NOT EXISTS global_user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score BIGINT DEFAULT 0,
  total_games_played INTEGER DEFAULT 0,
  total_time_played INTEGER DEFAULT 0,
  unique_games_played INTEGER DEFAULT 0,
  best_single_score BIGINT DEFAULT 0,
  best_game_key TEXT,
  average_score DECIMAL(10,2) DEFAULT 0,
  rank_position INTEGER,
  last_score_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game statistics table
CREATE TABLE IF NOT EXISTS game_statistics (
  game_key TEXT PRIMARY KEY,
  total_players INTEGER DEFAULT 0,
  total_games_played INTEGER DEFAULT 0,
  total_scores_submitted INTEGER DEFAULT 0,
  highest_score BIGINT DEFAULT 0,
  average_score DECIMAL(10,2) DEFAULT 0,
  featured_priority INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leaderboard periods table for seasonal/monthly leaderboards
CREATE TABLE IF NOT EXISTS leaderboard_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly', 'all_time')),
  game_key TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to update user game stats when a score is submitted
CREATE OR REPLACE FUNCTION update_user_game_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user game stats
  INSERT INTO user_game_stats (
    user_id, 
    game_key, 
    total_score, 
    best_score, 
    games_played, 
    last_played_at
  )
  VALUES (
    NEW.user_id,
    NEW.game_key,
    NEW.score,
    NEW.score,
    1,
    NEW.created_at
  )
  ON CONFLICT (user_id, game_key)
  DO UPDATE SET
    total_score = user_game_stats.total_score + NEW.score,
    best_score = GREATEST(user_game_stats.best_score, NEW.score),
    games_played = user_game_stats.games_played + 1,
    last_played_at = NEW.created_at,
    updated_at = NOW();

  -- Update global user stats
  INSERT INTO global_user_stats (
    user_id,
    total_score,
    total_games_played,
    unique_games_played,
    best_single_score,
    best_game_key,
    last_score_update
  )
  VALUES (
    NEW.user_id,
    NEW.score,
    1,
    1,
    NEW.score,
    NEW.game_key,
    NEW.created_at
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_score = global_user_stats.total_score + NEW.score,
    total_games_played = global_user_stats.total_games_played + 1,
    unique_games_played = (
      SELECT COUNT(DISTINCT game_key) 
      FROM user_game_stats 
      WHERE user_id = NEW.user_id
    ),
    best_single_score = GREATEST(global_user_stats.best_single_score, NEW.score),
    best_game_key = CASE 
      WHEN NEW.score > global_user_stats.best_single_score THEN NEW.game_key
      ELSE global_user_stats.best_game_key
    END,
    average_score = (global_user_stats.total_score + NEW.score)::decimal / (global_user_stats.total_games_played + 1),
    last_score_update = NEW.created_at,
    updated_at = NOW();

  -- Update game statistics
  INSERT INTO game_statistics (
    game_key,
    total_players,
    total_games_played,
    total_scores_submitted,
    highest_score,
    last_activity
  )
  VALUES (
    NEW.game_key,
    1,
    1,
    1,
    NEW.score,
    NEW.created_at
  )
  ON CONFLICT (game_key)
  DO UPDATE SET
    total_players = (
      SELECT COUNT(DISTINCT user_id) 
      FROM leaderboard_scores 
      WHERE game_key = NEW.game_key
    ),
    total_games_played = game_statistics.total_games_played + 1,
    total_scores_submitted = game_statistics.total_scores_submitted + 1,
    highest_score = GREATEST(game_statistics.highest_score, NEW.score),
    average_score = (
      SELECT AVG(score) 
      FROM leaderboard_scores 
      WHERE game_key = NEW.game_key
    ),
    last_activity = NEW.created_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for leaderboard_scores
DROP TRIGGER IF EXISTS trigger_update_user_game_stats ON leaderboard_scores;
CREATE TRIGGER trigger_update_user_game_stats
  AFTER INSERT ON leaderboard_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_user_game_stats();

-- Function to update global leaderboard rankings
CREATE OR REPLACE FUNCTION update_global_rankings()
RETURNS void AS $$
BEGIN
  -- Update rank positions based on total score
  WITH ranked_users AS (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (ORDER BY total_score DESC, total_games_played ASC) as new_rank
    FROM global_user_stats
    WHERE total_score > 0
  )
  UPDATE global_user_stats
  SET 
    rank_position = ranked_users.new_rank,
    updated_at = NOW()
  FROM ranked_users
  WHERE global_user_stats.user_id = ranked_users.user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get global leaderboard with enhanced data
CREATE OR REPLACE FUNCTION get_global_leaderboard(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_pro_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  country_code TEXT,
  social_links JSONB,
  is_pro_member BOOLEAN,
  total_score BIGINT,
  games_played INTEGER,
  average_score DECIMAL,
  best_game TEXT,
  best_game_score BIGINT,
  rank_position INTEGER,
  total_achievements INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gus.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    up.country_code,
    up.social_links,
    up.is_pro_member,
    gus.total_score,
    gus.total_games_played,
    gus.average_score,
    gus.best_game_key,
    gus.best_single_score,
    gus.rank_position,
    COALESCE(array_length(ARRAY(SELECT jsonb_array_elements_text(up.achievements)), 1), 0) as total_achievements
  FROM global_user_stats gus
  JOIN user_profiles up ON gus.user_id = up.id
  WHERE 
    gus.total_score > 0
    AND (NOT p_pro_only OR up.is_pro_member = true)
  ORDER BY gus.total_score DESC, gus.total_games_played ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get game-specific leaderboard with enhanced data
CREATE OR REPLACE FUNCTION get_game_leaderboard(
  p_game_key TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  country_code TEXT,
  is_pro_member BOOLEAN,
  best_score BIGINT,
  games_played INTEGER,
  total_score BIGINT,
  last_played TIMESTAMP WITH TIME ZONE,
  rank_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_players AS (
    SELECT 
      ugs.user_id,
      ugs.best_score,
      ugs.games_played,
      ugs.total_score,
      ugs.last_played_at,
      ROW_NUMBER() OVER (ORDER BY ugs.best_score DESC, ugs.last_played_at ASC) as rank_pos
    FROM user_game_stats ugs
    WHERE ugs.game_key = p_game_key
      AND ugs.best_score > 0
  )
  SELECT 
    rp.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    up.country_code,
    up.is_pro_member,
    rp.best_score,
    rp.games_played,
    rp.total_score,
    rp.last_played_at,
    rp.rank_pos::INTEGER
  FROM ranked_players rp
  JOIN user_profiles up ON rp.user_id = up.id
  ORDER BY rp.best_score DESC, rp.last_played_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's position across all games
CREATE OR REPLACE FUNCTION get_user_rankings(p_user_id UUID)
RETURNS TABLE(
  game_key TEXT,
  best_score BIGINT,
  rank_position INTEGER,
  total_players INTEGER,
  percentile DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH game_rankings AS (
    SELECT 
      ugs.game_key,
      ugs.best_score,
      ROW_NUMBER() OVER (PARTITION BY ugs.game_key ORDER BY ugs.best_score DESC) as rank_pos,
      COUNT(*) OVER (PARTITION BY ugs.game_key) as total_players_in_game
    FROM user_game_stats ugs
    WHERE ugs.best_score > 0
  )
  SELECT 
    gr.game_key,
    gr.best_score,
    gr.rank_pos::INTEGER,
    gr.total_players_in_game::INTEGER,
    ROUND((1 - (gr.rank_pos::DECIMAL / gr.total_players_in_game)) * 100, 2) as percentile
  FROM game_rankings gr
  WHERE EXISTS (
    SELECT 1 FROM user_game_stats ugs2 
    WHERE ugs2.user_id = p_user_id 
      AND ugs2.game_key = gr.game_key
      AND ugs2.best_score = gr.best_score
  )
  ORDER BY gr.best_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_game_stats_user_game ON user_game_stats(user_id, game_key);
CREATE INDEX IF NOT EXISTS idx_user_game_stats_game_score ON user_game_stats(game_key, best_score DESC);
CREATE INDEX IF NOT EXISTS idx_global_user_stats_score ON global_user_stats(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_global_user_stats_rank ON global_user_stats(rank_position);
CREATE INDEX IF NOT EXISTS idx_leaderboard_scores_game_score ON leaderboard_scores(game_key, score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_scores_user_time ON leaderboard_scores(user_id, created_at DESC);

-- Update RLS policies
ALTER TABLE user_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_statistics ENABLE ROW LEVEL SECURITY;

-- Allow public read access to statistics
CREATE POLICY "Public read access for user_game_stats" ON user_game_stats
  FOR SELECT USING (true);

CREATE POLICY "Public read access for global_user_stats" ON global_user_stats
  FOR SELECT USING (true);

CREATE POLICY "Public read access for game_statistics" ON game_statistics
  FOR SELECT USING (true);

-- Allow users to update their own stats (via triggers)
CREATE POLICY "Users can update own game stats" ON user_game_stats
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can update own global stats" ON global_user_stats
  FOR ALL USING (auth.uid() = user_id);

-- Initialize data for existing users
INSERT INTO global_user_stats (user_id, total_score, total_games_played, unique_games_played, best_single_score)
SELECT 
  up.id,
  COALESCE(agg.total_score, 0),
  COALESCE(agg.total_games, 0),
  COALESCE(agg.unique_games, 0),
  COALESCE(agg.best_score, 0)
FROM user_profiles up
LEFT JOIN (
  SELECT 
    user_id,
    SUM(score) as total_score,
    COUNT(*) as total_games,
    COUNT(DISTINCT game_key) as unique_games,
    MAX(score) as best_score
  FROM leaderboard_scores
  GROUP BY user_id
) agg ON up.id = agg.user_id
ON CONFLICT (user_id) DO NOTHING;

-- Initialize game-specific stats
INSERT INTO user_game_stats (user_id, game_key, total_score, best_score, games_played, last_played_at)
SELECT 
  user_id,
  game_key,
  SUM(score) as total_score,
  MAX(score) as best_score,
  COUNT(*) as games_played,
  MAX(created_at) as last_played_at
FROM leaderboard_scores
GROUP BY user_id, game_key
ON CONFLICT (user_id, game_key) DO NOTHING;

-- Initialize game statistics
INSERT INTO game_statistics (game_key, total_players, total_games_played, total_scores_submitted, highest_score, average_score, last_activity)
SELECT 
  game_key,
  COUNT(DISTINCT user_id) as total_players,
  COUNT(*) as total_games_played,
  COUNT(*) as total_scores_submitted,
  MAX(score) as highest_score,
  AVG(score) as average_score,
  MAX(created_at) as last_activity
FROM leaderboard_scores
GROUP BY game_key
ON CONFLICT (game_key) DO UPDATE SET
  total_players = EXCLUDED.total_players,
  total_games_played = EXCLUDED.total_games_played,
  total_scores_submitted = EXCLUDED.total_scores_submitted,
  highest_score = EXCLUDED.highest_score,
  average_score = EXCLUDED.average_score,
  last_activity = EXCLUDED.last_activity;

-- Update global rankings
SELECT update_global_rankings();
