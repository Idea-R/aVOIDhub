import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/WORDaVOID/',
  plugins: [react()],
  build: {
    outDir: '../../dist/WORDaVOID'
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
