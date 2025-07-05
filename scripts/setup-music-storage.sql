-- Supabase Storage Setup for aVOID Music Library
-- Run this in your Supabase SQL Editor

-- Create the music storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('music', 'music', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create RLS policies for the music bucket
CREATE POLICY "Music files are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'music');

CREATE POLICY "Authenticated users can upload music" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'music' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update music" ON storage.objects
FOR UPDATE USING (bucket_id = 'music' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete music" ON storage.objects
FOR DELETE USING (bucket_id = 'music' AND auth.role() = 'authenticated');

-- Create music metadata table
CREATE TABLE IF NOT EXISTS music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT NOT NULL,
  duration INTEGER, -- in seconds
  file_path TEXT NOT NULL, -- path in storage bucket
  file_size INTEGER, -- in bytes
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  bpm INTEGER,
  key_signature TEXT,
  mood TEXT,
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
  is_loop BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  game_suitability TEXT[] DEFAULT ARRAY[]::TEXT[], -- which games this track works well for
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_music_tracks_genre ON music_tracks(genre),
  INDEX idx_music_tracks_mood ON music_tracks(mood),
  INDEX idx_music_tracks_game_suitability ON music_tracks USING GIN(game_suitability),
  INDEX idx_music_tracks_tags ON music_tracks USING GIN(tags),
  INDEX idx_music_tracks_active ON music_tracks(is_active)
);

-- Create music playlists table
CREATE TABLE IF NOT EXISTS music_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  game_key TEXT, -- if null, it's a global playlist
  track_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_music_playlists_game_key ON music_playlists(game_key),
  INDEX idx_music_playlists_default ON music_playlists(is_default, game_key)
);

-- Create user music preferences table
CREATE TABLE IF NOT EXISTS user_music_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_tracks TEXT[] DEFAULT ARRAY[]::TEXT[],
  favorite_genres TEXT[] DEFAULT ARRAY[]::TEXT[],
  volume_preference DECIMAL(3,2) DEFAULT 0.7 CHECK (volume_preference >= 0 AND volume_preference <= 1),
  auto_play BOOLEAN DEFAULT true,
  cross_fade BOOLEAN DEFAULT true,
  preferred_mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id),
  INDEX idx_user_music_prefs_user ON user_music_preferences(user_id)
);

