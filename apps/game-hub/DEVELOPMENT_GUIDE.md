# aVOID Games Development Guide

## 🚀 Quick Start - Launch All Games

### Option 1: Automated Script (Recommended)
From the aVOID root directory, run:
```powershell
.\dev-all.ps1
```

This will launch all games and the hub simultaneously on these ports:
- **Game Hub**: http://localhost:5173
- **VOIDaVOID**: http://localhost:5174  
- **TankaVOID**: http://localhost:5175
- **WreckaVOID**: http://localhost:5176
- **WORDaVOID**: http://localhost:5177

### Option 2: From Game Hub
```bash
cd apps/game-hub
npm run dev:all
```

### Option 3: Manual Launch (For individual games)
```bash
# Game Hub
cd apps/game-hub
npm run dev

# VOIDaVOID
cd games/void-avoid  
npm run dev

# TankaVOID
cd games/tanka-void
npm run dev

# WreckaVOID
cd games/wrecka-void
npm run dev

# WORDaVOID
cd games/word-avoid
npm run dev
```

## 🎮 How It Works

1. **Game Hub** (localhost:5173) serves as the central launcher
2. Each game runs on its own development server
3. The hub detects if games are running and provides:
   - ✅ **Server Status Checking** - Real-time server detection
   - 🚀 **Direct Launch Buttons** - When servers are running
   - 🔧 **Setup Instructions** - When servers are offline
   - 📊 **Leaderboard Integration** - Unified scoring across games

## 🔧 Troubleshooting

### Server Not Starting?
```bash
# Check if ports are in use
npm run dev:check-ports

# Kill processes on specific ports (if needed)
netstat -ano | findstr :5174
taskkill /PID <process_id> /F
```

### Dependencies Issues?
```bash
# Install all dependencies
cd apps/game-hub && npm install
cd ../../games/void-avoid && npm install
cd ../tanka-void && npm install
cd ../wrecka-void && npm install  
cd ../word-avoid && npm install
```

## 🌐 Port Configuration

| Service | Port | URL |
|---------|------|-----|
| Game Hub | 5173 | http://localhost:5173 |
| VOIDaVOID | 5174 | http://localhost:5174 |
| TankaVOID | 5175 | http://localhost:5175 |
| WreckaVOID | 5176 | http://localhost:5176 |
| WORDaVOID | 5177 | http://localhost:5177 |

## 🎯 Features

- **Unified Authentication** - Single sign-on across all games
- **Global Leaderboards** - Compare scores across different games  
- **Real-time Server Detection** - Hub automatically detects running games
- **Cross-game Profiles** - User stats and achievements across the platform
- **Pro Membership** - Premium features and benefits

## 🧪 Testing Flow

1. Launch all servers using `.\dev-all.ps1`
2. Open http://localhost:5173 in your browser
3. Navigate to individual games via the hub
4. Test authentication and score submission
5. Verify leaderboard integration works

The hub will automatically detect which games are running and enable their launch buttons accordingly!
