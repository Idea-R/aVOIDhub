# aVOID Project - High Level Overview

## Project Description
aVOID is a modern React-based game application built with TypeScript and Vite. It's a meteor-dodging game with a futuristic cyberpunk aesthetic featuring a leaderboard system powered by Supabase.

## Technology Stack
- **Frontend Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.2
- **Styling**: Tailwind CSS 3.4.1
- **State Management**: Zustand 4.5.2
- **Backend/Database**: Supabase 2.39.7
- **Audio**: Howler.js 2.2.4
- **Icons**: Lucide React 0.344.0

## Project Structure

### Root Directory
```
aVOID/
├── src/                    # Source code directory
├── supabase/              # Supabase configuration
├── .bolt/                 # Build configuration
├── package.json           # Project dependencies and scripts
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.*.json        # TypeScript configurations
└── README.md              # Project documentation
```

### Source Code Organization
```
src/
├── components/            # React UI components
├── game/                  # Game engine and logic
├── store/                 # State management
├── api/                   # API integration
├── lib/                   # External library configurations
├── assets/               # Static assets (images, audio)
└── utils/                # Utility functions
```

## Key Components

### Core Application Files
- `App.tsx` - Main application component with game state management
- `main.tsx` - Application entry point
- `index.css` - Global styles and Tailwind imports

### Game Components (components/)
- `Game.tsx` - Main game component
- `StartScreen.tsx` - Initial game screen
- `GameOverScreen.tsx` - End game screen with results
- `HUD.tsx` - Heads-up display during gameplay
- `LeaderboardModal.tsx` - Leaderboard display
- `SettingsModal.tsx` - Game settings configuration
- `AccountModal.tsx` - User account management
- `SignupModal.tsx` - User registration

### Game Engine (game/)
- `Engine.ts` - Core game engine (24KB - substantial game logic)
- `Renderer.ts` - Game rendering system
- `entities/` - Game objects (Player, Meteor, Particle)
- `physics/` - Collision detection and physics
- `utils/` - Game utilities (ObjectPool, SpatialGrid)
- `audio/` - Audio management system

### State Management (store/)
- `authStore.ts` - Authentication state management
- `gameStore.ts` - Game state management

### API Integration (api/)
- `leaderboard.ts` - Leaderboard API functions

## Key Features
1. **Meteor Dodging Gameplay** - Core game mechanics
2. **User Authentication** - Account creation and login
3. **Leaderboard System** - Score tracking and competition
4. **Audio Integration** - Sound effects and music
5. **Responsive Design** - Tailwind CSS styling
6. **Real-time Database** - Supabase integration

## Development Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## File Size Analysis
- Main game engine: 24KB (Engine.ts)
- Game over screen: 13KB (GameOverScreen.tsx)
- Settings modal: 15KB (SettingsModal.tsx)
- Signup modal: 11KB (SignupModal.tsx)
- Large asset: 1.5MB (game background image)

## Next Steps for Development
1. Review game engine implementation for optimization opportunities
2. Examine empty files that need implementation
3. Test game functionality and mechanics
4. Review code for compliance with 500-line rule
5. Assess performance and optimization needs 