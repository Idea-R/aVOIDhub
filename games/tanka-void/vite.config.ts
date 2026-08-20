import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/TankaVOID/",
  plugins: [react()],
  server: {
    host: true,
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: "../../dist/TankaVOID",
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
    rolldownOptions: {
      output: {
        minify: {
          compress: {
            dropConsole: process.env.NODE_ENV === "production",
            dropDebugger: process.env.NODE_ENV === "production",
          },
        },
      },
    },
  },
});
