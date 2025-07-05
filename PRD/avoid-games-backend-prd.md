# aVOID Games Backend - Unified API System

## Executive Summary

A unified backend system for the aVOID games ecosystem, providing standardized authentication, global leaderboards, and extensible APIs for rapid game integration. This system will power aVOIDgame.io as the central hub for all aVOID games.

## System Architecture

### Tech Stack

#### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js / Fastify (for performance)
- **Database**: PostgreSQL (primary) + Redis (caching/sessions)
- **Authentication**: JWT with refresh tokens
- **API Protocol**: REST + WebSocket (real-time updates)
- **Documentation**: OpenAPI 3.0 (Swagger)

#### Infrastructure
- **Hosting**: AWS/Google Cloud/Vercel
- **CDN**: CloudFlare
- **Container**: Docker + Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(50),
    avatar_url VARCHAR(500),
    country_code CHAR(2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE
);

-- Games registry
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_key VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'wreckavoid'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    banner_url VARCHAR(500),
    play_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    settings JSONB DEFAULT '{}'
);

-- Leaderboards configuration
CREATE TABLE leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id),
    leaderboard_key VARCHAR(50) NOT NULL, -- e.g., 'high_score', 'speedrun'
    name VARCHAR(100) NOT NULL,
    score_type VARCHAR(20) NOT NULL, -- 'numeric', 'time', 'custom'
    sort_order VARCHAR(4) DEFAULT 'DESC', -- DESC or ASC
    reset_schedule VARCHAR(20), -- 'daily', 'weekly', 'monthly', 'never'
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(game_id, leaderboard_key)
);

-- Scores
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    game_id UUID REFERENCES games(id),
    leaderboard_id UUID REFERENCES leaderboards(id),
    score NUMERIC NOT NULL,
    metadata JSONB DEFAULT '{}', -- Additional data (time played, level, etc)
    achieved_at TIMESTAMP DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT TRUE,
    INDEX idx_leaderboard_scores (leaderboard_id, score DESC)
);

-- User sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    device_info JSONB,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Achievements (future expansion)
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id),
    achievement_key VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    points INTEGER DEFAULT 0,
    UNIQUE(game_id, achievement_key)
);

-- User achievements
CREATE TABLE user_achievements (
    user_id UUID REFERENCES users(id),
    achievement_id UUID REFERENCES achievements(id),
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);
```

## API Endpoints

### Authentication APIs

#### 1. Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
    "username": "player123",
    "email": "player@example.com",
    "password": "securePassword123",
    "display_name": "Player One"
}

Response:
{
    "user": {
        "id": "uuid",
        "username": "player123",
        "display_name": "Player One"
    },
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
}
```

#### 2. Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
    "username": "player123", // or email
    "password": "securePassword123"
}

Response:
{
    "user": { ... },
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
}
```

#### 3. Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
    "refresh_token": "refresh_token"
}
```

#### 4. Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer {access_token}
```

### Game Management APIs

#### 1. Register Game (Admin)
```http
POST /api/v1/games
Authorization: Bearer {admin_token}

{
    "game_key": "cursorvivors",
    "name": "CursorVivors",
    "description": "Survive with your cursor",
    "play_url": "https://avoidgame.io/cursorvivors"
}
```

#### 2. List All Games
```http
GET /api/v1/games

Response:
{
    "games": [
        {
            "id": "uuid",
            "game_key": "wreckavoid",
            "name": "WreckaVOID",
            "player_count": 1523,
            "high_score": 95000
        }
    ]
}
```

### Leaderboard APIs

#### 1. Submit Score
```http
POST /api/v1/scores
Authorization: Bearer {access_token}

{
    "game_key": "wreckavoid",
    "leaderboard_key": "high_score",
    "score": 85000,
    "metadata": {
        "level": 15,
        "time_played": 360,
        "power_ups": ["triple_shot", "shield"]
    }
}

Response:
{
    "rank": 42,
    "percentile": 95.2,
    "personal_best": 85000,
    "leaderboard_position": {
        "global": 42,
        "country": 5,
        "friends": 2
    }
}
```

#### 2. Get Leaderboard
```http
GET /api/v1/leaderboards/{game_key}/{leaderboard_key}?
    scope=global|country|friends&
    timeframe=all|daily|weekly|monthly&
    offset=0&
    limit=100

Response:
{
    "leaderboard": {
        "game": "WreckaVOID",
        "type": "high_score",
        "timeframe": "all"
    },
    "entries": [
        {
            "rank": 1,
            "user": {
                "username": "destroyer99",
                "display_name": "The Destroyer",
                "country_code": "US"
            },
            "score": 127500,
            "achieved_at": "2025-07-01T10:30:00Z"
        }
    ],
    "user_position": {
        "rank": 42,
        "score": 85000
    }
}
```

#### 3. Get Personal Stats
```http
GET /api/v1/users/{user_id}/stats?game_key=wreckavoid

Response:
{
    "user": { ... },
    "stats": {
        "wreckavoid": {
            "games_played": 156,
            "total_score": 4850000,
            "high_score": 85000,
            "average_score": 31089,
            "global_rank": 42,
            "achievements_unlocked": 12
        }
    }
}
```

### WebSocket Real-time APIs

```javascript
// Connect to WebSocket
ws://api.avoidgame.io/v1/live

// Subscribe to leaderboard updates
{
    "action": "subscribe",
    "channel": "leaderboard",
    "game_key": "wreckavoid",
    "leaderboard_key": "high_score"
}

