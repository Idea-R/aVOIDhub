# aVOIDgame.io Multi-Game Platform Deployment Plan
## 2025 Architecture & Implementation Strategy

### Executive Summary

This document outlines the deployment strategy for consolidating VOIDaVOID, WreckaVOID, and TankaVOID into a unified gaming platform at **aVOIDgame.io**. The architecture leverages 2025 best practices including multi-zone deployment, unified SSO, and cost-optimized infrastructure.

---

## 1. Architecture Overview

### 1.1 Domain Strategy
```
aVOIDgame.io              → Hub Platform (React/Vite)
aVOIDgame.io/void         → VOIDaVOID Game
aVOIDgame.io/wreck        → WreckaVOID Game  
aVOIDgame.io/tank         → TankaVOID Game
aVOIDgame.io/api/*        → Unified Backend API
aVOIDgame.io/cdn/*        → Static Assets CDN
```

### 1.2 Multi-Zone Architecture Benefits
- **Independent Development**: Each game team can work autonomously
- **Incremental Deployment**: Deploy games individually without affecting others
- **Shared Resources**: Common authentication, leaderboards, user profiles
- **Cost Optimization**: Single CloudFront distribution reduces CORS overhead
- **Performance**: HTTP/2 connection reuse across all zones

---

## 2. Technical Implementation

### 2.1 Zone Configuration

#### Hub Platform (Root Zone)
```javascript
// netlify.toml for Hub Platform
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/void/*"
  to = "https://void-deploy.aVOIDgame.io/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/wreck/*" 
  to = "https://wreck-deploy.aVOIDgame.io/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/tank/*"
  to = "https://tank-deploy.aVOIDgame.io/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/api/*"
  to = "https://jyuafqzjrzifqbgcqbnt.supabase.co/rest/v1/:splat"
  status = 200
  force = true
  headers = {X-Game-Platform = "aVOIDgame-hub"}
```

#### Game Zone Configuration (VOIDaVOID Example)
```javascript
// vite.config.ts for VOIDaVOID
export default defineConfig({
  base: '/void/',
  build: {
    assetsDir: 'void-assets',
    rollupOptions: {
      output: {
        assetFileNames: 'void-assets/[name]-[hash][extname]',
        chunkFileNames: 'void-assets/[name]-[hash].js',
        entryFileNames: 'void-assets/[name]-[hash].js'
      }
    }
  }
})
```

### 2.2 Git Repository Structure

```
aVOIDgame-platform/
├── hub/                     # Main hub platform
│   ├── src/
│   ├── package.json
│   └── netlify.toml
├── games/
│   ├── voidavoid/          # Submodule or workspace
│   ├── wreckavoid/         # Submodule or workspace  
│   └── tankavoid/          # Submodule or workspace
├── shared/
│   ├── sdk/                # aVOID Games SDK
│   ├── components/         # Shared UI components
│   └── types/              # TypeScript definitions
├── database/
│   └── supabase/           # Database migrations
└── deployment/
    ├── netlify-functions/  # Edge functions
    └── ci-cd/              # Deployment workflows
```

### 2.3 Deployment Workflow

#### Production Deployment Pipeline
```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production
on:
  push:
    branches: [main]

jobs:
  deploy-hub:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Hub Platform
        run: |
          cd hub
          npm ci
          npm run build
          netlify deploy --prod --dir=dist

  deploy-games:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        game: [voidavoid, wreckavoid, tankavoid]
    steps:
      - name: Deploy Game Zone
        run: |
          cd games/${{ matrix.game }}
          npm ci
          npm run build:production
          netlify deploy --prod --site=${{ matrix.game }}-deploy
```

---

## 3. Database Architecture

### 3.1 Multi-Game Schema Enhancement

