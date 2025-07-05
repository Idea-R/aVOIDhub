# WORDaVOID - Product Requirements Document

**Version**: 1.0  
**Date**: July 2025  
**Platform**: aVOID Games Studio  
**Tech Stack**: BOLT.new + Vite + React + Supabase + Netlify  

---

## 🎯 EXECUTIVE SUMMARY

**WORDaVOID** is a high-intensity typing defense game where players defend their position at the center of the screen by typing approaching words before they cause damage. Part of the aVOID Games Studio ecosystem, it combines skill-building typing mechanics with engaging arcade gameplay.

### Core Value Proposition
- **Skill Development**: Improve typing speed and accuracy through gameplay
- **Progressive Challenge**: Adaptive difficulty that grows with player skill
- **Engaging Mechanics**: Defense-style gameplay makes typing practice addictive
- **Community**: Leaderboards, challenges, and social competition

---

## 🛠️ TECHNICAL ARCHITECTURE

### Primary Tech Stack (July 2025 Best Practices)

**Frontend Framework**
- **Vite 5.3+** - Lightning-fast build tool and dev server
- **React 18.3+** - UI framework with concurrent features
- **TypeScript 5.5+** - Type safety and developer experience
- **Tailwind CSS 3.4+** - Utility-first styling with JIT compilation

**State Management**
- **Zustand 4.5+** - Lightweight state management (preferred over Redux for game state)
- **TanStack Query 5.x** - Server state management and caching
- **React Hook Form 7.x** - Form handling and validation

**Animation & Graphics**
- **Framer Motion 11.x** - Smooth animations and transitions
- **React Three Fiber 8.x** - 3D graphics for particle effects (optional)
- **Canvas API** - 2D graphics for word trajectories and effects
- **GSAP 3.12+** - High-performance animations for game elements

**Audio**
- **Tone.js 14.x** - Web Audio API wrapper for dynamic music
- **Web Audio API** - Low-latency sound effects
- **AudioContext** - Spatial audio for directional word attacks

**Database & Backend**
- **Supabase** - PostgreSQL database with real-time subscriptions
  - Row Level Security (RLS) for user data protection
  - Real-time multiplayer capabilities
  - Authentication with social providers
  - Edge Functions for serverless logic

**Hosting & Deployment**
- **Netlify** - Static site hosting with edge functions
  - Automatic deploys from Git
  - Branch previews for testing
  - Form handling for feedback
  - Edge caching for global performance

**Development & Quality**
- **Vitest 1.6+** - Fast unit testing framework
- **Playwright** - End-to-end testing
- **ESLint 8.x + Prettier** - Code formatting and linting
- **Husky + lint-staged** - Pre-commit hooks
- **TypeScript strict mode** - Maximum type safety

### BOLT.new Integration

**Project Structure**
```
wordavoid/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── game/           # Game-specific components
│   │   ├── ui/             # Generic UI components
│   │   └── layout/         # Layout components
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand stores
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript type definitions
│   ├── data/               # Word lists and game data
│   ├── audio/              # Audio assets and managers
│   └── styles/             # Global styles and themes
├── public/                 # Static assets
├── supabase/              # Database schema and functions
└── netlify/               # Netlify-specific configuration
```

**Build Optimization**
- **Code Splitting**: Dynamic imports for game modes
- **Bundle Analysis**: webpack-bundle-analyzer for optimization
- **Asset Optimization**: Image compression and lazy loading
- **Service Worker**: Offline gameplay capabilities

---

## 🎮 GAME DESIGN SPECIFICATIONS

### Core Gameplay Loop

**1. Player Positioning**
- Player avatar fixed at screen center
- 360-degree incoming word threats
- Visual feedback for health/shields/score

**2. Word Mechanics**
- Words spawn from screen edges at random angles
- Move toward center at variable speeds
- Must be typed completely before reaching player
- Difficulty affects word complexity and speed

**3. Damage System**
- Player starts with 100 health points
- Words deal damage based on length/difficulty:
  - Easy (3-5 letters): 10 damage
  - Medium (6-8 letters): 15 damage  
  - Hard (9-12 letters): 20 damage
  - Extreme (13+ letters): 25 damage
- Shield power-ups absorb damage temporarily

**4. Scoring System**
- Base points = word length × 10
- Speed bonus = (time remaining / total time) × 50
- Accuracy bonus = current accuracy percentage
- Combo multiplier = consecutive words without miss
- Difficulty multiplier: Easy (1x), Medium (1.5x), Hard (2x), Extreme (3x)

### Game Modes (MVP)

**1. Classic Survival**
- Endless gameplay with increasing difficulty
- Word spawn rate increases every 30 seconds
- Global leaderboard integration

