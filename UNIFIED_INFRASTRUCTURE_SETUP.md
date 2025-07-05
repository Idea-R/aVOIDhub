# aVOID Unified Infrastructure Setup Guide

This guide will help you set up the complete unified infrastructure for the aVOID gaming platform, including authentication, music system, and scalable leaderboards.

## 🎯 Overview

The infrastructure includes:
- **Unified Music System**: Cross-game audio with default tracks per game
- **Scalable Leaderboard System**: Game-specific and global rankings  
- **Single Sign-On Authentication**: OAuth & email/password with profile management
- **Fixed UI Issues**: Removed duplicate headers and streamlined interface

## 🚀 Quick Start

### 1. Database Setup

First, run the leaderboard schema to set up the database tables:

```sql
-- Run the SQL file in your Supabase database
-- Location: packages/shared/database/leaderboard-schema.sql
```

This creates:
- `game_scores` - Individual game scores
- `global_leaderboard` - Cross-game user rankings
- `game_leaderboard_configs` - Leaderboard settings per game
- `user_achievements` - Achievement tracking
- `game_sessions` - User activity tracking

### 2. Install Dependencies

Make sure the shared package is properly linked:

```bash
# In the root directory
npm install

# Link the shared package
npm run build:shared
```

### 3. Environment Variables

Ensure your Supabase credentials are properly set in your environment:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Initialize Systems

The systems will auto-initialize when imported, but you can manually set up:

```typescript
// In your main app file (App.tsx)
import { unifiedMusic, unifiedLeaderboard } from '@avoid/shared'
import { supabase } from './lib/supabase'

// Initialize leaderboard with Supabase client
unifiedLeaderboard.setSupabaseClient(supabase)

// Music system auto-initializes on import
```

## 🎵 Music System Usage

### Game Integration

```typescript
import { unifiedMusic } from '@avoid/shared'

// Initialize for your game
unifiedMusic.initializeForGame('tankavoid') // or 'voidavoid', 'wreckavoid', etc.

// The system will:
// 1. Set up the appropriate playlist for your game
// 2. Auto-play the default track for that game
// 3. Continue music across game sessions
```

### Available Music Tracks

- **Circuit Lounge** (Electronic) - Default for `wreckavoid` and `hub`
- **Neon Keystrike** (Synthwave) - Default for `voidavoid`
- **Neon Keystrike (Remastered)** (Synthwave) - Default for `wordavoid`
- **Overclocked Rebellion** (Electronic) - Default for `tankavoid`

### Music Controls

```typescript
// Basic controls
unifiedMusic.playTrack('neon-keystrike')
unifiedMusic.pause()
unifiedMusic.resume()
unifiedMusic.playNext()
unifiedMusic.playPrevious()

// Volume control
unifiedMusic.setVolume(0.7) // 0.0 to 1.0
unifiedMusic.toggleMute()

// Playlist management
unifiedMusic.shufflePlaylist()
unifiedMusic.setPlaylist(['track1', 'track2'])

// Get current state
const state = unifiedMusic.getState()
```

## 🏆 Leaderboard System Usage

### Submit Scores

```typescript
import { unifiedLeaderboard } from '@avoid/shared'

// Submit a score for a game
const result = await unifiedLeaderboard.submitScore(
  userId,
  'tankavoid',
  1500,
  { wave: 10, time_played: 300 } // optional metadata
)

if (result.success) {
  console.log(`User rank: ${result.rank}`)
}
```

### Get Leaderboards

```typescript
// Game-specific leaderboard
const gameResult = await unifiedLeaderboard.getGameLeaderboard('tankavoid', 50)
if (gameResult.success) {
  console.log('Game scores:', gameResult.data)
}

// Global leaderboard (cross-game)
const globalResult = await unifiedLeaderboard.getGlobalLeaderboard(50)
if (globalResult.success) {
  console.log('Global rankings:', globalResult.data)
}

// Get user's rank
const rankResult = await unifiedLeaderboard.getUserRank(userId, 'tankavoid')
if (rankResult.success) {
  console.log(`User's game rank: ${rankResult.rank}`)
}
```

### Adding New Games

```typescript
// Add a new game to the leaderboard system
unifiedLeaderboard.addGame({
  gameKey: 'newgame',
  displayName: 'New aVOID Game',
  scoreType: 'high', // 'high', 'low', or 'time'
  scoreUnit: 'points', // 'points', 'wpm', 'time', etc.
  maxEntries: 1000,
  isActive: true
})
```

## 🔐 Authentication Features

### OAuth Setup

The unified auth system supports:
- **Google OAuth** - Configured in `UnifiedAuthService.ts`
- **Email/Password** - Standard Supabase auth
- **Profile Management** - Automatic profile creation
- **Cross-game Sessions** - Sessions persist across all games

### Auth State Management

```typescript
import { unifiedAuth } from './services/UnifiedAuthService'

