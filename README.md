# aVOID Games Monorepo

A unified development environment for all aVOID game projects using npm workspaces.

## 🏗️ Monorepo Structure

```
aVOID/
├── packages/           # Shared libraries and utilities
│   └── shared/         # Common game utilities, configs, and services
├── apps/              # Applications and platforms
│   └── game-hub/      # Main game platform and hub
├── games/             # Individual game projects
│   ├── void-main/     # Main aVOID game
│   ├── tanka-void/    # Tank warfare game
│   └── wrecka-void/   # Wrecking ball game
└── scripts/           # Build and deployment scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
# Install all dependencies for all workspaces
npm install

# Build all packages
npm run setup
```

## 🛠️ Development

### Run Individual Projects
```bash
# Start the main aVOID game
npm run workspace:void

# Start the game hub platform  
npm run workspace:hub

# Start TankaVOID
npm run workspace:tanka

# Start WreckaVOID
npm run workspace:wrecka
```

### Run All Projects
```bash
# Development mode for all workspaces
npm run dev

# Build all workspaces
npm run build

# Run tests (if available)
npm test

# Lint all code
npm run lint
```

### Working with Shared Package
The `@avoid/shared` package contains common utilities:

```typescript
// Import shared services
import { UnifiedAuthService } from '@avoid/shared/services';

// Import game utilities
import { GameLoop } from '@avoid/shared/game';

// Import configurations
import { supabaseConfig } from '@avoid/shared/config';
```

## 📁 Workspace Details

### `@avoid/shared` (packages/shared)
- **Purpose**: Shared utilities, services, and configurations
- **Exports**: Authentication, game loops, Supabase configs
- **Used by**: All games and apps

### `@avoid/game-hub` (apps/game-hub)  
- **Purpose**: Main platform and game launcher
- **Tech**: React, Vite, TypeScript, Tailwind CSS
- **Features**: Game selection, user management, shared services

### `@avoid/void-main` (games/void-main)
- **Purpose**: Main aVOID game
- **Tech**: React, Vite, TypeScript, Supabase
- **Features**: Core avoid gameplay

### `@avoid/tanka-void` (games/tanka-void)
- **Purpose**: Tank warfare variant
- **Tech**: React, Vite, TypeScript
- **Features**: Tank-based gameplay mechanics

### `@avoid/wrecka-void` (games/wrecka-void)
- **Purpose**: Wrecking ball variant  
- **Tech**: React, Vite, TypeScript, React Router
- **Features**: Physics-based wrecking gameplay

## 🔧 Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run setup` | Install dependencies and build all packages |
| `npm run build` | Build all workspaces |
| `npm run dev` | Start development servers for all workspaces |
| `npm run lint` | Lint all workspace code |
| `npm run clean` | Clean build artifacts from all workspaces |
| `npm run workspace:void` | Start only the main aVOID game |
| `npm run workspace:hub` | Start only the game hub |
| `npm run workspace:tanka` | Start only TankaVOID |
| `npm run workspace:wrecka` | Start only WreckaVOID |

## 🏗️ Adding New Games/Apps

1. Create new directory in `games/` or `apps/`
2. Add `package.json` with `@avoid/` scoped name
3. Set `"private": true`
4. Add standard scripts (`dev`, `build`, `lint`)
5. Root monorepo will automatically include it as workspace

## 📦 Shared Dependencies

Common dependencies are managed at the root level and shared across workspaces:
- TypeScript
- ESLint  
- Prettier
- React (for games)
- Vite (for bundling)

## 🚀 Deployment

Each workspace can be deployed independently:
- **Game Hub**: Primary platform deployment
- **Individual Games**: Can be deployed as standalone apps
- **Shared Package**: Internal use only, not published

## 🔗 Inter-Workspace Dependencies

Games and apps can depend on the shared package:

```json
{
  "dependencies": {
    "@avoid/shared": "workspace:*"
  }
}
```

---

Built with ❤️ by the aVOID Games team