**2. Time Attack**
- Fixed duration (60 seconds, 2 minutes, 5 minutes)
- Maximize score within time limit
- Words don't deal damage, only missed points

**3. Perfect Run**
- One mistake ends the game
- Slower pace, 100% accuracy required
- Special leaderboard for consecutive perfect words

**4. Daily Challenge**
- New challenge parameters each day
- Themed word lists (animals, tech, etc.)
- Community leaderboard with 24-hour reset

### Progressive Difficulty System

**Adaptive AI Algorithm**
```typescript
interface DifficultyState {
  playerAccuracy: number;
  averageWPM: number;
  consecutiveCorrect: number;
  sessionDuration: number;
}

function calculateNextWord(state: DifficultyState): WordDifficulty {
  // Increase difficulty if accuracy > 90% and WPM > target
  // Decrease difficulty if accuracy < 70% or too many misses
  // Maintain flow state with optimal challenge level
}
```

**Word Selection Logic**
- 60% current difficulty level
- 25% one level below (confidence building)
- 15% one level above (skill pushing)
- Smart avoidance of recently failed words
- Category balancing (tech, animals, general)

---

## 🗃️ DATABASE SCHEMA (SUPABASE)

### Tables Structure

```sql
-- Users table (Supabase Auth integration)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player Statistics
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_games_played INTEGER DEFAULT 0,
  total_words_typed INTEGER DEFAULT 0,
  total_characters_typed INTEGER DEFAULT 0,
  best_wpm INTEGER DEFAULT 0,
  best_accuracy DECIMAL(5,2) DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_playtime_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game Sessions
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL,
  score INTEGER NOT NULL,
  words_typed INTEGER NOT NULL,
  words_missed INTEGER NOT NULL,
  accuracy DECIMAL(5,2) NOT NULL,
  wpm INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  difficulty_progression JSONB,
  session_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leaderboards
CREATE TABLE leaderboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL,
  time_period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
  score INTEGER NOT NULL,
  additional_stats JSONB,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, game_mode, time_period)
);

-- Word Lists and Categories
CREATE TABLE word_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  difficulty_level INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word TEXT UNIQUE NOT NULL,
  category_id UUID REFERENCES word_categories(id),
  difficulty_level INTEGER NOT NULL,
  length INTEGER NOT NULL,
  typing_complexity_score DECIMAL(4,2),
  frequency_rank INTEGER,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true
);

-- Daily Challenges
CREATE TABLE daily_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_date DATE UNIQUE NOT NULL,
  challenge_type TEXT NOT NULL,
  parameters JSONB NOT NULL,
  word_categories TEXT[],
  is_active BOOLEAN DEFAULT true
);

-- User Progress Tracking
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES word_categories(id),
  words_mastered INTEGER DEFAULT 0,
  average_accuracy DECIMAL(5,2) DEFAULT 0,
  improvement_rate DECIMAL(5,2) DEFAULT 0,
  last_practiced TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Achievements System
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  criteria JSONB NOT NULL,
  points INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common' -- common, rare, epic, legendary
);

CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress_data JSONB,
  UNIQUE(user_id, achievement_id)
);
```

### Real-time Features

**Live Leaderboards**
```typescript
// Subscribe to leaderboard updates
const { data, error } = await supabase
  .from('leaderboards')
  .select('*')
  .eq('game_mode', 'classic')
  .eq('time_period', 'daily')
  .order('score', { ascending: false })
  .limit(10);

// Real-time subscription
supabase
  .channel('leaderboard-updates')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'leaderboards' },
    handleLeaderboardUpdate
  )
  .subscribe();
```

**Multiplayer Sessions** (Future Feature)
```typescript
// Real-time multiplayer game state
supabase
  .channel(`game-${sessionId}`)
  .on('broadcast', { event: 'word-typed' }, handleOpponentProgress)
  .on('broadcast', { event: 'game-over' }, handleGameEnd)
  .subscribe();
```

---

## 🎵 AUDIO SYSTEM ARCHITECTURE

### Dynamic Music System (Tone.js)

**Adaptive Soundtrack**
```typescript
interface MusicController {
  // Base track layers
  ambientLayer: Tone.Player;
  tensionLayer: Tone.Player;
  actionLayer: Tone.Player;
  
  // Dynamic parameters
  intensity: number; // 0-1 based on game state
  playerAccuracy: number; // Affects harmony
  wordSpeed: number; // Affects tempo
}

// Music responds to gameplay
function updateMusic(gameState: GameState) {
  const intensity = calculateIntensity(gameState);
  
  // Crossfade between layers
  musicController.ambientLayer.volume.value = lerp(-20, -60, intensity);
  musicController.tensionLayer.volume.value = lerp(-60, -10, intensity);
  musicController.actionLayer.volume.value = lerp(-60, 0, intensity * 1.5);
  
  // Adjust tempo based on word speed
  Tone.Transport.bpm.value = 80 + (gameState.wordSpeed * 40);
}
```

