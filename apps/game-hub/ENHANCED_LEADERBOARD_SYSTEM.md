# Enhanced Global Leaderboard System

## Overview

The Enhanced Global Leaderboard System provides comprehensive leaderboard functionality for the aVOID game hub, supporting multiple games with real-time statistics, user rankings, and advanced features.

## Features

### Core Functionality
- ✅ **Global Leaderboards**: Cross-game rankings aggregating scores from all games
- ✅ **Game-Specific Leaderboards**: Individual rankings for each game
- ✅ **Real-time Updates**: Live leaderboard updates via Supabase subscriptions
- ✅ **User Statistics**: Detailed per-user game statistics and rankings
- ✅ **Game Analytics**: Comprehensive game performance metrics
- ✅ **Pro Member Features**: Enhanced rankings and social links for pro users

### Advanced Features
- ✅ **Automated Triggers**: Database triggers automatically update statistics on score submission
- ✅ **Ranking Calculation**: Dynamic rank positioning with tie-breaking logic
- ✅ **Performance Optimization**: Indexed queries and cached statistics
- ✅ **Fallback Support**: Graceful degradation when stored procedures aren't available
- ✅ **Social Integration**: Social media links and profile customization for pro members

## Database Schema

### New Tables

#### `user_game_stats`
Tracks individual user statistics per game:
```sql
- user_id: UUID (references auth.users)
- game_key: TEXT (game identifier)
- total_score: BIGINT (cumulative score across all plays)
- best_score: BIGINT (highest single score)
- games_played: INTEGER (number of times played)
- total_time_played: INTEGER (seconds spent playing)
- last_played_at: TIMESTAMP
- achievements: JSONB (game-specific achievements)
- metadata: JSONB (additional game data)
```

#### `global_user_stats`
Aggregated statistics across all games:
```sql
- user_id: UUID (primary key)
- total_score: BIGINT (sum of all game scores)
- total_games_played: INTEGER (total plays across games)
- unique_games_played: INTEGER (number of different games played)
- best_single_score: BIGINT (highest score across all games)
- best_game_key: TEXT (game where best score was achieved)
- average_score: DECIMAL (calculated average)
- rank_position: INTEGER (global ranking position)
- last_score_update: TIMESTAMP
```

#### `game_statistics`
Game-level analytics and metrics:
```sql
- game_key: TEXT (primary key)
- total_players: INTEGER (unique players)
- total_games_played: INTEGER (total sessions)
- total_scores_submitted: INTEGER (total score submissions)
- highest_score: BIGINT (game record)
- average_score: DECIMAL (calculated average)
- featured_priority: INTEGER (for featuring games)
- last_activity: TIMESTAMP (most recent play)
```

#### `leaderboard_periods`
Support for seasonal/temporary leaderboards:
```sql
- id: UUID (primary key)
- period_type: TEXT (daily, weekly, monthly, yearly, all_time)
- game_key: TEXT (optional - for game-specific periods)
- start_date: TIMESTAMP
- end_date: TIMESTAMP
- is_active: BOOLEAN
```

### Database Functions

#### `update_user_game_stats()`
Trigger function that automatically updates statistics when scores are submitted.

#### `update_global_rankings()`
Recalculates global ranking positions based on total scores.

#### `get_global_leaderboard(p_limit, p_offset, p_pro_only)`
Returns global leaderboard with enhanced user data.

#### `get_game_leaderboard(p_game_key, p_limit, p_offset)`
Returns game-specific leaderboard with user statistics.

#### `get_user_rankings(p_user_id)`
Returns user's ranking position across all games with percentiles.

## API Services

### EnhancedLeaderboardService

#### Core Methods

**`submitScore(gameKey, score, metadata?)`**
- Submits a new score and triggers all stat updates
- Returns: `{ success: boolean, error?: string, data?: any }`

**`getGlobalLeaderboard(proOnly?, limit?, offset?)`**
- Fetches global leaderboard with enhanced user data
- Supports pro-only filtering
- Returns: `{ success: boolean, error?: string, data: GlobalUserStats[] }`

**`getGameLeaderboard(gameKey, limit?, offset?)`**
- Fetches game-specific leaderboard
- Returns: `{ success: boolean, error?: string, data: EnhancedLeaderboardEntry[] }`

**`getUserRankings(userId?)`**
- Gets user's rankings across all games
- Returns: `{ success: boolean, error?: string, data: UserRanking[] }`

**`getGameStatistics()`**
- Retrieves comprehensive game analytics
- Returns: `{ success: boolean, error?: string, data: GameStats[] }`

#### Real-time Features

**`subscribeToLeaderboardChanges(gameKey, callback)`**
- Subscribe to real-time leaderboard updates for a specific game

**`subscribeToGlobalChanges(callback)`**
- Subscribe to global leaderboard changes

### Integration with UnifiedAuthService

The enhanced system integrates seamlessly with the existing `UnifiedAuthService`:
- `saveLeaderboardScore()` now uses the enhanced service
- `getLeaderboard()` returns enhanced data with backward compatibility
- `getGlobalLeaderboard()` delegates to the enhanced service

## UI Components

### LeaderboardDashboard
Comprehensive dashboard showing:
- Global statistics overview
- User personal performance (when authenticated)
- Game-specific metrics
- Tabbed interface for global vs game leaderboards