// Listen for auth changes
const unsubscribe = unifiedAuth.onAuthStateChange((session) => {
  if (session) {
    console.log('User signed in:', session.user)
  } else {
    console.log('User signed out')
  }
})

// Get current session
const session = unifiedAuth.getCurrentSession()
```

## 🎮 Game Integration Checklist

For each game, ensure:

### 1. Music Integration
- [ ] Import unified music system
- [ ] Initialize with game key
- [ ] Add music controller to UI (optional)

### 2. Leaderboard Integration  
- [ ] Import unified leaderboard system
- [ ] Submit scores on game over
- [ ] Display game-specific leaderboard
- [ ] Handle authentication requirements

### 3. Authentication
- [ ] Use unified auth service
- [ ] Handle sign-in/sign-out
- [ ] Display user profile
- [ ] Redirect to main site for OAuth

### 4. UI Components
- [ ] Remove duplicate headers
- [ ] Add UnifiedLeaderboard component
- [ ] Add MusicController component (compact mode)
- [ ] Ensure consistent styling

## 🛠️ Development Workflow

### Adding a New Game

1. **Update Music System**:
   ```typescript
   // Add to UnifiedMusicSystem.ts setupGameConfigs()
   this.gameMusicConfigs.set('newgame', {
     gameKey: 'newgame',
     defaultTrack: 'circuit-lounge',
     trackIds: ['circuit-lounge', 'neon-keystrike', ...]
   })
   ```

2. **Update Leaderboard System**:
   ```sql
   -- Add to leaderboard-schema.sql
   INSERT INTO game_leaderboard_configs (game_key, display_name, score_type, score_unit) 
   VALUES ('newgame', 'New Game', 'high', 'points');
   ```

3. **Update Game Hub**:
   ```typescript
   // Add to gameDetails in GamePage.tsx
   newgame: {
     name: 'New Game',
     description: 'Game description',
     url: '/NewGame',
     status: 'Available',
     // ...
   }
   ```

### Testing

1. **Music System**: Test track switching, volume control, playlist management
2. **Leaderboards**: Test score submission, ranking calculation, global aggregation
3. **Authentication**: Test OAuth flow, profile creation, session persistence
4. **UI**: Test header consistency, component integration, responsive design

## 📝 File Structure

```
packages/shared/src/
├── audio/
│   ├── UnifiedMusicSystem.ts      # Core music system
│   └── index.ts                   # Audio exports
├── leaderboard/
│   ├── UnifiedLeaderboardSystem.ts # Core leaderboard system
│   └── index.ts                    # Leaderboard exports
└── database/
    └── leaderboard-schema.sql      # Database schema

apps/game-hub/src/
├── components/
│   ├── MusicController.tsx         # Music UI component
│   ├── UnifiedLeaderboard.tsx      # Leaderboard UI component
│   └── Navbar.tsx                  # Updated navbar with music
├── pages/
│   ├── HomePage.tsx                # Fixed duplicate header
│   └── LeaderboardsPage.tsx        # Updated to use unified system
└── services/
    └── UnifiedAuthService.ts       # Authentication service

games/
├── tanka-void/
│   └── index.html                  # Fixed MIME type error
└── [other games]/
```

## 🔧 Configuration Options

### Music System
- **Volume**: 0.0 to 1.0 (default: 0.7)
- **Auto-play**: Enabled by default for each game
- **Playlist shuffling**: Available via UI or API
- **Cross-game persistence**: Music continues between games

### Leaderboard System
- **Cache TTL**: 5 minutes for leaderboard data
- **Score types**: 'high', 'low', 'time'
- **Pagination**: 50 entries per page (configurable)
- **Real-time updates**: Via Supabase subscriptions

### Authentication
- **Session storage**: localStorage + Supabase
- **Profile auto-creation**: On first sign-up
- **OAuth providers**: Google (more can be added)
- **Cross-game compatibility**: Single session for all games

## 🚀 Deployment

1. **Build shared package**: `npm run build:shared`
2. **Update environment variables** in hosting platform
3. **Run database migrations** via Supabase dashboard
4. **Test all systems** in production environment
5. **Monitor performance** and user engagement

---

## 🎯 Next Steps

With this infrastructure in place, you can now:

1. **Scale easily**: Add new games by updating configs
2. **Track engagement**: Monitor user activity across games
3. **Build community**: Global leaderboards create competition
4. **Enhance experience**: Consistent music and auth flows
5. **Analyze data**: Rich metadata for game performance

The foundation is set for a scalable, engaging gaming platform that can grow with your user base and game library.

<citations>
<document>
<document_type>RULE</document_type>
<document_id>38hLBCDkbaCfvhF7yKB2iU</document_id>
</document>
</citations>
