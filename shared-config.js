// Shared Configuration for aVOID Games
// This file contains environment configuration that can be imported by all games

export const sharedConfig = {
  supabase: {
    url: process.env.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY,
  },
  
  development: {
    ports: {
      hub: 5173,
      voidavoid: 5174,
      tankavoid: 5175,
      wreckavoid: 5176,
      wordavoid: 5177,
    },
    urls: {
      hub: 'http://localhost:5173',
      voidavoid: 'http://localhost:5174',
      tankavoid: 'http://localhost:5175',
      wreckavoid: 'http://localhost:5176',
      wordavoid: 'http://localhost:5177',
    }
  },
  
  production: {
    urls: {
      hub: 'https://avoidgame.io',
      voidavoid: 'https://voidavoid.netlify.app',
      tankavoid: 'https://tankavoid.netlify.app',
      wreckavoid: 'https://wreckavoid.netlify.app',
      wordavoid: 'https://wordavoid.netlify.app',
    }
  },
  
  games: {
    voidavoid: {
      key: 'voidavoid',
      name: 'VOIDaVOID',
      description: 'Navigate through space avoiding obstacles',
    },
    tankavoid: {
      key: 'tankavoid',
      name: 'TankaVOID',
      description: 'Tank warfare meets cursor precision',
    },
    wreckavoid: {
      key: 'wreckavoid',
      name: 'WreckaVOID',
      description: 'Demolition chaos with cursor control',
    },
    wordavoid: {
      key: 'wordavoid',
      name: 'WORDaVOID',
      description: 'Test your typing speed while avoiding words',
    }
  }
}

export default sharedConfig
