// server.ts - Main Express server for aVOID Games Backend
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { createServer } from 'http';

// Environment configuration
const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET is required') })(),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || (() => { throw new Error('JWT_REFRESH_SECRET is required') })(),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/avoidgames',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

// Database connection
const db = new Pool({
  connectionString: config.databaseUrl,
});

// Redis connection
const redis = new Redis(config.redisUrl);

// Express app
const app = express();
const server = createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts'
});

const scoreLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 1, // 1 score submission per 10 seconds
  message: 'Score submission rate limit exceeded'
});

// Types
interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  country_code?: string;
}

interface Game {
  id: string;
  game_key: string;
  name: string;
  description?: string;
  icon_url?: string;
  banner_url?: string;
  play_url?: string;
}

interface Score {
  id: string;
  user_id: string;
  game_id: string;
  leaderboard_id: string;
  score: number;
  metadata?: any;
  achieved_at: Date;
}

// JWT middleware
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    req.user = payload;
    
    // Check if user is banned
    const userCheck = await db.query(
      'SELECT is_banned FROM users WHERE id = $1',
      [payload.userId]
    );
    
    if (userCheck.rows[0]?.is_banned) {
      return res.status(403).json({ error: 'Account banned' });
    }
    
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Admin middleware
const authenticateAdmin = async (req: any, res: any, next: any) => {
  // Implement admin authentication logic
  // For now, check if user has admin role
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Helper functions
const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    config.jwtSecret,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: '30d' }
  );
  
  return { accessToken, refreshToken };
};

const validateScore = async (gameKey: string, score: number, metadata: any): Promise<boolean> => {
  // Implement game-specific validation rules
  const validationRules: any = {
    wreckavoid: {
      maxScore: 500000,
      maxScorePerMinute: 10000,
      requiredMetadata: ['level', 'time_played']
    },
    tankavoid: {
      maxScore: 1000000,
      maxScorePerMinute: 15000,
      requiredMetadata: ['waves_survived', 'enemies_destroyed']
    },
    voidavoid: {
      maxScore: 300000,
      maxScorePerMinute: 8000,
      requiredMetadata: ['distance', 'obstacles_avoided']
    }
  };
  
  const rules = validationRules[gameKey];
  if (!rules) return true; // No rules defined, allow
  
  if (score > rules.maxScore) return false;
  
  if (metadata?.time_played) {
    const scorePerMinute = score / (metadata.time_played / 60);
    if (scorePerMinute > rules.maxScorePerMinute) return false;
  }
  
  // Check required metadata
  for (const field of rules.requiredMetadata || []) {
    if (!metadata?.[field]) return false;
  }
  
  return true;
};

