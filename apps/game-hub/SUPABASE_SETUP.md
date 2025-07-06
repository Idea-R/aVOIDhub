# Supabase Setup Guide for aVOID Games

## Where to Add Supabase Keys

### 1. **Game Hub** (Main platform)
**File: `apps/game-hub/.env`**
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_DEBUG=false
```

### 2. **Individual Games**
Each game needs its own `.env` file:

**File: `games/void-avoid/.env`**
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GAME_KEY=voidavoid
```

**File: `games/tanka-void/.env`**
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GAME_KEY=tankavoid
```

**File: `games/wrecka-void/.env`**
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GAME_KEY=wreckavoid
```

**File: `games/word-avoid/.env`**
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GAME_KEY=wordavoid
```

## How to Get Your Supabase Keys

### Step 1: Create/Access Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Either create a new project or select existing project

### Step 2: Find Your Keys
1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://your-project-ref.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 3: Replace Placeholder Values
Replace `your-project-ref` and the key in all `.env` files with your actual values.

## Database Setup

### Step 1: Create Tables
In your Supabase dashboard, go to **SQL Editor** and run:

```sql
-- 1. Games table
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  banner_url TEXT,
  play_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. User profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  email VARCHAR(255),
  avatar_url TEXT,
  country_code VARCHAR(2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_sign_in_at TIMESTAMP WITH TIME ZONE
);

-- 3. Game scores table
CREATE TABLE game_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  game_key VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  metadata JSONB,
  session_id VARCHAR(100),
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  FOREIGN KEY (game_key) REFERENCES games(game_key)
);

-- 4. Global leaderboard table
CREATE TABLE global_leaderboard (
  user_id UUID REFERENCES user_profiles(id) PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  user_avatar TEXT,
  total_score BIGINT DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  average_score INTEGER DEFAULT 0,
  best_game VARCHAR(50),
  best_game_score INTEGER DEFAULT 0,
  game_scores JSONB DEFAULT '{}',
  rank INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Step 2: Create Views
```sql
-- Leaderboard scores view
CREATE VIEW leaderboard_scores AS
SELECT 
  gs.id,
  gs.user_id,
  gs.game_key,
  gs.score,
  gs.metadata,
  gs.achieved_at,
  up.username,
  up.display_name,
  up.avatar_url,
  up.country_code,
  ROW_NUMBER() OVER (PARTITION BY gs.game_key ORDER BY gs.score DESC) as rank
FROM game_scores gs
JOIN user_profiles up ON gs.user_id = up.id
WHERE gs.score > 0;
```

### Step 3: Set Up Row Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_leaderboard ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Game scores policies
CREATE POLICY "Users can view all scores" ON game_scores FOR SELECT USING (true);
CREATE POLICY "Users can insert own scores" ON game_scores FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Global leaderboard policies
CREATE POLICY "Anyone can view global leaderboard" ON global_leaderboard FOR SELECT USING (true);
```

### Step 4: Insert Initial Game Data
```sql
INSERT INTO games (game_key, name, description, is_active) VALUES
('voidavoid', 'VOIDaVOID', 'Navigate through space avoiding obstacles in this fast-paced cursor game', true),
('tankavoid', 'TankaVOID', 'Tank warfare meets cursor precision in this strategic action game', true),
('wreckavoid', 'WreckaVOID', 'Demolition chaos with cursor control - destroy everything in sight!', true),
('wordavoid', 'WORDaVOID', 'Test your typing speed while avoiding falling words', true);
```

### Step 5: Create Indexes for Performance
```sql
-- Game scores indexes
CREATE INDEX idx_game_scores_user_game ON game_scores(user_id, game_key);
CREATE INDEX idx_game_scores_game_score ON game_scores(game_key, score DESC);
CREATE INDEX idx_game_scores_achieved ON game_scores(achieved_at DESC);

-- Global leaderboard indexes
CREATE INDEX idx_global_leaderboard_rank ON global_leaderboard(rank);
CREATE INDEX idx_global_leaderboard_total_score ON global_leaderboard(total_score DESC);
```

## Verification

### Test Database Connection
1. Start the Game Hub: `npm run dev` in `apps/game-hub`
2. Check browser console - should see:
   - ✅ `Using mock data - Supabase not configured` (if no keys)
   - ✅ `Games Fetched Successfully` (if keys working)

### Test Authentication
1. Try to sign up/sign in through the Game Hub UI
2. Check if user profiles are created in Supabase dashboard

## Troubleshooting

### Common Issues

#### 1. "Invalid API key" Error
- Double-check your `VITE_SUPABASE_ANON_KEY` in `.env` files
- Make sure there are no extra spaces or characters
- Verify the key is the "anon/public" key, not the service role key

#### 2. "Failed to resolve entry" Error
- Restart your development servers after adding `.env` files
- Make sure `.env` files are in the correct directories
- Check that environment variables start with `VITE_`

#### 3. Database Connection Issues
- Verify your `VITE_SUPABASE_URL` is correct
- Check if your Supabase project is active and not paused
- Ensure database tables are created correctly

#### 4. RLS (Row Level Security) Errors
- Make sure RLS policies are set up correctly
- Check that authentication is working before testing database operations

### Development vs Production

#### Development (Current Setup)
- Uses local `.env` files
- Mock data fallback when Supabase unavailable
- Individual development servers per game

#### Production (Future)
- Environment variables set in deployment platforms (Netlify/Vercel)
- Real Supabase database with proper authentication
- Games deployed to separate domains

## Security Notes

### Environment Variables
- ✅ `.env` files are in `.gitignore` 
- ✅ Only `anon/public` keys used (safe for client-side)
- ✅ RLS policies protect sensitive data
- ❌ Never commit `.env` files to Git
- ❌ Never use `service_role` keys in client-side code

### Best Practices
1. **Separate environments**: Use different Supabase projects for dev/staging/production
2. **Key rotation**: Regenerate keys periodically
3. **Monitor usage**: Check Supabase dashboard for unusual activity
4. **Backup data**: Regular database backups through Supabase dashboard

## Current Status

✅ **Completed**:
- Environment variable templates created
- Graceful offline mode with mock data
- Database schema documented
- Setup instructions provided

🔧 **Todo**:
- Add your actual Supabase keys
- Run database setup SQL
- Test authentication flow
- Deploy individual games

## Quick Start Commands

```bash
# 1. Copy environment templates (already done)
# 2. Add your Supabase keys to all .env files
# 3. Install dependencies
cd apps/game-hub && npm install
cd ../../games/void-avoid && npm install
cd ../tanka-void && npm install  
cd ../wrecka-void && npm install
cd ../word-avoid && npm install

# 4. Start all games
cd ../../
./scripts/dev-all-games.ps1
```

The application will work in offline mode until you add proper Supabase credentials!
