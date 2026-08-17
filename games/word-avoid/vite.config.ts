import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/WORDaVOID/',
  plugins: [react()],
  build: {
    outDir: '../../dist/WORDaVOID',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{
            name(moduleId) {
              if (moduleId.includes('/node_modules/@supabase/')) return 'supabase';
              if (moduleId.includes('/node_modules/tone/')) return 'audio';
              if (moduleId.includes('/node_modules/framer-motion/')) return 'motion';
              if (moduleId.includes('/node_modules/lucide-react/')) return 'icons';
              if (/\/node_modules\/(react|react-dom|zustand)\//.test(moduleId)) return 'vendor';
              return null;
            }
          }]
        }
      }
    }
  },
  server: {
    port: 5177,
    host: true,
    strictPort: true
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
