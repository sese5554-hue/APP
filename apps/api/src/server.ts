import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./database/db.js";
await pool.query("SELECT 1");
const server = createApp().listen(config.PORT, config.HOST, () =>
  console.log(
    `Geuncha API: http://${config.HOST}:${config.PORT} (${config.PROVIDER_MODE})`,
  ),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
  void pool.end();
});
async function close() {
  server.closeAllConnections();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