-- Insert sample music tracks (you'll replace these with actual uploads)
INSERT INTO music_tracks (track_id, name, artist, album, genre, duration, file_path, tags, bpm, mood, energy_level, game_suitability) VALUES
-- Electronic/Synthwave tracks
('circuit-lounge', 'Circuit Lounge', 'aVOID Original', 'Digital Atmosphere', 'Electronic', 180, 'electronic/circuit-lounge.mp3', ARRAY['ambient', 'atmospheric', 'chill'], 120, 'relaxed', 6, ARRAY['hub', 'wreckavoid']),
('neon-keystrike', 'Neon Keystrike', 'aVOID Original', 'Retro Future', 'Synthwave', 210, 'synthwave/neon-keystrike.mp3', ARRAY['retro', 'energetic', 'nostalgic'], 128, 'energetic', 8, ARRAY['voidavoid', 'tankavoid']),
('neon-keystrike-remastered', 'Neon Keystrike (Remastered)', 'aVOID Original', 'Retro Future Deluxe', 'Synthwave', 215, 'synthwave/neon-keystrike-remastered.mp3', ARRAY['retro', 'energetic', 'remastered'], 128, 'energetic', 8, ARRAY['wordavoid', 'voidavoid']),
('overclocked-rebellion', 'Overclocked Rebellion', 'aVOID Original', 'Digital Warfare', 'Electronic', 195, 'electronic/overclocked-rebellion.mp3', ARRAY['intense', 'aggressive', 'combat'], 140, 'intense', 9, ARRAY['tankavoid', 'wreckavoid']),

-- Additional atmospheric tracks
('digital-void', 'Digital Void', 'aVOID Studios', 'Cyberspace', 'Ambient', 240, 'ambient/digital-void.mp3', ARRAY['ambient', 'space', 'mysterious'], 90, 'mysterious', 4, ARRAY['hub', 'voidavoid']),
('cursor-dance', 'Cursor Dance', 'aVOID Studios', 'Interactive Beats', 'Electronic', 165, 'electronic/cursor-dance.mp3', ARRAY['playful', 'rhythmic', 'interactive'], 135, 'playful', 7, ARRAY['wordavoid', 'hub']),
('pixel-storm', 'Pixel Storm', 'aVOID Studios', 'Retro Gaming', 'Chiptune', 155, 'chiptune/pixel-storm.mp3', ARRAY['retro', '8bit', 'fast'], 150, 'energetic', 8, ARRAY['voidavoid', 'wreckavoid']),
('system-breach', 'System Breach', 'aVOID Studios', 'Cyber Warfare', 'Industrial', 200, 'industrial/system-breach.mp3', ARRAY['dark', 'industrial', 'intense'], 132, 'intense', 9, ARRAY['tankavoid']),

-- Chill/Focus tracks
('focus-flow', 'Focus Flow', 'aVOID Studios', 'Concentration', 'Ambient', 300, 'ambient/focus-flow.mp3', ARRAY['calm', 'focus', 'concentration'], 80, 'calm', 3, ARRAY['wordavoid', 'hub']),
('midnight-coding', 'Midnight Coding', 'aVOID Studios', 'Developer Vibes', 'Lo-fi', 220, 'lofi/midnight-coding.mp3', ARRAY['lofi', 'chill', 'coding'], 85, 'relaxed', 4, ARRAY['hub']),
('zen-cursor', 'Zen Cursor', 'aVOID Studios', 'Meditation Games', 'Ambient', 280, 'ambient/zen-cursor.mp3', ARRAY['zen', 'peaceful', 'meditation'], 70, 'peaceful', 2, ARRAY['hub']),

-- High-energy tracks
('adrenaline-rush', 'Adrenaline Rush', 'aVOID Studios', 'Extreme Gaming', 'Electronic', 175, 'electronic/adrenaline-rush.mp3', ARRAY['intense', 'fast', 'adrenaline'], 160, 'intense', 10, ARRAY['voidavoid', 'tankavoid', 'wreckavoid']),
('velocity-vector', 'Velocity Vector', 'aVOID Studios', 'Speed Demon', 'Synthwave', 185, 'synthwave/velocity-vector.mp3', ARRAY['fast', 'racing', 'velocity'], 145, 'energetic', 9, ARRAY['voidavoid', 'wreckavoid']),
('combat-protocol', 'Combat Protocol', 'aVOID Studios', 'Battle Ready', 'Industrial', 190, 'industrial/combat-protocol.mp3', ARRAY['combat', 'military', 'tactical'], 138, 'intense', 9, ARRAY['tankavoid']),

-- Creative/Word game tracks
('wordsmith-waltz', 'Wordsmith Waltz', 'aVOID Studios', 'Literary Sounds', 'Classical Crossover', 210, 'classical/wordsmith-waltz.mp3', ARRAY['elegant', 'literary', 'sophisticated'], 120, 'elegant', 5, ARRAY['wordavoid']),
('typing-tango', 'Typing Tango', 'aVOID Studios', 'Rhythm & Words', 'Latin Electronic', 195, 'latin/typing-tango.mp3', ARRAY['rhythmic', 'latin', 'dance'], 125, 'playful', 7, ARRAY['wordavoid']),
('lexicon-lounge', 'Lexicon Lounge', 'aVOID Studios', 'Vocabulary Vibes', 'Jazz Fusion', 230, 'jazz/lexicon-lounge.mp3', ARRAY['sophisticated', 'jazzy', 'smooth'], 110, 'sophisticated', 5, ARRAY['wordavoid', 'hub']);

-- Create default playlists for each game
INSERT INTO music_playlists (playlist_id, name, description, game_key, track_ids, is_default) VALUES
('voidavoid-default', 'VOIDaVOID Default', 'High-energy tracks for avoiding obstacles', 'voidavoid', ARRAY['neon-keystrike', 'pixel-storm', 'adrenaline-rush', 'velocity-vector', 'neon-keystrike-remastered'], true),
('tankavoid-default', 'TankaVOID Default', 'Intense combat music for tank warfare', 'tankavoid', ARRAY['overclocked-rebellion', 'system-breach', 'combat-protocol', 'adrenaline-rush', 'neon-keystrike'], true),
('wreckavoid-default', 'WreckaVOID Default', 'Destructive energy for demolition', 'wreckavoid', ARRAY['circuit-lounge', 'overclocked-rebellion', 'pixel-storm', 'adrenaline-rush', 'velocity-vector'], true),
('wordavoid-default', 'WORDaVOID Default', 'Focus and rhythm for word games', 'wordavoid', ARRAY['neon-keystrike-remastered', 'wordsmith-waltz', 'typing-tango', 'lexicon-lounge', 'cursor-dance'], true),
('hub-default', 'Hub Default', 'Atmospheric music for browsing', 'hub', ARRAY['circuit-lounge', 'digital-void', 'focus-flow', 'midnight-coding', 'zen-cursor'], true),

-- Genre-based playlists
('electronic-vibes', 'Electronic Vibes', 'All electronic tracks', null, ARRAY['circuit-lounge', 'overclocked-rebellion', 'cursor-dance', 'adrenaline-rush'], false),
('synthwave-classics', 'Synthwave Classics', 'Retro-futuristic synthwave', null, ARRAY['neon-keystrike', 'neon-keystrike-remastered', 'velocity-vector'], false),
('ambient-chill', 'Ambient Chill', 'Relaxing ambient tracks', null, ARRAY['digital-void', 'focus-flow', 'zen-cursor', 'midnight-coding'], false),
('high-energy', 'High Energy', 'Maximum intensity tracks', null, ARRAY['adrenaline-rush', 'velocity-vector', 'combat-protocol', 'pixel-storm'], false),
('creative-focus', 'Creative Focus', 'Music for word games and creativity', null, ARRAY['wordsmith-waltz', 'typing-tango', 'lexicon-lounge', 'focus-flow'], false);

-- Enable RLS
ALTER TABLE music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_music_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Music tracks are publicly readable" ON music_tracks FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage music tracks" ON music_tracks FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Playlists are publicly readable" ON music_playlists FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage playlists" ON music_playlists FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their own music preferences" ON user_music_preferences FOR ALL USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON music_tracks TO authenticated;
GRANT ALL ON music_playlists TO authenticated;
GRANT ALL ON user_music_preferences TO authenticated;
GRANT SELECT ON music_tracks TO anon;
GRANT SELECT ON music_playlists TO anon;
