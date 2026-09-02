import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.RAIL_BASE ?? '/RAILaVOID/',
  build: {
    outDir: process.env.RAIL_OUTDIR ?? '../../dist/RAILaVOID',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] }
      }
    }
  },
  server: { host: true, port: Number(process.env.PORT) || 5173, strictPort: true },
  preview: { host: true, port: Number(process.env.PORT) || 4173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