**Procedural Sound Effects**
```typescript
class AudioManager {
  // Typing feedback
  keyPressSound: Tone.Synth;
  wordCompleteSound: Tone.PolySynth;
  
  // Game events
  wordMissSound: Tone.NoiseSynth;
  levelUpSound: Tone.MetalSynth;
  gameOverSound: Tone.AMSynth;
  
  // Spatial audio for word positions
  createWordSound(angle: number, distance: number) {
    const panner = new Tone.Panner3D({
      positionX: Math.cos(angle) * distance,
      positionY: Math.sin(angle) * distance,
      positionZ: 0
    });
    
    return this.wordCompleteSound.connect(panner);
  }
}
```

**Audio Performance Optimization**
- Web Audio Context pooling for sound effects
- Tone.js Transport synchronization
- Audio buffer preloading
- Dynamic loading of music tracks
- Spatial audio using Web Audio API 3D positioning

---

## 🎨 VISUAL DESIGN SYSTEM

### Design Language

**Color Palette (aVOID Brand)**
```css
:root {
  /* Primary Colors */
  --avoid-primary: #00ff88;
  --avoid-secondary: #ff0066;
  --avoid-accent: #0088ff;
  
  /* Difficulty Colors */
  --easy: #4ade80;     /* Green */
  --medium: #facc15;   /* Yellow */
  --hard: #f97316;     /* Orange */
  --extreme: #ef4444;  /* Red */
  --boss: #8b5cf6;     /* Purple */
  
  /* Game States */
  --health-high: #10b981;
  --health-medium: #f59e0b;
  --health-low: #ef4444;
  --score: #06b6d4;
  
  /* Dark Theme */
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --text-primary: #ffffff;
  --text-secondary: #a3a3a3;
}
```

**Typography**
```css
/* Game Font Stack */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');

.font-game-primary {
  font-family: 'JetBrains Mono', monospace;
}

.font-game-display {
  font-family: 'Orbitron', monospace;
}
```

**Component Library**
```typescript
// Shared UI components
export const Button = styled.button`
  background: linear-gradient(135deg, var(--avoid-primary), var(--avoid-accent));
  border: none;
  border-radius: 8px;
  color: var(--bg-primary);
  font-family: 'Orbitron', monospace;
  font-weight: 700;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
  }
