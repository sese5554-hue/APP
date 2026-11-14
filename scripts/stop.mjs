import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { root, redact } from "./process.mjs";
import { selectAppRoots, isPortableDatabase } from "./stop-processes.mjs";

const execute = promisify(execFile);
async function powershell(script) {
  const { stdout } = await execute(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(
        `$ErrorActionPreference='Stop'; ${script}`,
        "utf16le",
      ).toString("base64"),
    ],
    { windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024 },
  );
  return stdout.trim();
}
async function inventory() {
  const json = await powershell(`
    $items = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(node|cmd|mariadbd)[.]exe$' } | ForEach-Object {
      [pscustomobject]@{ ProcessId=$_.ProcessId; ParentProcessId=$_.ParentProcessId; Name=$_.Name; ExecutablePath=$_.ExecutablePath; CommandLine=$_.CommandLine; StartedTicks=$_.CreationDate.ToUniversalTime().Ticks.ToString() }
    }); ConvertTo-Json -InputObject $items -Compress
  `);
  return JSON.parse(json);
}
async function stopTree(record) {
  const result = await powershell(`
    $item = Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(record.ProcessId)}';
    if (-not $item) { Write-Output 'gone'; exit 0 };
    if ($item.CreationDate.ToUniversalTime().Ticks.ToString() -ne '${record.StartedTicks}') { throw 'Process identity changed; run stop again.' };
    & taskkill.exe /PID ${Number(record.ProcessId)} /T /F | Out-Null;
    if ($LASTEXITCODE -ne 0 -and (Get-Process -Id ${Number(record.ProcessId)} -ErrorAction SilentlyContinue)) { throw 'Could not stop the application process tree.' }
  `);
  console.log(
    `Stopped Geuncha application PID ${record.ProcessId}${result === "gone" ? " (already exited)" : ""}.`,
  );
}
async function shutdownDatabase(record) {
  const { parse } = await import("dotenv");
  const settings = parse(await readFile(path.join(root, ".env")));
  const port = /--port=(\d+)(?:\s|$)/.exec(record.CommandLine || "")?.[1];
  if (!port)
    throw new Error(
      "Local database port could not be verified. Database left running.",
    );
  const mariadb = (await import("mariadb")).default;
  let connection;
  try {
    connection = await mariadb.createConnection({
      host: "127.0.0.1",
      port: Number(port),
      user: "root",
      password: settings.DB_ROOT_PASSWORD,
      connectTimeout: 3000,
      socketTimeout: 5000,
    });
    const rows = await connection.query("SELECT @@datadir AS location");
    const actual = await realpath(rows[0].location);
    const expected = await realpath(
      path.join(root, ".runtime", "mariadb-data"),
    );
    if (actual.toLowerCase() !== expected.toLowerCase())
      throw new Error(
        "Database data directory differs. Database left running.",
      );
    await connection.query("SHUTDOWN");
  } catch (error) {
    if (
      ![
        "ER_SERVER_SHUTDOWN",
        "ER_CONNECTION_ALREADY_CLOSED",
        "ER_CMD_CONNECTION_CLOSED",
        "ER_SOCKET_UNEXPECTED_CLOSE",
      ].includes(error.code)
    )
      throw error;
  } finally {
    try {
      await connection?.end();
    } catch {}
  }
  console.log(
    `Requested a normal shutdown of local MariaDB PID ${record.ProcessId}.`,
  );
}

try {
  if (process.platform !== "win32")
    throw new Error("stop.cmd supports Windows only.");
  const args = new Set(process.argv.slice(2));
  for (const arg of args)
    if (!["--dry-run", "--app-only", "--no-pause"].includes(arg))
      throw new Error(`Unknown argument: ${arg}`);
  const snapshot = await inventory();
  const apps = selectAppRoots(snapshot, root);
  const databases = args.has("--app-only")
    ? []
    : snapshot.filter((item) => isPortableDatabase(item, root));
  console.log(
    `Geuncha: ${apps.length} application tree(s), ${databases.length} local database process(es).`,
  );
  if (args.has("--dry-run")) {
    for (const item of apps)
      console.log(`Would stop application PID ${item.ProcessId}.`);
    for (const item of databases)
      console.log(`Would shut down local MariaDB PID ${item.ProcessId}.`);
  } else {
    for (const item of apps) await stopTree(item);
    // Detect a watcher that survived before closing the database beneath it.
    let remaining;
    for (let attempt = 0; attempt < 10; attempt++) {
      remaining = await inventory();
      if (!selectAppRoots(remaining, root).length) break;
      await delay(400);
    }
    if (selectAppRoots(remaining, root).length)
      throw new Error(
        "Application processes remain. Database left running; retry stop.",
      );
    for (const item of databases) {
      const current = remaining.find(
        (row) =>
          row.ProcessId === item.ProcessId &&
          row.StartedTicks === item.StartedTicks,
      );
      if (current && isPortableDatabase(current, root))
        await shutdownDatabase(current);
    }
    for (let attempt = 0; attempt < 15; attempt++) {
      const active = (await inventory()).filter((item) =>
        isPortableDatabase(item, root),
      );
      if (args.has("--app-only") || !active.length) break;
      if (attempt === 14)
        throw new Error(
          "MariaDB is still shutting down. Its process was not forcibly killed.",
        );
      await delay(500);
    }
    console.log(
      args.has("--app-only")
        ? "Geuncha app stopped. Database kept running."
        : "Geuncha stopped. Database files and uploads are preserved.",
    );
  }
} catch (error) {
  // Do not print process command lines or database credentials.
  console.error(redact(`Geuncha stop failed: ${error.message}`));
  process.exitCode = 1;
}