// Authentication endpoints
app.post('/api/v1/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password, display_name } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const userId = uuidv4();
    const result = await db.query(
      `INSERT INTO users (id, username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, display_name`,
      [userId, username, email, passwordHash, display_name || username]
    );
    
    const user = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(userId);
    
    // Store refresh token
    await db.query(
      `INSERT INTO sessions (id, user_id, refresh_token, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
      [uuidv4(), userId, refreshToken]
    );
    
    res.status(201).json({
      user,
      access_token: accessToken,
      refresh_token: refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/v1/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username or email
    const result = await db.query(
      `SELECT id, username, email, password_hash, display_name, is_banned
       FROM users
       WHERE username = $1 OR email = $1`,
      [username]
    );
    
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.is_banned) {
      return res.status(403).json({ error: 'Account banned' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Store refresh token
    await db.query(
      `INSERT INTO sessions (id, user_id, refresh_token, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
      [uuidv4(), user.id, refreshToken]
    );
    
    // Clean up user object
    delete user.password_hash;
    delete user.is_banned;
    
    res.json({
      user,
      access_token: accessToken,
      refresh_token: refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/v1/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    // Verify refresh token
    const payload = jwt.verify(refresh_token, config.jwtRefreshSecret) as any;
    
    // Check if session exists and is valid
    const session = await db.query(
      'SELECT user_id FROM sessions WHERE refresh_token = $1 AND expires_at > NOW()',
      [refresh_token]
    );
    
    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload.userId);
    
    // Update refresh token
    await db.query(
      'UPDATE sessions SET refresh_token = $1, expires_at = NOW() + INTERVAL \'30 days\' WHERE refresh_token = $2',
      [newRefreshToken, refresh_token]
    );
    
    res.json({
      access_token: accessToken,
      refresh_token: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

app.post('/api/v1/auth/logout', authenticateToken, async (req: any, res) => {
  try {
    // Remove all sessions for this user
    await db.query('DELETE FROM sessions WHERE user_id = $1', [req.user.userId]);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Game management endpoints
app.get('/api/v1/games', async (req, res) => {
  try {
    const games = await db.query(
      `SELECT g.*, COUNT(DISTINCT s.user_id) as player_count
       FROM games g
       LEFT JOIN scores s ON g.id = s.game_id
       WHERE g.is_active = true
       GROUP BY g.id
       ORDER BY player_count DESC`
    );
    
    res.json({ games: games.rows });
  } catch (error) {
    console.error('Games fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.post('/api/v1/games', authenticateToken, authenticateAdmin, async (req: any, res) => {
  try {
    const { game_key, name, description, icon_url, banner_url, play_url } = req.body;
    
    const gameId = uuidv4();
    const result = await db.query(
      `INSERT INTO games (id, game_key, name, description, icon_url, banner_url, play_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [gameId, game_key, name, description, icon_url, banner_url, play_url]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Game creation error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Score submission
app.post('/api/v1/scores', authenticateToken, scoreLimiter, async (req: any, res) => {
  try {
    const { game_key, leaderboard_key, score, metadata } = req.body;
    const userId = req.user.userId;
    
    // Validate score
    const isValid = await validateScore(game_key, score, metadata);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid score submission' });
    }
    
    // Get game and leaderboard
    const gameResult = await db.query('SELECT id FROM games WHERE game_key = $1', [game_key]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const gameId = gameResult.rows[0].id;
    
    const leaderboardResult = await db.query(
      'SELECT id FROM leaderboards WHERE game_id = $1 AND leaderboard_key = $2',
      [gameId, leaderboard_key]
    );
    
    let leaderboardId;
    if (leaderboardResult.rows.length === 0) {
      // Create default leaderboard if it doesn't exist
      const newLeaderboard = await db.query(
        `INSERT INTO leaderboards (id, game_id, leaderboard_key, name, score_type, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [uuidv4(), gameId, leaderboard_key, 'High Score', 'numeric', 'DESC']
      );
      leaderboardId = newLeaderboard.rows[0].id;
    } else {
      leaderboardId = leaderboardResult.rows[0].id;
    }
    
    // Submit score
    const scoreId = uuidv4();
    await db.query(
      `INSERT INTO scores (id, user_id, game_id, leaderboard_id, score, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [scoreId, userId, gameId, leaderboardId, score, metadata]
    );
    
    // Calculate rank
    const rankResult = await db.query(
      `SELECT COUNT(*) + 1 as rank
       FROM scores
       WHERE leaderboard_id = $1 AND score > $2`,
      [leaderboardId, score]
    );
    
    const rank = parseInt(rankResult.rows[0].rank);
    
    // Calculate percentile
    const totalPlayers = await db.query(
      'SELECT COUNT(DISTINCT user_id) as total FROM scores WHERE leaderboard_id = $1',
      [leaderboardId]
    );
    
    const percentile = ((totalPlayers.rows[0].total - rank) / totalPlayers.rows[0].total) * 100;
    
    // Get personal best
    const personalBest = await db.query(
      'SELECT MAX(score) as best FROM scores WHERE user_id = $1 AND leaderboard_id = $2',
      [userId, leaderboardId]
    );
    
    // Broadcast to WebSocket clients
    broadcastLeaderboardUpdate(game_key, leaderboard_key, {
      user_id: userId,
      score,
      rank
    });
    
    res.json({
      rank,
      percentile: Math.round(percentile * 10) / 10,
      personal_best: personalBest.rows[0].best,
      leaderboard_position: {
        global: rank,
        country: rank, // TODO: Implement country ranking
        friends: rank  // TODO: Implement friends ranking
      }
    });
  } catch (error) {
    console.error('Score submission error:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// Get leaderboard
app.get('/api/v1/leaderboards/:game_key/:leaderboard_key', async (req, res) => {
  try {
    const { game_key, leaderboard_key } = req.params;
    const { scope = 'global', timeframe = 'all', offset = 0, limit = 100 } = req.query;
    
    // Get game and leaderboard
    const gameResult = await db.query('SELECT id, name FROM games WHERE game_key = $1', [game_key]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const game = gameResult.rows[0];
    
    const leaderboardResult = await db.query(
      'SELECT id, name FROM leaderboards WHERE game_id = $1 AND leaderboard_key = $2',
      [game.id, leaderboard_key]
    );
    
    if (leaderboardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }
    
    const leaderboard = leaderboardResult.rows[0];
    
    // Build time filter
    let timeFilter = '';
    switch (timeframe) {
      case 'daily':
        timeFilter = 'AND s.achieved_at > NOW() - INTERVAL \'1 day\'';
        break;
      case 'weekly':
        timeFilter = 'AND s.achieved_at > NOW() - INTERVAL \'1 week\'';
        break;
      case 'monthly':
        timeFilter = 'AND s.achieved_at > NOW() - INTERVAL \'1 month\'';
        break;
    }
    
    // Get leaderboard entries
    const entries = await db.query(
      `SELECT 
         ROW_NUMBER() OVER (ORDER BY s.score DESC) as rank,
         u.username,
         u.display_name,
         u.country_code,
         u.avatar_url,
         s.score,
         s.achieved_at
       FROM scores s
       JOIN users u ON s.user_id = u.id
       WHERE s.leaderboard_id = $1 ${timeFilter}
       ORDER BY s.score DESC
       LIMIT $2 OFFSET $3`,
      [leaderboard.id, limit, offset]
    );
    
    // Get current user's position (if authenticated)
    let userPosition = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const payload = jwt.verify(token, config.jwtSecret) as any;
        
        const userRank = await db.query(
          `SELECT COUNT(*) + 1 as rank, MAX(s.score) as score
           FROM scores s
           WHERE s.leaderboard_id = $1 AND s.score > (
             SELECT MAX(score) FROM scores WHERE user_id = $2 AND leaderboard_id = $1
           )`,
          [leaderboard.id, payload.userId]
        );
        
        if (userRank.rows[0].score) {
          userPosition = {
            rank: parseInt(userRank.rows[0].rank),
            score: userRank.rows[0].score
          };
        }
      } catch (error) {
        // Ignore token errors for public leaderboard access
      }
    }
    
    res.json({
      leaderboard: {
        game: game.name,
        type: leaderboard.name,
        timeframe
      },
      entries: entries.rows,
      user_position: userPosition
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get user stats
app.get('/api/v1/users/:user_id/stats', async (req, res) => {
  try {
    const { user_id } = req.params;
    const { game_key } = req.query;
    
    // Get user
    const userResult = await db.query(
      'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
      [user_id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Build stats query
    let statsQuery = `
      SELECT 
        g.game_key,
        COUNT(DISTINCT s.id) as games_played,
        SUM(s.score) as total_score,
        MAX(s.score) as high_score,
        AVG(s.score) as average_score,
        COUNT(DISTINCT ua.achievement_id) as achievements_unlocked
      FROM games g
      LEFT JOIN scores s ON g.id = s.game_id AND s.user_id = $1
      LEFT JOIN achievements a ON g.id = a.game_id
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
    `;
    
    const queryParams = [user_id];
    
    if (game_key) {
      statsQuery += ' WHERE g.game_key = $2';
      queryParams.push(game_key);
    }
    
    statsQuery += ' GROUP BY g.game_key';
    
    const statsResult = await db.query(statsQuery, queryParams);
    
    // Format stats
    const stats: any = {};
    for (const row of statsResult.rows) {
      stats[row.game_key] = {
        games_played: parseInt(row.games_played),
        total_score: parseInt(row.total_score) || 0,
        high_score: parseInt(row.high_score) || 0,
        average_score: Math.round(parseInt(row.average_score) || 0),
        achievements_unlocked: parseInt(row.achievements_unlocked)
      };
    }
    
    res.json({
      user,
      stats
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// WebSocket handling
const wsClients = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws) => {
  let subscribedChannels = new Set<string>();
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.action === 'subscribe') {
        const channel = `${data.game_key}:${data.leaderboard_key}`;
        subscribedChannels.add(channel);
        
        if (!wsClients.has(channel)) {
          wsClients.set(channel, new Set());
        }
        wsClients.get(channel)!.add(ws);
        
        ws.send(JSON.stringify({
          type: 'subscribed',
          channel
        }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    // Remove from all subscribed channels
    subscribedChannels.forEach(channel => {
      wsClients.get(channel)?.delete(ws);
    });
  });
});

function broadcastLeaderboardUpdate(gameKey: string, leaderboardKey: string, data: any) {
  const channel = `${gameKey}:${leaderboardKey}`;
  const clients = wsClients.get(channel);
  
  if (clients) {
    const message = JSON.stringify({
      type: 'leaderboard_update',
      data
    });
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
server.listen(config.port, () => {
  console.log(`aVOID Games Backend running on port ${config.port}`);
});

export default app;