`;

export const GameCard = styled.div`
  background: rgba(26, 26, 26, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
`;
```

### Animation System

**Framer Motion Variants**
```typescript
const wordAnimations = {
  spawn: {
    scale: 0,
    opacity: 0,
    transition: { type: "spring", stiffness: 300 }
  },
  moving: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.3 }
  },
  hit: {
    scale: [1, 1.2, 0],
    opacity: [1, 1, 0],
    rotate: [0, 180, 360],
    transition: { duration: 0.5 }
  },
  miss: {
    scale: [1, 1.5, 1.5],
    opacity: [1, 0.5, 0],
    backgroundColor: ["#ffffff", "#ef4444", "#ef4444"],
    transition: { duration: 0.8 }
  }
};

const gameUIAnimations = {
  scoreUpdate: {
    scale: [1, 1.2, 1],
    color: ["#06b6d4", "#00ff88", "#06b6d4"],
    transition: { duration: 0.3 }
  },
  healthLoss: {
    x: [-5, 5, -5, 5, 0],
    transition: { duration: 0.4 }
  }
};
```

**Particle Effects**
```typescript
interface ParticleSystem {
  // Word destruction effects
  createWordExplosion(x: number, y: number, wordLength: number): void;
  
  // Typing feedback
  createKeyPressEffect(key: string): void;
  
  // Background ambience
  createFloatingLetters(): void;
  
  // Power-up effects
  createShieldEffect(): void;
}
```

---

## 📱 USER INTERFACE SPECIFICATIONS

### Screen Layouts

**Game Screen**
```typescript
interface GameScreenLayout {
  // Central game area (70% of screen)
  gameCanvas: {
    playerAvatar: PlayerComponent;
    incomingWords: WordComponent[];
    particleEffects: ParticleSystem;
    backgroundGrid: BackgroundComponent;
  };
  
  // HUD Elements (30% of screen)
  topHUD: {
    score: ScoreDisplay;
    accuracy: AccuracyMeter;
    wpm: WPMDisplay;
    timer: TimerComponent;
  };
  
  bottomHUD: {
    health: HealthBar;
    currentWord: CurrentWordDisplay;
    nextWords: WordQueueDisplay;
  };
  
  // Overlay Elements
  pauseMenu: PauseMenuComponent;
  gameOverScreen: GameOverComponent;
  powerUpIndicators: PowerUpDisplay[];
}
```

**Menu System**
```typescript
interface MenuScreens {
  mainMenu: {
    logo: LogoComponent;
    gameMode: GameModeSelector;
    playerStats: StatsPreview;
    leaderboards: LeaderboardPreview;
    settings: SettingsButton;
  };
  
  gameMode: {
    classicSurvival: ModeCard;
    timeAttack: ModeCard;
    perfectRun: ModeCard;
    dailyChallenge: ModeCard;
    customChallenge: ModeCard;
  };
  
  settings: {
    audio: AudioSettings;
    graphics: GraphicsSettings;
    controls: ControlSettings;
    accessibility: AccessibilitySettings;
  };
  
  profile: {
    statistics: PlayerStatistics;
    achievements: AchievementGrid;
    progressTracking: ProgressCharts;
    preferences: UserPreferences;
  };
}
```

### Responsive Design

**Breakpoint System**
```css
/* Mobile First Approach */
.game-container {
  /* Mobile (320px - 768px) */
  @apply p-4;
  
  /* Tablet (768px - 1024px) */
  @screen md {
    @apply p-6;
  }
  
  /* Desktop (1024px+) */
  @screen lg {
    @apply p-8 max-w-6xl mx-auto;
  }
  
  /* Large Desktop (1440px+) */
  @screen xl {
    @apply p-12;
  }
}
```

**Touch Optimization**
```typescript
// Touch-specific optimizations for mobile
interface TouchOptimizations {
  // Larger tap targets for mobile
  minimumTapSize: '44px';
  
  // Gesture support
  swipeToNavigate: boolean;
  pinchToZoom: boolean;
  
  // Virtual keyboard handling
  keyboardAvoidance: boolean;
  inputFieldFocus: boolean;
}
```

---

## ⚡ PERFORMANCE SPECIFICATIONS

### Target Performance Metrics

**Core Metrics**
- **60 FPS** sustained during gameplay
- **<100ms** input latency from keypress to visual feedback
- **<2s** initial load time on 3G connection
- **<500ms** level transition times
- **<16ms** frame time budget for smooth animation

**Memory Management**
```typescript
interface PerformanceTargets {
  // Memory usage
  maxHeapSize: '50MB';
  wordPoolSize: 1000; // Pre-loaded words in memory
  audioBufferSize: '10MB';
  
  // Network
  initialBundleSize: '<500KB gzipped';
  assetLoadingBudget: '<2MB total';
  
  // Storage
  localStorageUsage: '<5MB';
  indexedDBUsage: '<50MB';
}
```

**Optimization Strategies**
```typescript
// Virtualization for large word lists
const VirtualWordList = () => {
  const windowSize = 100; // Only render visible words
  const [startIndex, setStartIndex] = useState(0);
  
  return (
    <VirtualWindow 
      itemCount={words.length}
      itemSize={50}
      windowSize={windowSize}
    >
      {({ index, style }) => (
        <WordComponent 
          key={words[index].id}
          word={words[index]}
          style={style}
        />
      )}
    </VirtualWindow>
  );
};

// Object pooling for game entities
class WordPool {
  private pool: WordEntity[] = [];
  private active: Set<WordEntity> = new Set();
  
  acquire(): WordEntity {
    const word = this.pool.pop() || new WordEntity();
    this.active.add(word);
    return word;
  }
  
  release(word: WordEntity): void {
    word.reset();
    this.active.delete(word);
    this.pool.push(word);
  }
}
```

### Monitoring & Analytics

**Performance Tracking**
```typescript
// Custom performance monitoring
const performanceMonitor = {
  trackFrameRate: () => {
    let lastTime = performance.now();
    let frameCount = 0;
    
    const measure = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        analytics.track('fps', fps);
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measure);
    };
    
    requestAnimationFrame(measure);
  },
  
  trackInputLatency: (keyPress: KeyboardEvent) => {
    const startTime = performance.now();
    
    // Measure time to visual feedback
    requestAnimationFrame(() => {
      const latency = performance.now() - startTime;
      analytics.track('input_latency', latency);
    });
  }
};
```

---

## 🚀 DEPLOYMENT & DEVOPS

### Netlify Configuration

**Build Settings**
```toml
# netlify.toml
[build]
  base = "/"
  publish = "dist/"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "20"
  NPM_VERSION = "10"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Environment Variables**
```bash
# Production
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ENVIRONMENT=production
VITE_ANALYTICS_ID=your-analytics-id

# Development
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=local-anon-key
VITE_ENVIRONMENT=development
```

### CI/CD Pipeline

**GitHub Actions Workflow**
```yaml
name: Deploy to Netlify

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run e2e

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v3.0
        with:
          publish-dir: './dist'
          production-branch: main
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions"
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### Supabase Configuration

**Database Migrations**
```sql
-- migrations/001_initial_schema.sql
-- (Database schema from previous section)

-- migrations/002_rls_policies.sql
-- Row Level Security policies
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stats" ON player_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON player_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- migrations/003_edge_functions.sql
-- Edge functions for real-time features
```

**Supabase Edge Functions**
```typescript
// supabase/functions/calculate-leaderboard/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Calculate and update leaderboard rankings
  const { data, error } = await supabase
    .from('game_sessions')
    .select('user_id, score, game_mode')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  // Process leaderboard updates...
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## 📊 ANALYTICS & MONITORING

### Event Tracking

**Game Analytics**
```typescript
interface AnalyticsEvents {
  // Gameplay events
  game_started: {
    mode: string;
    difficulty: string;
    timestamp: number;
  };
  
  word_typed: {
    word: string;
    difficulty: string;
    accuracy: number;
    time_taken: number;
    was_correct: boolean;
  };
  
  game_ended: {
    mode: string;
    score: number;
    duration: number;
    words_typed: number;
    accuracy: number;
    reason: 'death' | 'time_up' | 'quit';
  };
  
  // User progression
  level_up: {
    old_level: number;
    new_level: number;
    category: string;
  };
  
  achievement_unlocked: {
    achievement_id: string;
    achievement_name: string;
  };
  
  // Performance metrics
  performance_sample: {
    fps: number;
    input_latency: number;
    memory_usage: number;
  };
}

// Analytics implementation
class Analytics {
  track<K extends keyof AnalyticsEvents>(
    event: K, 
    properties: AnalyticsEvents[K]
  ): void {
    // Send to multiple analytics providers
    this.sendToSupabase(event, properties);
    this.sendToMixpanel(event, properties);
    this.sendToCustomAnalytics(event, properties);
  }
  
  private async sendToSupabase(event: string, properties: any) {
    await supabase.from('analytics_events').insert({
      event_name: event,
      properties,
      user_id: auth.user?.id,
      timestamp: new Date().toISOString()
    });
  }
}
```

### A/B Testing Framework

**Experiment Configuration**
```typescript
interface Experiment {
  id: string;
  name: string;
  variants: ExperimentVariant[];
  traffic_allocation: number; // 0-1
  targeting_rules: TargetingRule[];
}

interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // Relative weight for random assignment
  config: Record<string, any>;
}

