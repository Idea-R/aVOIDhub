import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/VOIDaVOID/',
  plugins: [react()],
  build: {
    outDir: '../../dist/VOIDaVOID',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        minify: {
          compress: {
            dropConsole: process.env.NODE_ENV === 'production',
            dropDebugger: process.env.NODE_ENV === 'production'
          }
        }
      }
    }
  },
  server: {
    port: 5174,
    host: true,
    strictPort: true
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