```sql
-- Enhanced database schema for multi-game platform

-- Games registry table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  banner_url TEXT,
  play_url TEXT,
  is_active BOOLEAN DEFAULT true,
  player_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert game entries
INSERT INTO games (game_key, name, description, play_url) VALUES
('voidavoid', 'VOIDaVOID', 'Original asteroid avoidance game', '/void'),
('wreckavoid', 'WreckaVOID', 'Combat-focused space game', '/wreck'),
('tankavoid', 'TankaVOID', 'Tank warfare game', '/tank');

-- Enhanced user profiles for multi-game
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_game TEXT DEFAULT 'voidavoid';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_play_time INTERVAL DEFAULT '0 seconds';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS achievements JSONB DEFAULT '{}';

-- Multi-game leaderboards
ALTER TABLE leaderboard_scores ADD COLUMN IF NOT EXISTS game_key TEXT DEFAULT 'voidavoid';
ALTER TABLE leaderboard_scores ADD CONSTRAINT fk_leaderboard_game 
  FOREIGN KEY (game_key) REFERENCES games(game_key);

-- Cross-game statistics view
CREATE VIEW user_game_stats AS
SELECT 
  up.id,
  up.username,
  up.display_name,
  g.game_key,
  g.name as game_name,
  COUNT(ls.id) as games_played,
  MAX(ls.score) as high_score,
  AVG(ls.score) as avg_score,
  MAX(ls.created_at) as last_played
FROM user_profiles up
CROSS JOIN games g
LEFT JOIN leaderboard_scores ls ON up.id = ls.user_id AND g.game_key = ls.game_key
WHERE g.is_active = true
GROUP BY up.id, up.username, up.display_name, g.game_key, g.name;
```

### 3.2 Data Migration Strategy

#### Phase 1: Schema Expansion (COMPLETED ✅)
- Added `games` table
- Enhanced `leaderboard_scores` with `game_key`
- Fixed foreign key relationships

#### Phase 2: Data Migration
```sql
-- Migrate existing scores to VOIDaVOID game
UPDATE leaderboard_scores 
SET game_key = 'voidavoid' 
WHERE game_key IS NULL OR game_key = '';

-- Update player counts
UPDATE games SET player_count = (
  SELECT COUNT(DISTINCT user_id) 
  FROM leaderboard_scores 
  WHERE game_key = games.game_key
);
```

#### Phase 3: Data Preservation
- Existing user data remains intact
- 60 leaderboard scores preserved
- 16 user profiles maintained
- Gradual migration with zero downtime

---

## 4. Authentication & SSO Integration

### 4.1 Unified Authentication Flow

```typescript
// Shared authentication SDK
export class aVOIDAuthSDK {
  private supabase: SupabaseClient;
  
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          storageKey: 'aVOIDgame-auth',
          storage: window.localStorage
        }
      }
    );
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (data.user) {
      // Broadcast auth state to all game zones
      window.postMessage({
        type: 'AVOID_AUTH_UPDATE',
        user: data.user,
        session: data.session
      }, '*');
    }
    
    return { data, error };
  }

  async signInWithGoogle() {
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }

  // Cross-zone session sharing
  initCrossZoneAuth() {
    window.addEventListener('message', (event) => {
      if (event.data.type === 'AVOID_AUTH_REQUEST') {
        const session = this.supabase.auth.getSession();
        window.postMessage({
          type: 'AVOID_AUTH_RESPONSE',
          session
        }, '*');
      }
    });
  }
}
```

### 4.2 Google OAuth Configuration

```typescript
// Enhanced Google OAuth setup in Supabase
const googleOAuthConfig = {
  provider: 'google',
  scopes: 'email profile',
  redirectTo: 'https://aVOIDgame.io/auth/callback',
  additionalUserFields: {
    display_name: 'name',
    avatar_url: 'picture',
    country_code: 'locale'
  }
};

// Auto-create user profile on first login
const createUserProfile = async (user: User) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      id: user.id,
      username: user.email?.split('@')[0] || 'player',
      display_name: user.user_metadata?.name || 'New Player',
      avatar_url: user.user_metadata?.picture,
      country_code: user.user_metadata?.locale || 'US'
    });
  
  return { data, error };
};
```

---

## 5. Edge Functions & API Architecture

### 5.1 Unified API Layer

```typescript
// netlify/functions/game-api.ts
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event, context) => {
  const { path, httpMethod, headers, body } = event;
  
  // Parse game context from headers
  const gameKey = headers['x-game-key'] || 'voidavoid';
  const platform = headers['x-game-platform'] || 'unknown';
  
  try {
    switch (httpMethod) {
      case 'GET':
        if (path.includes('/leaderboard')) {
          return await getLeaderboard(gameKey);
        }
        if (path.includes('/profile')) {
          return await getUserProfile(headers.authorization);
        }
        break;
        
      case 'POST':
        if (path.includes('/score')) {
          return await submitScore(gameKey, body, headers.authorization);
        }
        break;
    }
    
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Endpoint not found' })
    };
    
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function getLeaderboard(gameKey: string) {
  const { data, error } = await supabase
    .from('leaderboard_scores')
    .select(`
      *,
      user_profiles (
        username,
        display_name,
        avatar_url,
        country_code
      )
    `)
    .eq('game_key', gameKey)
    .order('score', { ascending: false })
    .limit(100);
    
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // 5 minute cache
    },
    body: JSON.stringify({ data, error })
  };
}
```

