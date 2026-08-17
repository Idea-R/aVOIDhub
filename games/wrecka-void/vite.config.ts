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
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{
            name(moduleId) {
              if (moduleId.includes('/node_modules/@supabase/')) return 'supabase';
              if (moduleId.includes('/node_modules/lucide-react/')) return 'game';
              if (/\/node_modules\/(react|react-dom)\//.test(moduleId)) return 'vendor';
              return null;
            }
          }]
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
