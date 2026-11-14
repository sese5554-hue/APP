import { root } from "./process.mjs";
process.chdir(root);
await import("dotenv/config");
process.env.SERVE_WEB = "true";
if (
  process.env.NODE_ENV !== "production" &&
  (!process.env.APP_ORIGIN ||
    process.env.APP_ORIGIN === "http://127.0.0.1:5173")
) {
  process.env.APP_ORIGIN = `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 3001}`;
}
await import("../dist/api/apps/api/src/server.js");
