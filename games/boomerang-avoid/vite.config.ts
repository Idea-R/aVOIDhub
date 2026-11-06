import { defineConfig } from "vite";
export default defineConfig({
  base: "/boomerangavoid/",
  build: { outDir: "../../dist/BoomerangaVOID", emptyOutDir: true },
  server: { host: "127.0.0.1" },
});
