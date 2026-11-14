import { defineConfig } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import react from "@vitejs/plugin-react";
export default defineConfig(() => {
  // Read only the proxy setting; do not let .env's development NODE_ENV alter production builds.
  const env = existsSync(".env") ? parse(readFileSync(".env")) : {};
  return {
    root: "apps/web",
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": `http://127.0.0.1:${process.env.PORT || env.PORT || 3001}`,
      },
    },
    build: { outDir: "../../dist/web", emptyOutDir: true },
  };
});
