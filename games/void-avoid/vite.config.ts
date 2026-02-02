import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/VOIDaVOID/',
  plugins: [react()],
  build: {
    outDir: '../../dist/VOIDaVOID'
  },
  server: {
    port: 5174,
    host: true,
    strictPort: true
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
