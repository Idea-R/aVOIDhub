# WreckAVOID 🎯

A physics-based wrecking ball survival game where you swing your way to victory! Part of the **aVOIDgame.io** gaming hub.

## 🎮 Game Overview

Master the art of destruction in this intense survival game featuring:
- **Realistic Physics**: Authentic chain and ball physics with momentum and tension
- **Global Leaderboards**: Compete against players worldwide 
- **Endless Survival**: Face increasingly challenging waves of enemies
- **User Profiles**: Create your gaming profile with social links
- **Power-Up System**: Permanent and temporary upgrades

## 🚀 Live Game

Play now at: **[aVOIDgame.io/wreckavoid](https://aVOIDgame.io/wreckavoid)**

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Idea-R/wreckAVOID.git
   cd wreckAVOID
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   - Copy `.env.example` to `.env`
   - Add your Supabase credentials:
     ```env
     VITE_SUPABASE_URL=your-supabase-url
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```

4. **Run development server**
   ```bash
   npm run dev
   ```

## 🎯 How to Play

### Controls
- **Mouse**: Move to aim the wrecking ball
- **Hold Click**: Retract the chain to build momentum  
- **Space**: Pause game
- **ESC**: Return to menu

### Strategy
- Swing the ball to destroy enemies
- Chain can damage basic enemies on contact
- Collect power-ups to enhance your abilities
- Survive as long as possible to climb the leaderboard

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Email + Google OAuth)
- **Game Engine**: Custom HTML5 Canvas with physics simulation

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── Auth/           # Authentication forms
│   ├── Game/           # Game-specific UI
│   ├── Leaderboard/    # Leaderboard components  
│   └── Profile/        # User profile management
├── game/               # Core game engine
├── hooks/              # React hooks for data fetching
├── lib/                # Utilities and Supabase config
├── pages/              # Main application pages
└── types/              # TypeScript type definitions
```

## 🚀 Deployment

### Production Build
```bash
npm run build:prod
```

### Deploy to aVOIDgame.io
The project is configured for deployment at `aVOIDgame.io/wreckavoid` with:
- Optimized asset bundling
- Proper base path configuration
- Production environment variables

## 🎮 aVOIDgame.io Hub

WreckAVOID is part of the larger **aVOIDgame.io** gaming platform featuring multiple games. The hub provides:
- Unified user accounts across all games
- Cross-game leaderboards and achievements
- Centralized profile management
- Social features and community

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is part of the aVOIDgame.io platform.

---

**Ready to wreck some havoc?** [Play now at aVOIDgame.io/wreckavoid!](https://aVOIDgame.io/wreckavoid)
