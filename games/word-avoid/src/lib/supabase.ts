import { createClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL || '';
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = /^https:\/\/.+\.supabase\.co$/.test(configuredUrl) && configuredAnonKey.length > 20;

const supabaseUrl = supabaseConfigured ? configuredUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = supabaseConfigured ? configuredAnonKey : 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