### 5.2 Performance Optimization

```typescript
// Edge function for game asset optimization
export const handler: Handler = async (event) => {
  const { path } = event;
  
  // Route to appropriate CDN based on game
  if (path.startsWith('/void-assets/')) {
    return {
      statusCode: 301,
      headers: {
        'Location': `https://void-cdn.aVOIDgame.io${path}`,
        'Cache-Control': 'public, max-age=31536000' // 1 year
      }
    };
  }
  
  if (path.startsWith('/api/v1/')) {
    // Route to Supabase with game context
    return {
      statusCode: 301,
      headers: {
        'Location': `https://jyuafqzjrzifqbgcqbnt.supabase.co/rest/v1${path.replace('/api/v1', '')}`,
        'X-Game-Platform': 'aVOIDgame-hub'
      }
    };
  }
};
```

---

## 6. Cost Optimization Strategy

### 6.1 Consolidated Infrastructure Savings

| Component | Before (3 separate) | After (unified) | Savings |
|-----------|--------------------|-----------------|---------| 
| CloudFront Distributions | 3 × $0.085/GB | 1 × $0.085/GB | 66% reduction |
| CORS Preflight Requests | 3 × API calls | 0 additional | ~50% API reduction |
| SSL Certificates | 3 × $0.75/month | 1 × $0.75/month | $1.50/month |
| Origin Requests | 3 separate origins | 1 unified origin | 40% reduction |

### 6.2 Netlify Edge Function Benefits

```typescript
// Cost-optimized caching strategy
const cacheConfig = {
  leaderboards: '5 minutes',
  userProfiles: '1 hour', 
  gameAssets: '1 year',
  apiResponses: 'no-cache',
  staticContent: '1 month'
};