// Usage in components
const DifficultySelector = () => {
  const experiment = useExperiment('difficulty_progression_v2');
  
  const difficultyConfig = {
    control: { increase_rate: 1.0, word_pool_size: 100 },
    variant_a: { increase_rate: 1.2, word_pool_size: 150 },
    variant_b: { increase_rate: 0.8, word_pool_size: 80 }
  };
  
  const config = difficultyConfig[experiment.variant] || difficultyConfig.control;
  
  return <GameDifficulty config={config} />;
};
```

---

## 🔒 SECURITY & PRIVACY

### Data Protection

**Privacy Compliance**
```typescript
interface PrivacySettings {
  // GDPR compliance
  data_collection_consent: boolean;
  analytics_consent: boolean;
  marketing_consent: boolean;
  
  // Data retention
  session_data_retention: '90_days';
  user_data_retention: '2_years';
  analytics_data_retention: '1_year';
  
  // User rights
  data_export_available: boolean;
  data_deletion_available: boolean;
  consent_withdrawal_available: boolean;
}

// Privacy-preserving analytics
class PrivacyCompliantAnalytics {
  constructor(private userConsent: PrivacySettings) {}
  
  track(event: string, properties: any): void {
    if (!this.userConsent.analytics_consent) return;
    
    // Hash PII before sending
    const sanitizedProperties = this.sanitizeData(properties);
    this.sendEvent(event, sanitizedProperties);
  }
  
  private sanitizeData(data: any): any {
    // Remove or hash personally identifiable information
    return {
      ...data,
      user_id: this.hashUserId(data.user_id),
      ip_address: undefined, // Remove IP
      email: undefined // Remove email
    };
  }
}
```

**Input Validation & Sanitization**
```typescript
// Server-side validation with Zod
import { z } from 'zod';

const GameSessionSchema = z.object({
  game_mode: z.enum(['classic', 'time_attack', 'perfect_run', 'daily_challenge']),
  score: z.number().min(0).max(1000000),
  words_typed: z.number().min(0).max(10000),
  accuracy: z.number().min(0).max(100),
  duration_seconds: z.number().min(1).max(3600),
  wpm: z.number().min(0).max(300)
});

