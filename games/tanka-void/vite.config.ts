import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    open: true
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.log for debugging
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'game-core': ['./src/core/Game.ts', './src/core/InputManager.ts'],
          'game-entities': ['./src/entities/Tank.ts', './src/entities/EnemyTank.ts', './src/entities/Projectile.ts'],
          'game-systems': ['./src/systems/ParticleSystem.ts', './src/systems/AudioSystem.ts'],
          'game-utils': ['./src/utils/Vector2.ts', './src/utils/Rectangle.ts', './src/utils/ObjectPool.ts']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})