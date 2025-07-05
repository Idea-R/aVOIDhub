-- Unified Leaderboard System Database Schema
-- This schema supports scalable game leaderboards and global rankings

-- User profiles table (if not already exists)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  total_games_played INTEGER DEFAULT 0,
  total_time_played INTEGER DEFAULT 0, -- in seconds
  achievements TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT valid_username CHECK (length(username) >= 3 AND length(username) <= 30)
);

-- Game scores table - stores individual game scores
CREATE TABLE IF NOT EXISTS game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  game_key TEXT NOT NULL,
  score BIGINT NOT NULL,
  metadata JSONB DEFAULT '{}',
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  username TEXT NOT NULL,
  user_avatar TEXT,
  is_verified BOOLEAN DEFAULT TRUE,
  
  -- Indexes for performance
  INDEX idx_game_scores_game_score ON game_scores(game_key, score DESC),
  INDEX idx_game_scores_user ON game_scores(user_id, game_key),
  INDEX idx_game_scores_achieved_at ON game_scores(achieved_at DESC),
  
  -- Constraints
  CONSTRAINT valid_game_key CHECK (length(game_key) > 0),
  CONSTRAINT valid_score CHECK (score >= 0)
);

-- Global leaderboard table - aggregated user stats across all games
CREATE TABLE IF NOT EXISTS global_leaderboard (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  user_avatar TEXT,
  total_score BIGINT NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  average_score INTEGER NOT NULL DEFAULT 0,
  best_game TEXT,
  best_game_score BIGINT DEFAULT 0,
  game_scores JSONB DEFAULT '{}', -- { "voidavoid": 1500, "tankavoid": 2000 }
  rank INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_global_leaderboard_total_score ON global_leaderboard(total_score DESC),
  INDEX idx_global_leaderboard_rank ON global_leaderboard(rank),
  INDEX idx_global_leaderboard_games_played ON global_leaderboard(games_played DESC),
  
  -- Constraints
  CONSTRAINT valid_total_score CHECK (total_score >= 0),
  CONSTRAINT valid_games_played CHECK (games_played >= 0)
);

-- Game configurations table - defines leaderboard settings for each game
CREATE TABLE IF NOT EXISTS game_leaderboard_configs (
  game_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  score_type TEXT NOT NULL CHECK (score_type IN ('high', 'low', 'time')),
  score_unit TEXT DEFAULT 'points',
  max_entries INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_display_name CHECK (length(display_name) > 0),
  CONSTRAINT valid_max_entries CHECK (max_entries > 0)
);

-- Game sessions table - track user activity
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  game_key TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_seconds INTEGER,
  scores_submitted INTEGER DEFAULT 0,
  
  -- Indexes
  INDEX idx_game_sessions_user_game ON game_sessions(user_id, game_key),
  INDEX idx_game_sessions_started_at ON game_sessions(started_at DESC),
  
  -- Constraints
  CONSTRAINT valid_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- Achievements table - track user achievements across games
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  game_key TEXT,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  
  -- Unique constraint to prevent duplicate achievements
  UNIQUE(user_id, achievement_key, game_key),
  
  -- Indexes
  INDEX idx_user_achievements_user ON user_achievements(user_id),
  INDEX idx_user_achievements_game ON user_achievements(game_key),
  INDEX idx_user_achievements_key ON user_achievements(achievement_key)
);

-- Insert default game configurations
INSERT INTO game_leaderboard_configs (game_key, display_name, score_type, score_unit, max_entries, is_active) 
VALUES 
  ('voidavoid', 'VOIDaVOID', 'high', 'points', 1000, true),
  ('tankavoid', 'TankaVOID', 'high', 'points', 1000, true),
  ('wreckavoid', 'WreckaVOID', 'high', 'points', 1000, true),
  ('wordavoid', 'WORDaVOID', 'high', 'wpm', 1000, true)
