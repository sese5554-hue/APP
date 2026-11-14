import { access, appendFile } from "node:fs/promises";
import path from "node:path";
import { root, npm, run, redact } from "./process.mjs";
import { prepareEnv } from "./env.mjs";
import { mobileAddress } from "./mobile-network.mjs";
import {
  probeApp,
  portInUse,
  waitForApp,
  openBrowser,
  stopOwnedChild,
} from "./launcher-health.mjs";
process.chdir(root);
let phase = "Node.js check",
  serverChild;
const logPath = path.join(root, ".runtime", "startup.log");
const shouldOpen =
  process.argv.includes("--open") && !process.argv.includes("--no-open");
async function log(message) {
  console.log(message);
  await appendFile(logPath, redact(message) + "\n");
}
try {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12))
    throw new Error("Node.js 22.12+ is required.");
  await prepareEnv();
  const lan = process.argv.includes("--lan");
  let lanAddress;
  if (lan) {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "Mobile LAN testing is only available in development mode.",
      );
    const lanIndex = process.argv.indexOf("--lan-ip");
    if (lanIndex >= 0 && !process.argv[lanIndex + 1])
      throw new Error("--lan-ip requires an address.");
    lanAddress = mobileAddress(
      lanIndex >= 0 ? process.argv[lanIndex + 1] : undefined,
    );
    process.env.WEB_HOST = lanAddress;
    process.env.HOST = "127.0.0.1";
    process.env.APP_ORIGIN = `http://${lanAddress}:5173`;
  }
  process.env.GEUNCHA_STARTUP_LOG = logPath;
  await log(
    `\n[${new Date().toISOString()}] Geuncha startup / Node ${process.versions.node}`,
  );
  const apiPort = Number(process.env.PORT || 3001),
    webUrl = lan ? `http://${lanAddress}:5173` : "http://127.0.0.1:5173",
    apiUrl = `http://127.0.0.1:${apiPort}/api/health`;
  const setupOnly = process.argv.includes("--setup-only");
  if (lan)
    await log(
      `PHONE URL: ${webUrl}\nConnect the phone to the same Wi-Fi/router. Keep this terminal open.\nGPS requires HTTPS on a phone; use guestdemo for the booking test.`,
    );
  const alreadyRunning = !setupOnly && (await probeApp(webUrl, apiUrl));
  if (!setupOnly) {
    phase = "Existing server check";
    if (alreadyRunning) {
      await log(`Geuncha is already running: ${webUrl}`);
      if (shouldOpen) {
        try {
          await openBrowser(webUrl);
        } catch {
          await log(`Open ${webUrl} in your browser.`);
        }
      }
      process.exitCode = 0;
    } else {
      const busy = [];
      for (const port of [apiPort, 5173])
        if (await portInUse(port)) busy.push(port);
      if (busy.length)
        throw new Error(
          `Port ${busy.join(", ")} is already in use, but the Geuncha web/API pair is not healthy. Close the previous Geuncha terminal and retry; do not terminate unrelated applications. See .runtime/startup.log.`,
        );
    }
  }
  // A second double-click reuses the verified running app and performs no DB writes.
  if (!alreadyRunning) {
    phase = "Dependency installation";
    try {
      await access("node_modules/.package-lock.json");
    } catch {
      await npm(["ci"]);
    }
    const index = process.argv.indexOf("--db"),
      mode = index >= 0 ? process.argv[index + 1] : "existing";
    phase = "MariaDB startup";
    if (mode === "portable")
      await (await import("./portable-db.mjs")).portableDb();
    else if (mode === "docker")
      await run("docker", ["compose", "up", "-d", "--wait", "db"]);
    else if (mode !== "existing")
      throw new Error("Use --db existing, docker, or portable.");
    const mariadb = (await import("mariadb")).default;
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const db = await mariadb.createConnection({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          connectTimeout: 1000,
        });
        await db.end();
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (!ready)
      throw new Error(
        "Cannot connect to MariaDB. Check .env; start DB using --db docker or --db portable (Windows).",
      );
    phase = "Database migrations";
    await npm(["run", "db:migrate"]);
    phase = "Development seed";
    if (process.env.NODE_ENV === "development") await npm(["run", "db:seed"]);
    if (!setupOnly) {
      phase = "Web/API startup";
      const running = npm(["run", "dev"], {
        onSpawn: (child) => {
          serverChild = child;
        },
      });
      const readiness = new AbortController();
      try {
        await Promise.race([
          waitForApp(webUrl, apiUrl, 45000, readiness.signal),
          running.then(() => {
            throw new Error(
              "Web/API stopped before becoming ready. See .runtime/startup.log.",
            );
          }),
        ]);
      } finally {
        readiness.abort();
      }
      await log(
        `Ready: ${webUrl}\nKeep this window open. Ctrl+C stops the app.`,
      );
      if (shouldOpen) {
        try {
          await openBrowser(webUrl);
        } catch (error) {
          await log(
            `Open ${webUrl} in your browser. Browser launch: ${redact(error.message)}`,
          );
        }
      }
      await running;
    } else await log("Setup completed. Existing data preserved.");
  }
} catch (error) {
  stopOwnedChild(serverChild);
  const message = redact(`[${phase}] ${error.message}`);
  console.error(message);
  try {
    await appendFile(logPath, message + "\n");
    console.error(`Error log: ${logPath}`);
  } catch {
    /* report the original error even if the log is unavailable */
  }
  process.exitCode = 1;
}
