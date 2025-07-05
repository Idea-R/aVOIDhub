/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'game-mono': ['JetBrains Mono', 'monospace'],
        'game-display': ['Orbitron', 'monospace'],
        'game-ui': ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        // aVOID Brand Colors
        'avoid-primary': '#00ff88',
        'avoid-secondary': '#ff0066',
        'avoid-accent': '#0088ff',
        'avoid-warning': '#ffaa00',
        
        // Difficulty Colors
        'easy': '#4ade80',
        'medium': '#facc15',
        'hard': '#f97316',
        'extreme': '#ef4444',
        'boss': '#8b5cf6',
        
        // Game States
        'health-high': '#10b981',
        'health-medium': '#f59e0b',
        'health-low': '#ef4444',
        'score': '#06b6d4',
        
        // Dark Theme
        'bg-primary': '#0a0a0a',
        'bg-secondary': '#1a1a1a',
        'bg-tertiary': '#2a2a2a',
        'text-primary': '#ffffff',
        'text-secondary': '#a3a3a3',
        'text-muted': '#666666',
        
        // Border
        'default-border': 'var(--default-border-color)',
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shake': 'shake 0.5s ease-in-out',
        'word-approach': 'word-approach 3s linear forwards',
      },
      keyframes: {
        'pulse-neon': {
          '0%': { 
            boxShadow: '0 0 5px #00ff88, 0 0 10px #00ff88, 0 0 15px #00ff88',
            textShadow: '0 0 5px #00ff88'
          },
          '100%': { 
            boxShadow: '0 0 10px #00ff88, 0 0 20px #00ff88, 0 0 30px #00ff88',
            textShadow: '0 0 10px #00ff88'
          }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' }
        },
        'glow': {
          '0%': { filter: 'brightness(1) drop-shadow(0 0 5px currentColor)' },
          '100%': { filter: 'brightness(1.2) drop-shadow(0 0 15px currentColor)' }
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' }
        },
        'word-approach': {
          '0%': { transform: 'scale(0.5)', opacity: '0.7' },
          '100%': { transform: 'scale(1.2)', opacity: '1' }
        }
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
};