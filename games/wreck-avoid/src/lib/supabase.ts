import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-ref.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here';

// Validate environment variables in development
if (import.meta.env.DEV) {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    console.warn('⚠️ VITE_SUPABASE_URL not set - using fallback')
  }
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn('⚠️ VITE_SUPABASE_ANON_KEY not set - using fallback')
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  username: string;
  bio: string;
  twitter?: string;
  youtube?: string;
  twitch?: string;
  instagram?: string;
  created_at: string;
  updated_at: string;
}

export interface GameScore {
  id: string;
  user_id: string;
  score: number;
  wave: number;
  survival_time: number;
  created_at: string;
  user_profile?: UserProfile;
}

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>;
      };
      game_scores: {
        Row: GameScore;
        Insert: Omit<GameScore, 'id' | 'created_at' | 'user_profile'>;
        Update: Partial<Omit<GameScore, 'id' | 'created_at' | 'user_profile'>>;
      };
    };
  };
}