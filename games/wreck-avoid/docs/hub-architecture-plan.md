# aVOIDgame.io Hub Architecture Plan

## Executive Summary

Transform the current WreckaVOID project into a unified multi-game hub following the comprehensive PRD specifications while maintaining existing functionality and structure.

## Hub Architecture Strategy

### Routing Structure
```
/ (Hub Root)
├── /wreckavoid (Current WreckaVOID game)
├── /voidavoid (Future VOIDaVOID galaxy game)  
├── /leaderboards (Global leaderboards)
├── /profile (User profiles)
├── /tournaments (Future tournaments)
└── /developers (Future developer portal)
```

### Directory Structure Plan

```
src/
├── hub/                    # Hub-specific components
│   ├── components/
│   │   ├── HubHeader.tsx          # Global navigation header
│   │   ├── GameGrid.tsx           # Game selection grid
│   │   ├── FeaturedGames.tsx      # Featured games section
│   │   ├── GlobalLeaderboard.tsx  # Cross-game leaderboards
│   │   └── UserDashboard.tsx      # User dashboard widget
│   ├── pages/
│   │   ├── HubHomePage.tsx        # Main hub landing page
│   │   ├── HubLeaderboardPage.tsx # Global leaderboards page
│   │   └── HubProfilePage.tsx     # Enhanced profile page
│   └── hooks/
│       ├── useGlobalStats.ts      # Cross-game statistics
│       └── useHubNavigation.ts    # Hub navigation logic
├── games/                  # Game-specific modules
│   ├── wreckavoid/        # Current WreckaVOID game
│   │   ├── components/    # Move current components here
│   │   ├── pages/         # Move current pages here  
│   │   ├── game/          # Keep existing game logic
│   │   └── hooks/         # Keep existing hooks
│   └── shared/            # Shared game components
│       ├── GameOverlay.tsx     # Consistent game UI overlay
│       ├── GameAuth.tsx        # In-game authentication
│       └── GameHUD.tsx         # Standard game HUD elements
├── shared/                # Shared across hub and games
│   ├── components/
│   │   ├── auth/          # Enhanced auth components
│   │   ├── ui/            # Reusable UI components  
│   │   └── layout/        # Layout components
│   ├── hooks/
│   │   ├── useAuth.ts     # Enhanced auth hook
│   │   ├── useProfile.ts  # Enhanced profile hook
│   │   └── useSDK.ts      # aVOID Games SDK hook
│   └── types/
│       ├── Hub.ts         # Hub-specific types
│       └── SDK.ts         # SDK types
├── lib/
│   ├── supabase.ts        # Enhanced Supabase client
│   ├── avoid-sdk.ts       # aVOID Games SDK implementation
│   └── routing.ts         # Hub routing configuration
└── App.tsx                # Root app with React Router
```

## Implementation Phases

### Phase 1: Foundation (Current Sprint)
1. ✅ Install and configure React Router DOM
2. ✅ Create hub directory structure  
3. ✅ Refactor HomePage (320 lines → components <200 lines each)
4. ✅ Implement basic hub routing

### Phase 2: Hub Core Features
1. Create HubHomePage with game grid
2. Implement aVOID Games SDK
3. Create shared authentication components
4. Build global leaderboard system

### Phase 3: Game Integration
1. Move WreckaVOID to `/wreckavoid` route
2. Implement game overlay system
3. Integrate SDK with existing game
4. Create consistent user experience

### Phase 4: Advanced Features  
1. Prepare VOIDaVOID integration structure
2. Implement tournament system foundation
3. Add developer portal framework
4. Optimize performance and deployment

## Technical Specifications

### Routing Configuration
- **React Router DOM v6**: Hash-based routing for subdirectory compatibility
- **Lazy Loading**: Code splitting for each game module
- **Protected Routes**: Authentication-required pages
- **Fallback Routes**: 404 handling and game redirects

### State Management
- **React Context**: Hub-level state (user, games, navigation)
- **Local State**: Component-specific state
- **Supabase Realtime**: Live updates for leaderboards and social features

### Performance Considerations
- **Code Splitting**: Each game loads independently
- **Shared Dependencies**: Common libraries bundled separately  
- **Asset Optimization**: Game-specific assets in subdirectories
- **Caching**: Static assets and API responses

## File Size Compliance (PHILOSOPHY #1)

All files must be ≤500 lines:
- **Current HomePage**: 320 lines → Split into 4 components (~80 lines each)
- **Hub Components**: Max 200 lines per component
- **Game Modules**: Existing refactored structure maintained
- **Automatic Monitoring**: Pre-commit hooks for line count validation

## Next Steps

1. **Immediate**: Implement React Router and basic hub structure
2. **Short-term**: Create hub homepage and SDK integration  
3. **Medium-term**: Complete WreckaVOID integration and testing
4. **Long-term**: VOIDaVOID integration and platform expansion

## Success Criteria

- ✅ All files under 500 lines
- ✅ Clean separation of concerns
- ✅ Consistent user experience across games
- ✅ Scalable architecture for future games
- ✅ Production-ready deployment configuration 