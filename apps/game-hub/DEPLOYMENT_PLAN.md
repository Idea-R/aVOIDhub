# aVOID Games Deployment Plan

## Current Architecture

### Development Environment
- **Game Hub**: `http://localhost:5173` (Main platform)
- **VOIDaVOID**: `http://localhost:5174` (Meteor avoidance game)
- **TankaVOID**: `http://localhost:5175` (Tank warfare game)
- **WreckaVOID**: `http://localhost:5176` (Demolition game)
- **WORDaVOID**: `http://localhost:5177` (Typing game)

## Quick Start Development

### 1. Install Dependencies
```bash
# From the root directory
cd apps/game-hub && npm install
cd ../../games/void-avoid && npm install
cd ../tanka-void && npm install
cd ../wrecka-void && npm install
cd ../word-avoid && npm install
```

### 2. Start All Games (Windows)
```powershell
# From root directory
.\scripts\dev-all-games.ps1
```

### 3. Manual Start (Alternative)
```bash
# Terminal 1 - Game Hub
cd apps/game-hub && npm run dev

# Terminal 2 - VOIDaVOID
cd games/void-avoid && npm run dev

# Terminal 3 - TankaVOID
cd games/tanka-void && npm run dev

# Terminal 4 - WreckaVOID
cd games/wrecka-void && npm run dev

# Terminal 5 - WORDaVOID
cd games/word-avoid && npm run dev
```

## Supabase Database Schema

### Required Tables

#### 1. Games Table
```sql
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

-- Insert game data
INSERT INTO games (game_key, name, description, play_url, is_active) VALUES
('voidavoid', 'VOIDaVOID', 'Navigate through space avoiding obstacles in this fast-paced cursor game', 'https://voidavoid.netlify.app', true),
('tankavoid', 'TankaVOID', 'Tank warfare meets cursor precision in this strategic action game', 'https://tankavoid.netlify.app', true),
('wreckavoid', 'WreckaVOID', 'Demolition chaos with cursor control - destroy everything in sight!', 'https://wreckavoid.netlify.app', true),
('wordavoid', 'WORDaVOID', 'Test your typing speed while avoiding falling words', 'https://wordavoid.netlify.app', true);
```

#### 2. User Profiles Table
```sql
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

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
```

#### 3. Game Scores Table  
```sql
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

-- Indexes for performance
CREATE INDEX idx_game_scores_user_game ON game_scores(user_id, game_key);
CREATE INDEX idx_game_scores_game_score ON game_scores(game_key, score DESC);
CREATE INDEX idx_game_scores_achieved ON game_scores(achieved_at DESC);

-- Enable RLS
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all scores" ON game_scores FOR SELECT USING (true);
CREATE POLICY "Users can insert own scores" ON game_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### 4. Leaderboard Scores View
```sql
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

#### 5. Global Leaderboard Table
```sql
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

-- Index for ranking
CREATE INDEX idx_global_leaderboard_rank ON global_leaderboard(rank);
CREATE INDEX idx_global_leaderboard_total_score ON global_leaderboard(total_score DESC);

-- Enable RLS
ALTER TABLE global_leaderboard ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view global leaderboard" ON global_leaderboard FOR SELECT USING (true);
```

## Environment Variables

### Game Hub (.env)
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_DEBUG=false
```

### Individual Games (.env)
Each game needs similar Supabase configuration for score submission.

## Production Deployment Strategy

### Phase 1: Individual Game Deployment
1. **Deploy each game separately** to Netlify/Vercel
   - VOIDaVOID → `voidavoid.netlify.app`
   - TankaVOID → `tankavoid.netlify.app`
   - WreckaVOID → `wreckavoid.netlify.app`
   - WORDaVOID → `wordavoid.netlify.app`

### Phase 2: Hub Deployment
1. **Deploy Game Hub** to main domain: `avoidgame.io`
2. **Update game URLs** in production to point to deployed games
3. **Configure CORS** in Supabase for all domains

### Phase 3: Database Integration
1. **Set up Supabase production database**
2. **Run database migrations**
3. **Configure authentication**
4. **Set up real-time subscriptions**

## Scaling Considerations

### Database Optimization
- **Partitioning**: Partition game_scores by game_key for better performance
- **Archiving**: Archive old scores to separate tables
- **Caching**: Implement Redis caching for leaderboards

### CDN and Assets
- **Image optimization**: Use Supabase Storage or Cloudinary
- **Audio compression**: Optimize music files for web
- **Static asset CDN**: Use Netlify/Vercel edge locations

### Real-time Features
- **Live leaderboards**: WebSocket connections for real-time score updates
- **Player presence**: Show online players
- **Live tournaments**: Real-time competitive events

## Security Implementation

### Authentication
- **JWT tokens**: Secure session management
- **Rate limiting**: Prevent score manipulation
- **Input validation**: Sanitize all user inputs

### Score Validation
- **Server-side validation**: Verify scores before storage
- **Anti-cheat measures**: Detect impossible scores
- **Session tracking**: Monitor for suspicious patterns

## Monitoring and Analytics

### Error Tracking
- **Sentry integration**: Real-time error monitoring
- **Performance monitoring**: Track game performance
- **User analytics**: Understand player behavior

### Metrics
- **Player retention**: Track returning players
- **Game popularity**: Most played games
- **Score distributions**: Identify outliers

## Current Issues to Fix

### Immediate (Development)
1. ✅ **Fixed routing** - Games now show unique content
2. ✅ **Fixed asset paths** - WORDaVOID logo working
3. ✅ **Added mock data** - App works offline
4. 🔧 **Music system errors** - Need audio file paths
5. 🔧 **Supabase connection** - Need valid credentials

### Next Sprint (Production Ready)
1. **Deploy individual games**
2. **Set up production Supabase**
3. **Implement proper authentication**
4. **Add score submission**
5. **Real-time leaderboards**

## Development Workflow

### Adding New Games
1. Create new directory in `games/`
2. Configure Vite with unique port
3. Update GamePage with new game details
4. Add to development script
5. Create database entry

### Testing
1. **Unit tests**: Jest/Vitest for game logic
2. **Integration tests**: Cypress for E2E testing
3. **Performance tests**: Lighthouse for optimization
4. **Load tests**: Artillery for database stress testing

This deployment plan provides a clear roadmap from current development state to production-ready platform with proper scaling considerations.