// Receive updates
{
    "type": "leaderboard_update",
    "data": {
        "new_top_score": {
            "rank": 1,
            "user": "destroyer99",
            "score": 128000
        }
    }
}
```

## SDK Implementation

### JavaScript/TypeScript SDK

```typescript
// aVOID Games SDK
class AvoidGamesSDK {
    private apiKey: string;
    private baseUrl: string;
    private ws: WebSocket;
    
    constructor(config: SDKConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.avoidgame.io/v1';
    }
    
    // Authentication
    async login(username: string, password: string): Promise<User> {}
    async register(userData: RegisterData): Promise<User> {}
    async logout(): Promise<void> {}
    
    // Scores
    async submitScore(gameKey: string, score: number, metadata?: any): Promise<ScoreResult> {}
    async getLeaderboard(gameKey: string, options?: LeaderboardOptions): Promise<Leaderboard> {}
    
    // Real-time
    subscribeToLeaderboard(gameKey: string, callback: (data: any) => void): void {}
    
    // User stats
    async getUserStats(userId?: string): Promise<UserStats> {}
}

// Usage in games
const sdk = new AvoidGamesSDK({ 
    apiKey: 'game_specific_key' 
});

// In game code
async function gameOver(score) {
    const result = await sdk.submitScore('wreckavoid', score, {
        level: currentLevel,
        time: playTime
    });
    
    showRankPopup(result.rank, result.percentile);
}
```

## Security Measures

### API Security
1. **Rate Limiting**
   - 100 requests/minute per IP
   - 1000 requests/hour per user
   - Score submissions: 1 per 10 seconds

2. **Score Validation**
   - Server-side validation rules per game
   - Anomaly detection (impossible scores)
   - Replay data for top scores

3. **Authentication**
   - JWT with 15-minute expiry
   - Refresh tokens with 30-day expiry
   - Device fingerprinting

### Anti-Cheat System

```javascript
// Score validation rules
const validationRules = {
    wreckavoid: {
        max_score_per_minute: 10000,
        max_total_score: 500000,
        required_metadata: ['level', 'time_played'],
        validation_function: (score, metadata) => {
            // Custom validation logic
            return score <= metadata.level * 10000;
        }
    }
};
```

## Admin Dashboard Features

### Core Functionality
1. **Game Management**
   - Add/edit/disable games
   - Configure leaderboards
   - Set validation rules

2. **User Management**
   - View user profiles
   - Ban/unban users
   - Reset passwords

3. **Analytics**
   - Active players per game
   - Score distribution
   - Retention metrics
   - Revenue tracking

4. **Moderation**
   - Flag suspicious scores
   - Review reported users
   - Bulk actions

## Integration Guide for New Games

### 1. Quick Start
```html
<!-- Include SDK -->
<script src="https://cdn.avoidgame.io/sdk/v1/avoid-games.min.js"></script>

<script>
// Initialize
const AvoidGames = new AvoidGamesSDK({
    apiKey: 'YOUR_GAME_KEY'
});

// Submit score
async function submitGameScore(score) {
    try {
        const result = await AvoidGames.submitScore('your-game-key', score);
        console.log(`You ranked #${result.rank}!`);
    } catch (error) {
        console.error('Failed to submit score:', error);
    }
}
</script>
```

### 2. Advanced Integration
```javascript
// Full integration example
class GameIntegration {
    constructor() {
        this.sdk = new AvoidGamesSDK({
            apiKey: process.env.AVOID_API_KEY
        });
        
        this.initializeUser();
        this.setupRealtimeUpdates();
    }
    
    async initializeUser() {
        // Check if user is logged in
        const user = await this.sdk.getCurrentUser();
        if (!user) {
            // Show login prompt
            this.showLoginUI();
        }
    }
    
    setupRealtimeUpdates() {
        // Subscribe to live leaderboard updates
        this.sdk.subscribeToLeaderboard('your-game', (update) => {
            this.updateLeaderboardUI(update);
        });
    }
    
    async handleGameOver(finalScore, gameStats) {
        // Submit comprehensive game data
        const result = await this.sdk.submitScore('your-game', finalScore, {
            level: gameStats.level,
            enemies_destroyed: gameStats.enemies,
            power_ups_collected: gameStats.powerUps,
            play_duration: gameStats.duration,
            replay_data: this.compressReplay(gameStats.replay)
        });
        
        // Show results
        this.showGameOverScreen(result);
    }
}
```

## Deployment Strategy

### Phase 1: MVP (Week 1-2)
- Basic auth system
- Score submission API
- Simple leaderboards
- Integration with existing 3 games

### Phase 2: Enhanced Features (Week 3-4)
- Real-time updates
- Country/friend leaderboards
- Admin dashboard
- Anti-cheat measures

### Phase 3: Scale & Polish (Week 5-6)
- Achievement system
- Social features
- Advanced analytics
- Mobile SDKs

## Performance Targets

- API Response Time: <100ms (p95)
- Score Submission: <200ms
- Leaderboard Load: <150ms
- Concurrent Users: 10,000+
- Uptime: 99.9%

## Cost Estimation (Monthly)

- **Hosting**: $200-500 (depending on scale)
- **Database**: $100-300
- **CDN**: $50-100
- **Monitoring**: $50
- **Total**: ~$400-1000/month

This unified backend will enable rapid game development while maintaining consistent user experience across all aVOID games!