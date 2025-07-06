# Environment Setup Guide - Shared Configuration

## 🎯 **New Approach: Single Source of Truth**

Instead of duplicating Supabase keys across multiple files, we now use a **shared configuration** approach.

## 📁 **File Structure**

```
aVOID/
├── .env                          # 🔑 MAIN CONFIG - Add your Supabase keys here
├── shared-config.js              # 📋 Shared configuration module
├── apps/game-hub/.env            # 🎮 Hub-specific settings only
├── games/void-avoid/.env         # 🚀 Game-specific settings only
├── games/tanka-void/.env         # 🚀 Game-specific settings only
├── games/wrecka-void/.env        # 🚀 Game-specific settings only
└── games/word-avoid/.env         # 🚀 Game-specific settings only
```

## 🔧 **Quick Setup**

### Step 1: Add Your Supabase Keys (ONE TIME ONLY)

**Edit the ROOT `.env` file:**
```bash
# File: /aVOID/.env

# Replace these with your actual Supabase credentials:
VITE_SUPABASE_URL=https://your-actual-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# These are already configured:
VITE_DEBUG=false
VITE_ENVIRONMENT=development
```

### Step 2: Start Development Servers
```powershell
# From root directory:
.\scripts\dev-all-games.ps1
```

## ✅ **Benefits of This Approach**

### **Before (Bad):**
```
❌ 5 separate .env files with duplicate Supabase keys
❌ Need to update keys in 5 places when they change
❌ Easy to have mismatched configurations
❌ More maintenance overhead
```

### **After (Good):**
```
✅ 1 shared .env file with Supabase keys
✅ Update keys in one place only
✅ Consistent configuration across all games
✅ Game-specific settings stay separate
```

## 📋 **Environment Variables Breakdown**

### **Root `.env` (Shared Settings)**
```env
# Shared across ALL games and hub
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_DEBUG=false
VITE_ENVIRONMENT=development

# Port configurations
VITE_HUB_PORT=5173
VITE_VOIDAVOID_PORT=5174
VITE_TANKAVOID_PORT=5175
VITE_WRECKAVOID_PORT=5176
VITE_WORDAVOID_PORT=5177
```

### **Game-Specific `.env` Files**
```env
# Each game only defines its unique settings
VITE_GAME_KEY=voidavoid
VITE_GAME_NAME=VOIDaVOID
```

## 🔍 **How Vite Loads Environment Variables**

Vite automatically loads `.env` files in this order:
1. **Root `.env`** (shared settings)
2. **App-specific `.env`** (game/hub specific settings)
3. Local overrides take precedence

This means games automatically inherit shared Supabase settings from the root!

## 🚀 **Development Workflow**

### **Starting All Games:**
```bash
# From root directory:
.\scripts\dev-all-games.ps1

# This will start:
# - Game Hub: http://localhost:5173
# - VOIDaVOID: http://localhost:5174
# - TankaVOID: http://localhost:5175
# - WreckaVOID: http://localhost:5176
# - WORDaVOID: http://localhost:5177
```

### **Starting Individual Games:**
```bash
# Hub only:
cd apps/game-hub && npm run dev

# Individual game:
cd games/void-avoid && npm run dev
```

## 🔧 **Configuration Options**

### **Option 1: Environment Variables (Current)**
- ✅ Simple and standard
- ✅ Works with all build tools
- ✅ Easy to override in production

### **Option 2: Shared Config Module (Alternative)**
```javascript
// Import in any game/hub:
import { sharedConfig } from '../../shared-config.js'

const supabaseUrl = sharedConfig.supabase.url
const gameConfig = sharedConfig.games.voidavoid
```

## 📁 **Production Deployment**

### **Development (Current)**
```
aVOID/.env → Contains development Supabase keys
├── All games inherit these settings
└── Each game has minimal local settings
```

### **Production (Future)**
```
Netlify/Vercel Environment Variables:
├── VITE_SUPABASE_URL=production_url
├── VITE_SUPABASE_ANON_KEY=production_key
└── Each deployment inherits these
```

## 🛠️ **Troubleshooting**

### **"Missing Supabase credentials" Warning**
```bash
# Check if root .env exists:
ls -la .env

# If missing, create it:
cp .env.example .env
# Then add your actual keys
```

### **Keys Not Loading**
```bash
# Restart development servers after adding keys:
# Stop all running servers (Ctrl+C)
# Then restart:
.\scripts\dev-all-games.ps1
```

### **Individual Game Not Working**
```bash
# Check game-specific .env:
cd games/void-avoid
cat .env

# Should show:
# VITE_GAME_KEY=voidavoid
# VITE_GAME_NAME=VOIDaVOID
```

## 🔐 **Security Notes**

### **What's Safe to Commit:**
- ✅ `apps/game-hub/.env` (no secrets)
- ✅ `games/*/​.env` (no secrets)
- ✅ `shared-config.js` (no secrets)

### **Never Commit:**
- ❌ Root `.env` (contains Supabase keys)
- ❌ Any file with actual credentials

### **Git Configuration:**
```bash
# Root .env is already in .gitignore
git status
# Should NOT show .env as changed
```

## 📝 **Current Status**

### **✅ Completed:**
- Root `.env` created with shared settings
- Individual `.env` files simplified
- Development script updated
- All games inherit Supabase settings automatically

### **🔧 Next Steps:**
1. **Add your Supabase keys** to root `.env` file
2. **Test the setup** by running development script
3. **Verify all games load** with proper configuration
4. **Set up production environment variables** when deploying

## 🚀 **Quick Start Commands**

```bash
# 1. Add your Supabase keys to root .env file
# 2. Install dependencies (if needed)
npm run install-all  # or manually install each

# 3. Start all development servers
.\scripts\dev-all-games.ps1

# 4. Access your games:
# - Hub: http://localhost:5173
# - Games: http://localhost:5174-5177
```

**Now you only need to maintain Supabase keys in ONE place! 🎉**
