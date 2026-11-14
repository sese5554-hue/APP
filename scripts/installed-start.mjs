import { access, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { root, run, redact } from "./process.mjs";
import { prepareEnv } from "./env.mjs";
import { portableDb } from "./portable-db.mjs";
import { mobileAddress } from "./mobile-network.mjs";
import {
  probeApp,
  portInUse,
  waitForApp,
  openBrowser,
  stopOwnedChild,
} from "./launcher-health.mjs";
process.chdir(root);
let serverChild,
  phase = "Environment",
  stopping = false;
const logPath = path.join(root, ".runtime", "startup.log");
const shouldOpen =
  process.argv.includes("--open") && !process.argv.includes("--no-open");
const setupOnly = process.argv.includes("--setup-only");
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
async function log(message) {
  const safe = redact(message);
  console.log(safe);
  await appendFile(logPath, safe + "\n");
}
async function freePort(initial) {
  for (let port = initial; port < initial + 30; port++)
    if (!(await portInUse(port))) return port;
  throw new Error(
    "No available local port. Close the previous Geuncha window and retry.",
  );
}
try {
  let fresh = false;
  try {
    await access(".env");
  } catch {
    fresh = true;
  }
  await prepareEnv();
  process.env.GEUNCHA_STARTUP_LOG = logPath;
  await log(
    `\n[${new Date().toISOString()}] Installed Geuncha / bundled Node ${process.versions.node}`,
  );
  if (fresh) {
    const port = await freePort(Number(process.env.PORT || 3001)),
      dbPort = await freePort(Number(process.env.DB_PORT || 3307));
    const source = await readFile(".env", "utf8");
    await writeFile(
      ".env",
      source
        .replace(/^PORT=.*$/m, `PORT=${port}`)
        .replace(/^DB_PORT=.*$/m, `DB_PORT=${dbPort}`)
        .replace(/^APP_ORIGIN=.*$/m, `APP_ORIGIN=http://127.0.0.1:${port}`),
      { mode: 0o600 },
    );
    process.env.PORT = String(port);
    process.env.DB_PORT = String(dbPort);
  }
  const lan = process.argv.includes("--lan"),
    host = lan ? mobileAddress() : "127.0.0.1";
  process.env.HOST = host;
  process.env.SERVE_WEB = "true";
  process.env.APP_ORIGIN = `http://${host}:${process.env.PORT || 3001}`;
  const webUrl = process.env.APP_ORIGIN,
    apiUrl = `${webUrl}/api/health`,
    port = Number(process.env.PORT || 3001);
  const openUrl = process.argv.includes("--screen-test") ? `${webUrl}/mobile-test` : webUrl;
  if (!setupOnly && (await probeApp(webUrl, apiUrl))) {
    await log(`Already running: ${webUrl}`);
    if (shouldOpen) await openBrowser(openUrl);
  } else {
    if (!setupOnly && (await portInUse(port)))
      throw new Error(
        `Port ${port} is in use. Close the previous Geuncha window before changing PC/mobile modes.`,
      );
    phase = "MariaDB";
    await portableDb();
    phase = "Migrations";
    await run(process.execPath, ["dist/api/apps/api/src/database/migrate.js"]);
    if (process.env.NODE_ENV === "development") {
      phase = "Development seed";
      await run(process.execPath, ["dist/api/apps/api/src/database/seed.js"]);
    }
    if (setupOnly) {
      await log("Installed application setup completed.");
    } else {
      phase = "Application";
      const running = run(process.execPath, ["scripts/serve.mjs"], {
          onSpawn: (child) => {
            serverChild = child;
          },
        }),
        ready = new AbortController();
      try {
        await Promise.race([
          waitForApp(webUrl, apiUrl, 45000, ready.signal),
          running.then(() => {
            throw new Error("Application exited before readiness.");
          }),
        ]);
      } finally {
        ready.abort();
      }
      await log(
        `${lan ? "PHONE URL" : "Ready"}: ${webUrl}\nKeep this window open. Ctrl+C stops Geuncha. Local database data is preserved.`,
      );
      if (lan)
        await log("Use the same Wi-Fi/router. Mobile GPS requires HTTPS.");
      if (process.argv.includes("--screen-test")) await log(`SCREEN TEST URL: ${openUrl}`);
      if (shouldOpen) {
        try {
          await openBrowser(openUrl);
        } catch {
          await log(`Open ${webUrl} in your browser.`);
        }
      }
      await running;
    }
  }
} catch (error) {
  stopOwnedChild(serverChild);
  const message = redact(`[${phase}] ${error.message}`);
  console.error(message);
  try {
    await appendFile(logPath, message + "\n");
  } catch {}
  if (!stopping) process.exitCode = 1;
}
function stop() {
  stopping = true;
  stopOwnedChild(serverChild);
  process.exitCode = 0;
}
