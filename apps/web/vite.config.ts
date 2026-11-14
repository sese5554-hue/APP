import { defineConfig } from "vite";
import { existsSync, readFileSync, createReadStream, statSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import react from "@vitejs/plugin-react";
export default defineConfig(() => {
  // Read only the proxy setting; do not let .env's development NODE_ENV alter production builds.
  const env = existsSync(".env") ? parse(readFileSync(".env")) : {};
  return {
    root: "apps/web",
    plugins: [react(), {
      name: "local-android-apk",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use("/__test/android.apk", (req, res) => {
          const apk = path.resolve("releases/Geuncha-android-debug.apk");
          if (!["GET", "HEAD"].includes(req.method || "")) {
            res.statusCode = 405;
            res.end();
            return;
          }
          if (!existsSync(apk)) {
            res.statusCode = 404;
            res.end("Build the APK first: npm run mobile:apk");
            return;
          }
          res.setHeader("Content-Type", "application/vnd.android.package-archive");
          res.setHeader("Content-Disposition", 'attachment; filename="Geuncha-android-debug.apk"');
          res.setHeader("Content-Length", statSync(apk).size);
          res.setHeader("Cache-Control", "no-store");
          if (req.method === "HEAD") { res.end(); return; }
          const stream = createReadStream(apk);
          stream.on("error", () => res.destroy());
          res.on("close", () => stream.destroy());
          stream.pipe(res);
        });
      },
    }],
    server: {
      host: process.env.WEB_HOST || env.WEB_HOST || "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": `http://127.0.0.1:${process.env.PORT || env.PORT || 3001}`,
      },
    },
    build: { outDir: "../../dist/web", emptyOutDir: true },
  };
});