### EnhancedLeaderboard
Updated leaderboard component featuring:
- Rich user profiles with avatars and social links
- Pro member badges and features
- Ranking badges (Champion, Elite, Expert, etc.)
- Real-time updates
- Responsive design

## Performance Optimizations

### Database Indexes
```sql
- idx_user_game_stats_user_game: (user_id, game_key)
- idx_user_game_stats_game_score: (game_key, best_score DESC)
- idx_global_user_stats_score: (total_score DESC)
- idx_global_user_stats_rank: (rank_position)
- idx_leaderboard_scores_game_score: (game_key, score DESC)
- idx_leaderboard_scores_user_time: (user_id, created_at DESC)
```

### Caching Strategy
- Statistics tables cache computed values
- Triggers update caches automatically
- Fallback queries ensure availability

## Security

### Row Level Security (RLS)
- Public read access to statistics tables
- Users can only update their own statistics
- Pro member features properly gated

### Data Validation
- Score validation in application layer
- Metadata sanitization
- Rate limiting on score submissions

## Migration

### Database Migration
Run the migration file: `20250705173200_enhanced_leaderboard_system.sql`

This migration:
1. Creates all new tables with proper indexes
2. Sets up triggers and functions
3. Initializes data from existing leaderboard_scores
4. Updates RLS policies
5. Calculates initial global rankings

### Backward Compatibility
- Existing `leaderboard_scores` table remains unchanged
- Legacy API methods continue to work
- Gradual migration path for existing data

## Usage Examples

### Submit a Score
```typescript
import { enhancedLeaderboardService } from './services/EnhancedLeaderboardService'

const result = await enhancedLeaderboardService.submitScore('voidavoid', 15420, {
  meteors_destroyed: 127,
  survival_time: 180,
  difficulty: 'hard'
})

if (result.success) {
  console.log('Score submitted successfully!')
}
```

### Get Global Leaderboard
```typescript
const result = await enhancedLeaderboardService.getGlobalLeaderboard(false, 50, 0)

if (result.success) {
  result.data.forEach(entry => {
    console.log(`${entry.rank_position}. ${entry.display_name}: ${entry.total_score}`)
  })
}
```

### Subscribe to Real-time Updates
```typescript
const subscription = enhancedLeaderboardService.subscribeToLeaderboardChanges(
  'voidavoid',
  (payload) => {
    console.log('Leaderboard updated:', payload)
    // Refresh leaderboard display
  }
)

// Cleanup
subscription?.unsubscribe()
```

### Display User Rankings
```typescript
const UserRankings = () => {
  const [rankings, setRankings] = useState([])
  
  useEffect(() => {
    const loadRankings = async () => {
      const result = await enhancedLeaderboardService.getUserRankings()
      if (result.success) {
        setRankings(result.data)
      }
    }
    loadRankings()
  }, [])
  
  return (
    <div>
      {rankings.map(ranking => (
        <div key={ranking.game_key}>
          <h3>{ranking.game_key}</h3>
          <p>Rank: #{ranking.rank_position} ({ranking.percentile}%)</p>
          <p>Best Score: {ranking.best_score}</p>
        </div>
      ))}
    </div>
  )
}
```

## Monitoring and Analytics

### Game Performance Metrics
- Player engagement by game
- Score distributions and averages
- Activity trends over time
- Feature adoption rates

### User Engagement
- Cross-game play patterns
- Pro member conversion tracking
- Social feature usage
- Retention metrics

## Future Enhancements

### Planned Features
- [ ] Seasonal leaderboards
- [ ] Achievement system integration
- [ ] Tournament modes
- [ ] Spectator features
- [ ] Advanced analytics dashboard
- [ ] Export functionality
- [ ] Mobile optimizations

### Performance Improvements
- [ ] Redis caching layer
- [ ] GraphQL API optimization
- [ ] Background job processing
- [ ] CDN integration for static assets

## Support and Troubleshooting

### Common Issues

**Q: Leaderboard not updating after score submission**
A: Check that the trigger `trigger_update_user_game_stats` is properly installed and the user has necessary permissions.

**Q: Global leaderboard showing empty results**
A: Ensure the stored procedure `get_global_leaderboard` exists. The service includes fallback queries if procedures are unavailable.

**Q: Performance issues with large leaderboards**
A: Verify that all indexes are created. Consider reducing the limit parameter for large datasets.

### Debug Mode
Enable detailed logging by setting `VITE_DEBUG_LEADERBOARD=true` in your environment variables.

### Database Health Check
```sql
-- Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_update_user_game_stats';

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'get_global_leaderboard';

-- Verify data consistency
SELECT COUNT(*) FROM global_user_stats;
SELECT COUNT(*) FROM user_game_stats;
SELECT COUNT(*) FROM game_statistics;
```

## Contributing

When contributing to the leaderboard system:

1. **Database Changes**: Always create migrations for schema changes
2. **API Changes**: Maintain backward compatibility when possible
3. **Testing**: Test with both small and large datasets
4. **Performance**: Consider impact on database performance
5. **Documentation**: Update this documentation for new features

## License

This enhanced leaderboard system is part of the aVOID game hub project.