ON CONFLICT (game_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  score_type = EXCLUDED.score_type,
  score_unit = EXCLUDED.score_unit,
  updated_at = NOW();

-- Function to update global leaderboard when game score is inserted
CREATE OR REPLACE FUNCTION update_global_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  -- Update global leaderboard entry for the user
  INSERT INTO global_leaderboard (user_id, username, user_avatar, total_score, games_played, average_score, best_game, best_game_score, game_scores, last_updated)
  SELECT 
    NEW.user_id,
    NEW.username,
    NEW.user_avatar,
    COALESCE(SUM(best_scores.max_score), 0) as total_score,
    COUNT(DISTINCT best_scores.game_key) as games_played,
    ROUND(AVG(best_scores.max_score)) as average_score,
    (SELECT game_key FROM (
      SELECT game_key, MAX(score) as max_score 
      FROM game_scores 
      WHERE user_id = NEW.user_id 
      GROUP BY game_key 
      ORDER BY max_score DESC 
      LIMIT 1
    ) as best_game_query) as best_game,
    (SELECT MAX(max_score) FROM (
      SELECT MAX(score) as max_score 
      FROM game_scores 
      WHERE user_id = NEW.user_id 
      GROUP BY game_key
    ) as max_scores) as best_game_score,
    (SELECT jsonb_object_agg(game_key, max_score) FROM (
      SELECT game_key, MAX(score) as max_score 
      FROM game_scores 
      WHERE user_id = NEW.user_id 
      GROUP BY game_key
    ) as game_score_aggregation) as game_scores,
    NOW() as last_updated
  FROM (
    SELECT game_key, MAX(score) as max_score 
    FROM game_scores 
    WHERE user_id = NEW.user_id 
    GROUP BY game_key
  ) as best_scores
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    user_avatar = EXCLUDED.user_avatar,
    total_score = EXCLUDED.total_score,
    games_played = EXCLUDED.games_played,
    average_score = EXCLUDED.average_score,
    best_game = EXCLUDED.best_game,
    best_game_score = EXCLUDED.best_game_score,
    game_scores = EXCLUDED.game_scores,
    last_updated = EXCLUDED.last_updated;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update global leaderboard
DROP TRIGGER IF EXISTS trigger_update_global_leaderboard ON game_scores;
CREATE TRIGGER trigger_update_global_leaderboard
  AFTER INSERT ON game_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_global_leaderboard();

-- Function to update global ranks
CREATE OR REPLACE FUNCTION update_global_ranks()
RETURNS void AS $$
BEGIN
  WITH ranked_users AS (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (ORDER BY total_score DESC, last_updated ASC) as new_rank
    FROM global_leaderboard
  )
  UPDATE global_leaderboard 
  SET rank = ranked_users.new_rank
  FROM ranked_users
  WHERE global_leaderboard.user_id = ranked_users.user_id
    AND (global_leaderboard.rank IS NULL OR global_leaderboard.rank != ranked_users.new_rank);
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's rank for a specific game
CREATE OR REPLACE FUNCTION get_user_game_rank(p_user_id UUID, p_game_key TEXT)
RETURNS INTEGER AS $$
DECLARE
  user_best_score BIGINT;
  user_rank INTEGER;
BEGIN
  -- Get user's best score for the game
  SELECT MAX(score) INTO user_best_score
  FROM game_scores
  WHERE user_id = p_user_id AND game_key = p_game_key;
  
  IF user_best_score IS NULL THEN
    RETURN -1; -- User has no scores for this game
  END IF;
  
  -- Calculate rank based on how many users have better scores
  SELECT COUNT(*) + 1 INTO user_rank
  FROM (
    SELECT user_id, MAX(score) as best_score
    FROM game_scores
    WHERE game_key = p_game_key
    GROUP BY user_id
    HAVING MAX(score) > user_best_score
  ) as better_users;
  
  RETURN user_rank;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_scores_composite ON game_scores(game_key, score DESC, user_id);
CREATE INDEX IF NOT EXISTS idx_global_leaderboard_composite ON global_leaderboard(total_score DESC, rank);

-- RLS (Row Level Security) policies
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for game_scores
CREATE POLICY "Users can view all game scores" ON game_scores FOR SELECT USING (true);
CREATE POLICY "Users can insert their own scores" ON game_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own scores" ON game_scores FOR UPDATE USING (auth.uid() = user_id);

-- Policies for global_leaderboard
CREATE POLICY "Users can view global leaderboard" ON global_leaderboard FOR SELECT USING (true);
CREATE POLICY "System can manage global leaderboard" ON global_leaderboard FOR ALL USING (true);

-- Policies for user_achievements
CREATE POLICY "Users can view all achievements" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "Users can manage their own achievements" ON user_achievements FOR ALL USING (auth.uid() = user_id);

-- Policies for game_sessions
CREATE POLICY "Users can view their own sessions" ON game_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own sessions" ON game_sessions FOR ALL USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON game_scores TO authenticated;
GRANT ALL ON global_leaderboard TO authenticated;
GRANT ALL ON user_achievements TO authenticated;
GRANT ALL ON game_sessions TO authenticated;
GRANT ALL ON game_leaderboard_configs TO authenticated;

-- Create a view for easier leaderboard queries
CREATE OR REPLACE VIEW leaderboard_summary AS
SELECT 
  gs.game_key,
  glc.display_name as game_name,
  gs.user_id,
  gs.username,
  gs.user_avatar,
  MAX(gs.score) as best_score,
  COUNT(*) as total_submissions,
  MAX(gs.achieved_at) as latest_score_date,
  ROW_NUMBER() OVER (PARTITION BY gs.game_key ORDER BY MAX(gs.score) DESC) as game_rank
FROM game_scores gs
JOIN game_leaderboard_configs glc ON gs.game_key = glc.game_key
WHERE glc.is_active = true
GROUP BY gs.game_key, glc.display_name, gs.user_id, gs.username, gs.user_avatar;

GRANT SELECT ON leaderboard_summary TO authenticated;
