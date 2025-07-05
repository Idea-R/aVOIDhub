/*
  # WreckingaVOID Game Database Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key, references auth.users)
      - `username` (text, unique, required)
      - `bio` (text, optional)
      - `twitter`, `youtube`, `twitch`, `instagram` (text, social links)
      - `created_at`, `updated_at` (timestamps)
    - `game_scores`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `score` (integer, game score)
      - `wave` (integer, wave reached)
      - `survival_time` (numeric, time survived in seconds)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can view all profiles and scores
    - Users can only modify their own data
    - Authenticated users can insert their own records

  3. Performance
    - Indexes on score, user_id, created_at, and username
    - Trigger for automatic updated_at timestamp
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  bio text DEFAULT '',
  twitter text,
  youtube text,
  twitch text,
  instagram text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create game_scores table
CREATE TABLE IF NOT EXISTS game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  wave integer NOT NULL DEFAULT 1,
  survival_time numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view all scores" ON game_scores;
DROP POLICY IF EXISTS "Users can insert own scores" ON game_scores;

-- User profiles policies
CREATE POLICY "Users can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Game scores policies
CREATE POLICY "Users can view all scores"
  ON game_scores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own scores"
  ON game_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS game_scores_score_idx ON game_scores(score DESC);
CREATE INDEX IF NOT EXISTS game_scores_user_id_idx ON game_scores(user_id);
CREATE INDEX IF NOT EXISTS game_scores_created_at_idx ON game_scores(created_at DESC);
CREATE INDEX IF NOT EXISTS user_profiles_username_idx ON user_profiles(username);

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();