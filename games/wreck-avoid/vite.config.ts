import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/WreckaVOID/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: '../../dist/WreckaVOID',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          game: ['lucide-react']
        }
      }
    }
  },
  server: {
    port: 5178,
    host: true,
    strictPort: true
  }
});