// Smart routing to minimize origin requests
export const smartRoute = (request: Request) => {
  const url = new URL(request.url);
  
  // Cache static game assets aggressively  
  if (url.pathname.includes('-assets/')) {
    return new Response(null, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  }
  
  // Cache leaderboards briefly
  if (url.pathname.includes('/leaderboard')) {
    return new Response(null, {
      headers: {
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
};
```

---

## 7. Development Workflow

### 7.1 Local Development Setup

```bash
# Clone unified repository
git clone https://github.com/aVOIDgame/platform.git
cd platform

# Install dependencies for all zones
npm run install:all

# Start development servers
npm run dev:hub      # Port 3000 - Hub platform
npm run dev:void     # Port 3001 - VOIDaVOID  
npm run dev:wreck    # Port 3002 - WreckaVOID
npm run dev:tank     # Port 3003 - TankaVOID

# Start with proxy for unified development
npm run dev:unified  # All zones accessible via localhost:3000
```

### 7.2 Testing Strategy

```typescript
// Cross-zone integration tests
describe('aVOIDgame Platform Integration', () => {
  it('should maintain auth across all zones', async () => {
    // Test authentication flow
    await authSDK.signIn('test@example.com', 'password');
    
    // Verify auth works in all zones
    expect(await testZoneAuth('/void')).toBe(true);
    expect(await testZoneAuth('/wreck')).toBe(true);  
    expect(await testZoneAuth('/tank')).toBe(true);
  });
  
  it('should share leaderboards across games', async () => {
    const voidScore = await submitScore('voidavoid', 1000);
    const wreckScore = await submitScore('wreckavoid', 2000);
    
    const globalLeaderboard = await getGlobalLeaderboard();
    expect(globalLeaderboard).toContainEqual(voidScore);
    expect(globalLeaderboard).toContainEqual(wreckScore);
  });
});
```

---

## 8. Monitoring & Analytics

### 8.1 Unified Monitoring Dashboard

```typescript
// Performance monitoring across all zones
const monitoringConfig = {
  zones: ['hub', 'void', 'wreck', 'tank'],
  metrics: [
    'page_load_time',
    'api_response_time', 
    'error_rate',
    'user_engagement',
    'cross_zone_navigation'
  ],
  alerts: {
    error_rate: '> 5%',
    response_time: '> 2s',
    uptime: '< 99.9%'
  }
};

// Real-time analytics
export const trackGameEvent = (gameKey: string, event: string, data: any) => {
  analytics.track(`game:${gameKey}:${event}`, {
    ...data,
    timestamp: Date.now(),
    session_id: getSessionId(),
    user_id: getCurrentUser()?.id
  });
};
```

### 8.2 Error Tracking Integration

```typescript
// Enhanced error tracking for multi-zone
export const setupZoneErrorTracking = (zoneId: string) => {
  window.addEventListener('error', (error) => {
    errorTracker.logError('Zone Error', error, {
      zone: zoneId,
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  });
  
  // Track zone transitions
  trackZoneNavigation(zoneId);
};
```

---

## 9. Security Considerations

### 9.1 Content Security Policy

```typescript
// Unified CSP for all zones
const csp = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for game engines
    "https://aVOIDgame.io",
    "https://*.supabase.co"
  ],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", "data:", "https://*.supabase.co"],
  'connect-src': [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co"
  ],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"]
};
```

### 9.2 API Security

```typescript
// Rate limiting and security headers
export const securityMiddleware = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    gameSpecific: {
      'score-submission': { max: 10, windowMs: 60 * 1000 } // 10 scores per minute
    }
  },
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  }
};
```

---

## 10. Migration Timeline

### Phase 1: Foundation (Week 1-2) ✅ COMPLETED
- [x] Database schema fixes and enhancements
- [x] Error tracking system implementation  
- [x] Hub platform foundation

### Phase 2: Git Repository Setup (Week 3)
- [ ] Create unified repository structure
- [ ] Set up git submodules or workspace configuration
- [ ] Implement shared aVOID Games SDK

### Phase 3: Game Integration (Week 4-6)
- [ ] Configure VOIDaVOID for `/void` zone
- [ ] Configure WreckaVOID for `/wreck` zone  
- [ ] Configure TankaVOID for `/tank` zone
- [ ] Implement cross-zone authentication

### Phase 4: Deployment & Testing (Week 7-8)
- [ ] Set up production deployment pipeline
- [ ] Configure Netlify edge functions
- [ ] Comprehensive integration testing
- [ ] Performance optimization

### Phase 5: Launch & Monitoring (Week 9)
- [ ] Production deployment to aVOIDgame.io
- [ ] DNS migration and CDN setup
- [ ] Monitor performance and user experience
- [ ] Gradual traffic migration

---

## 11. Success Metrics

### Technical Metrics
- **Performance**: < 2s page load time across all zones
- **Uptime**: 99.9% availability
- **Error Rate**: < 1% across all games
- **API Response Time**: < 500ms average

### Business Metrics  
- **User Retention**: Cross-game engagement increased by 25%
- **Development Velocity**: 50% faster feature deployment
- **Infrastructure Cost**: 40% reduction in hosting costs
- **User Experience**: Seamless authentication across all games

### Data Preservation
- **Zero Data Loss**: All existing scores and profiles maintained
- **User Continuity**: Existing users seamlessly transition to new platform
- **Score Integrity**: All 60 existing leaderboard entries preserved

---

## 12. Rollback Strategy

### Emergency Rollback Plan
1. **DNS Rollback**: Revert DNS to point to individual game deployments
2. **Database Rollback**: Restore from pre-migration backup if needed
3. **Individual Zone Deployment**: Each game can operate independently
4. **User Data Preservation**: All migration steps are non-destructive

### Monitoring & Alerts
- Real-time monitoring of all zones
- Automated rollback triggers for critical failures
- User experience monitoring and feedback collection
- Performance benchmarking against current setup

---

## Conclusion

This deployment plan provides a comprehensive roadmap for consolidating the aVOID games into a unified platform while maintaining independence, preserving existing data, and optimizing for performance and cost. The architecture leverages 2025 best practices including multi-zone deployment, unified authentication, and edge optimization.

The strategy ensures:
- ✅ **Zero downtime migration**
- ✅ **Complete data preservation** 
- ✅ **Independent game development**
- ✅ **Unified user experience**
- ✅ **Cost optimization**
- ✅ **Future scalability**

Ready for implementation with existing infrastructure and can be executed incrementally with minimal risk. 