// Rate limiting
const rateLimiter = {
  game_sessions: '10 per minute',
  leaderboard_updates: '5 per minute',
  profile_updates: '3 per minute'
};

// Content Security Policy
const cspConfig = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
  'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  'font-src': ["'self'", "https://fonts.gstatic.com"],
  'connect-src': ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
  'media-src': ["'self'", "data:"],
  'img-src': ["'self'", "data:", "https:"]
};
```

---

## 🎯 SUCCESS METRICS & KPIs

### Product Metrics

**Engagement Metrics**
```typescript
interface EngagementKPIs {
  // Core engagement
  daily_active_users: number;
  weekly_active_users: number;
  monthly_active_users: number;
  session_duration_avg: number; // minutes
  sessions_per_user_per_day: number;
  
  // Game-specific
  games_completed_per_session: number;
  average_score_progression: number;
  typing_improvement_rate: number; // WPM increase over time
  accuracy_improvement_rate: number;
  
  // Retention
  day_1_retention: number; // %
  day_7_retention: number; // %
  day_30_retention: number; // %
  
  // Social features
  leaderboard_participation_rate: number; // %
  daily_challenge_completion_rate: number; // %
}
```

**Business Metrics**
```typescript
interface BusinessKPIs {
  // Growth
  user_acquisition_rate: number; // new users per day
  organic_growth_rate: number; // % from referrals
  viral_coefficient: number; // users invited per user
  
  // Platform metrics (for aVOID studio)
  cross_game_engagement: number; // % playing multiple games
  platform_session_duration: number;
  game_discovery_rate: number; // % finding via platform
  
  // Performance
  technical_error_rate: number; // % of sessions with errors
  crash_rate: number; // % of sessions ending in crash
  load_time_p95: number; // 95th percentile load time
}
```

### Learning Effectiveness Metrics

**Skill Development Tracking**
```typescript
interface SkillMetrics {
  // Typing improvements
  wpm_improvement_weekly: number;
  accuracy_improvement_weekly: number;
  weak_finger_improvement: Record<string, number>; // pinky, ring, etc.
  
  // Word mastery
  words_mastered_per_session: number;
  difficult_words_conquered: number;
  category_completion_rate: Record<string, number>;
  
  // Learning curve
  time_to_reach_milestones: {
    first_perfect_word: number; // seconds
    first_10_words: number;
    first_50_wpm: number;
    first_100_words_session: number;
  };
  
  // Retention of skills
  skill_retention_rate: number; // % maintained after break
  comeback_speed: number; // time to return to peak after break
}
```

---

## 🧪 TESTING STRATEGY

### Test Coverage Requirements

**Unit Tests (Vitest)**
```typescript
// Example test structure
describe('WordDifficulty', () => {
  it('should calculate difficulty correctly', () => {
    const word = 'programming';
    const difficulty = calculateWordDifficulty(word);
    
    expect(difficulty.level).toBe('medium');
    expect(difficulty.score).toBeGreaterThan(5);
    expect(difficulty.factors).toContain('double_letters');
  });
  
  it('should handle edge cases', () => {
    expect(calculateWordDifficulty('')).toThrow();
    expect(calculateWordDifficulty('a')).toHaveProperty('level', 'easy');
    expect(calculateWordDifficulty('zyzzyva')).toHaveProperty('level', 'extreme');
  });
});

describe('GameEngine', () => {
  it('should spawn words at correct intervals', async () => {
    const engine = new GameEngine();
    const spawnSpy = vi.spyOn(engine, 'spawnWord');
    
    engine.start();
    await vi.advanceTimersByTime(5000);
    
    expect(spawnSpy).toHaveBeenCalledTimes(5);
  });
});
```

**Integration Tests**
```typescript
// Database integration tests
describe('Leaderboard Integration', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });
  
  it('should update leaderboard after game completion', async () => {
    const gameSession = {
      user_id: 'test-user',
      game_mode: 'classic',
      score: 1500,
      // ... other properties
    };
    
    await submitGameSession(gameSession);
    
    const leaderboard = await getLeaderboard('classic', 'daily');
    expect(leaderboard[0].score).toBe(1500);
  });
});
```

**End-to-End Tests (Playwright)**
```typescript
// E2E test examples
test('complete game flow', async ({ page }) => {
  await page.goto('/');
  
  // Start a game
  await page.click('[data-testid="classic-mode"]');
  await page.click('[data-testid="start-game"]');
  
  // Type some words
  await page.waitForSelector('[data-testid="incoming-word"]');
  const firstWord = await page.textContent('[data-testid="current-word"]');
  await page.keyboard.type(firstWord);
  
  // Verify score update
  const score = await page.textContent('[data-testid="score"]');
  expect(parseInt(score)).toBeGreaterThan(0);
  
  // Complete game
  await page.click('[data-testid="pause-button"]');
  await page.click('[data-testid="end-game"]');
  
  // Verify results screen
  await page.waitForSelector('[data-testid="game-results"]');
  expect(page.url()).toContain('/results');
});

test('accessibility compliance', async ({ page }) => {
  await page.goto('/');
  
  // Check keyboard navigation
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  
  // Verify focus management
  const focusedElement = page.locator(':focus');
  await expect(focusedElement).toBeVisible();
  
  // Check ARIA labels
  await expect(page.locator('[aria-label="Start game"]')).toBeVisible();
});
```

**Performance Tests**
```typescript
test('game performance under load', async ({ page }) => {
  await page.goto('/game');
  
  // Start performance monitoring
  await page.evaluate(() => {
    window.performanceMetrics = {
      frameDrops: 0,
      inputLatency: []
    };
    
    // Monitor frame rate
    let lastFrame = performance.now();
    function measureFrameRate() {
      const now = performance.now();
      const frameDuration = now - lastFrame;
      
      if (frameDuration > 20) { // > 50fps
        window.performanceMetrics.frameDrops++;
      }
      
      lastFrame = now;
      requestAnimationFrame(measureFrameRate);
    }
    requestAnimationFrame(measureFrameRate);
  });
  
  // Simulate intensive gameplay
  for (let i = 0; i < 100; i++) {
    await page.keyboard.type('test ');
    await page.waitForTimeout(50);
  }
  
  // Check performance metrics
  const metrics = await page.evaluate(() => window.performanceMetrics);
  expect(metrics.frameDrops).toBeLessThan(5);
});
```

---

## 🔄 DEVELOPMENT WORKFLOW

### Git Strategy

**Branch Structure**
```
main                 # Production-ready code
├── develop         # Integration branch
├── feature/*       # Feature development
├── bugfix/*        # Bug fixes
├── hotfix/*        # Emergency production fixes
└── release/*       # Release preparation
```

**Commit Convention**
```
feat(game): add word difficulty calculation
fix(audio): resolve sound effect memory leak
docs(readme): update installation instructions
style(ui): improve button hover animations
refactor(store): simplify state management
test(game): add unit tests for scoring system
perf(rendering): optimize word rendering performance
chore(deps): update dependencies

Breaking changes:
feat(api)!: change leaderboard response format
```

**Code Review Process**
```typescript
// .github/pull_request_template.md
## Changes Made
- [ ] Feature implementation
- [ ] Bug fix
- [ ] Performance improvement
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Manual testing completed

## Performance Impact
- [ ] No performance regression
- [ ] Performance improvement measured
- [ ] Memory usage within limits

## Security Considerations
- [ ] No sensitive data exposed
- [ ] Input validation implemented
- [ ] Authentication/authorization checked
```

### Development Environment

**Local Setup**
```bash
# Development setup script
#!/bin/bash
echo "Setting up WORDaVOID development environment..."

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
echo "Please update .env.local with your Supabase credentials"

# Setup local database
npx supabase start
npx supabase db reset

# Setup git hooks
npx husky install

# Start development server
npm run dev

echo "✅ Development environment ready!"
echo "🚀 Game available at http://localhost:5173"
echo "📊 Supabase Studio: http://localhost:54323"
```

**Development Scripts**
```json
{
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test",
    "test:coverage": "vitest --coverage",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "type-check": "tsc --noEmit",
    "db:reset": "supabase db reset",
    "db:migrate": "supabase db push",
    "db:types": "supabase gen types typescript --local > src/types/database.ts",
    "analyze": "npm run build && npx webpack-bundle-analyzer dist/stats.json",
    "clean": "rm -rf dist node_modules/.vite",
    "postinstall": "husky install"
  }
}
```

---

## 📅 PROJECT TIMELINE & MILESTONES

### Phase 1: MVP Foundation (Weeks 1-4)
**Week 1-2: Core Setup**
- [ ] Project scaffolding with Vite + React + TypeScript
- [ ] Supabase database setup and schema implementation
- [ ] Basic authentication integration
- [ ] Core game engine architecture
- [ ] Word database population (easy/medium words)

**Week 3-4: Basic Gameplay**
- [ ] Player positioning and basic UI
- [ ] Word spawning and movement system
- [ ] Typing input handling and word matching
- [ ] Basic scoring and health system
- [ ] Simple visual feedback and animations

### Phase 2: Core Features (Weeks 5-8)
**Week 5-6: Game Modes**
- [ ] Classic Survival mode implementation
- [ ] Time Attack mode
- [ ] Basic difficulty progression
- [ ] Local leaderboards and statistics

**Week 7-8: Polish & UX**
- [ ] Audio system implementation (Tone.js)
- [ ] Visual effects and particle system
- [ ] Responsive design for mobile/tablet
- [ ] Settings and preferences system

### Phase 3: Advanced Features (Weeks 9-12)
**Week 9-10: Social Features**
- [ ] Global leaderboards with Supabase real-time
- [ ] Daily challenges system
- [ ] Achievement system implementation
- [ ] User profile and statistics tracking

**Week 11-12: Platform Integration**
- [ ] aVOID studio branding and theme integration
- [ ] Performance optimization and testing
- [ ] Accessibility improvements
- [ ] Cross-browser compatibility testing

### Phase 4: Launch Preparation (Weeks 13-16)
**Week 13-14: Testing & QA**
- [ ] Comprehensive testing suite completion
- [ ] Performance optimization and monitoring
- [ ] Security audit and vulnerability assessment
- [ ] User acceptance testing with beta users

**Week 15-16: Launch & Monitoring**
- [ ] Production deployment to Netlify
- [ ] Analytics and monitoring setup
- [ ] Launch marketing and documentation
- [ ] Post-launch bug fixes and improvements

---

## 🎯 POST-LAUNCH ROADMAP

### Short-term (Months 1-3)
- **Multiplayer Battles**: Real-time 1v1 typing competitions
- **Custom Word Lists**: User-generated content and sharing
- **Advanced Analytics**: Detailed typing improvement tracking
- **Mobile App**: React Native version for iOS/Android

### Medium-term (Months 4-6)
- **AI Opponent**: Smart AI that adapts to player skill
- **Tournaments**: Organized competitive events
- **Educational Mode**: Curriculum-based typing lessons
- **Team Battles**: Guild/team-based competitions

### Long-term (Months 7-12)
- **VR/AR Support**: Immersive typing experiences
- **Voice Integration**: Speech-to-text challenges
- **Procedural Challenges**: AI-generated typing patterns
- **Educational Partnerships**: School and corporate programs

---

## 📋 APPENDICES

### A. Technical Dependencies

**Core Dependencies**
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.5.3",
    "@supabase/supabase-js": "^2.44.0",
    "zustand": "^4.5.2",
    "@tanstack/react-query": "^5.49.2",
    "framer-motion": "^11.2.10",
    "tone": "^14.7.77",
    "react-hook-form": "^7.52.0",
    "zod": "^3.23.8",
    "tailwindcss": "^3.4.4"
  },
  "devDependencies": {
    "vite": "^5.3.1",
    "vitest": "^1.6.0",
    "@playwright/test": "^1.45.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.15.0",
    "prettier": "^3.3.2",
    "husky": "^9.0.11",
    "lint-staged": "^15.2.7"
  }
}
```

### B. Browser Support Matrix

| Browser | Minimum Version | Features |
|---------|----------------|----------|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari | 14+ | Full support |
| Edge | 90+ | Full support |
| Mobile Safari | 14+ | Touch optimized |
| Chrome Mobile | 90+ | Touch optimized |

### C. Accessibility Compliance

**WCAG 2.1 AA Standards**
- [ ] Keyboard navigation for all interactive elements
- [ ] Screen reader compatibility with ARIA labels
- [ ] Color contrast ratio > 4.5:1 for normal text
- [ ] Color contrast ratio > 3:1 for large text
- [ ] Focus indicators visible and clear
- [ ] Alternative text for all images
- [ ] Captions for audio content
- [ ] Semantic HTML structure

### D. Performance Budgets

| Metric | Target | Critical |
|--------|--------|----------|
| First Contentful Paint | < 1.5s | < 2.5s |
| Largest Contentful Paint | < 2.5s | < 4.0s |
| First Input Delay | < 100ms | < 300ms |
| Cumulative Layout Shift | < 0.1 | < 0.25 |
| Total Bundle Size | < 500KB | < 1MB |
| JavaScript Bundle | < 300KB | < 600KB |

---

## ✅ SIGN-OFF

**Product Owner**: [Signature Required]  
**Technical Lead**: [Signature Required]  
**Design Lead**: [Signature Required]  
**QA Lead**: [Signature Required]  

**Document Version**: 1.0  
**Last Updated**: July 2025  
**Next Review**: August 2025  

---

*This PRD represents the technical foundation for WORDaVOID, built using July 2025 best practices for modern web development. The specification balances ambitious features with realistic implementation timelines, ensuring a successful launch for the aVOID Games Studio platform.*