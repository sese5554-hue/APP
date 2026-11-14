import { mkdtemp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { parse } from "dotenv";
import mariadb from "mariadb";
import { run, root } from "./process.mjs";
import { waitForApp, portInUse, stopOwnedChild } from "./launcher-health.mjs";
import { sha256 } from "./installer-utils.mjs";
import { mobileAddress } from "./mobile-network.mjs";
import { chromium } from "@playwright/test";
if (process.platform !== "win32")
  throw new Error("Windows installer test only.");
const appKey = [
  "HKCU:",
  "Software",
  "Microsoft",
  "Windows",
  "CurrentVersion",
  "Uninstall",
  "{6248BB70-753B-4D2C-8FF3-78293C9656D1}_is1",
].join(path.win32.sep);
await run("powershell.exe", [
  "-NoProfile",
  "-NonInteractive",
  "-Command",
  `if(Test-Path -LiteralPath '${appKey}') { throw 'An existing Geuncha installation is registered. Installer smoke test will not replace it.' }`,
]);
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")),
  exe = path.join(root, "releases", `Geuncha-Setup-${pkg.version}-win-x64.exe`),
  manifest = JSON.parse(
    await readFile(path.join(root, "releases", "build-manifest.json"), "utf8"),
  );
assert.equal(
  sha256(await readFile(exe)),
  manifest.sha256,
  "Installer checksum must match build manifest.",
);
const base = await mkdtemp(path.join(tmpdir(), "Geuncha-Setup-Test-")),
  app = path.join(base, "Geuncha App"),
  log = path.join(base, "setup.log");
await mkdir(path.join(root, ".runtime"), { recursive: true });
await writeFile(
  path.join(root, ".runtime", "installer-smoke-state.json"),
  JSON.stringify({ base, app, log }, null, 2),
);
const args = [
  "/VERYSILENT",
  "/SUPPRESSMSGBOXES",
  "/NORESTART",
  "/NOICONS",
  "/TASKS=",
  `/DIR=${app}`,
  `/LOG=${log}`,
];
const env = {
  ...process.env,
  PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`,
  NODE_PATH: "",
};
for (const key of Object.keys(env))
  if (
    key.startsWith("DB_") ||
    [
      "NODE_ENV",
      "HOST",
      "PORT",
      "APP_ORIGIN",
      "WEB_HOST",
      "PROVIDER_MODE",
      "GEUNCHA_STARTUP_LOG",
    ].includes(key)
  )
    delete env[key];
let child,
  settings,
  uninstalled = false;
async function stopWeb() {
  if (child?.exitCode === null) {
    const closed = once(child, "close");
    stopOwnedChild(child);
    await closed;
    child = undefined;
  }
}
async function stopDatabase() {
  if (!settings) return;
  let connection;
  try {
    connection = await mariadb.createConnection({
      host: "127.0.0.1",
      port: Number(settings.DB_PORT),
      user: "root",
      password: settings.DB_ROOT_PASSWORD,
      connectTimeout: 2000,
    });
    const rows = await connection.query("SELECT @@datadir AS location");
    assert.equal(
      path.resolve(rows[0].location).toLowerCase(),
      path.resolve(app, ".runtime", "mariadb-data").toLowerCase(),
      "Only stop the isolated test DB",
    );
    await connection.query("SHUTDOWN");
  } catch (error) {
    if (
      error.code !== "ECONNREFUSED" &&
      ![
        "ER_SERVER_SHUTDOWN",
        "ER_CONNECTION_ALREADY_CLOSED",
        "ER_CMD_CONNECTION_CLOSED",
        "ER_SOCKET_UNEXPECTED_CLOSE",
        "ECONNRESET",
      ].includes(error.code)
    )
      throw error;
  } finally {
    try {
      await connection?.end();
    } catch {}
  }
}
async function startWeb(args = []) {
  const node = path.join(app, "runtime", "node.exe");
  child = spawn(node, ["scripts/installed-start.mjs", "--no-open", ...args], {
    cwd: app,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (bytes) => process.stdout.write(bytes));
  child.stderr.on("data", (bytes) => process.stderr.write(bytes));
  const url = `http://${args.includes("--lan") ? mobileAddress() : "127.0.0.1"}:${settings.PORT}`;
  await waitForApp(url, url + "/api/health", 45000);
  return url;
}
try {
  console.log(`Installing into isolated folder: ${app}`);
  await run(exe, args);
  const node = path.join(app, "runtime", "node.exe");
  for (const file of ["mobile/Geuncha-android-debug.apk", "android/test-settings.json", "ios/test-settings.json"])
    await access(path.join(app, file));
  await run(node, ["--version"], { cwd: app, env });
  await run(node, ["scripts/installed-start.mjs", "--setup-only"], {
    cwd: app,
    env,
  });
  settings = parse(await readFile(path.join(app, ".env"), "utf8"));
  assert.equal(
    await readFile(path.join(app, ".env"), "utf8").then((text) =>
      text.includes("replace-with-local-password"),
    ),
    false,
  );
  assert.ok(
    settings.DB_PASSWORD !== settings.DB_ROOT_PASSWORD,
    "DB credentials must be independent",
  );
  let url = await startWeb(),
    cookie = "";
  const request = async (endpoint, method = "GET", body) => {
    const response = await fetch(url + "/api" + endpoint, {
      method,
      headers: {
        "X-Geuncha-Request": "1",
        "Content-Type": "application/json",
        Origin: url,
        Cookie: cookie,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const data = await response.json();
    assert.equal(response.status, 200, JSON.stringify(data));
    return data.data;
  };
  const user = await request("/auth/login", "POST", {
      loginId: "guestdemo",
      password: "Geuncha123!",
    }),
    vehicles = await request("/vehicles");
  assert.ok(vehicles.items.length >= 3);
  assert.equal((await request("/auth/me")).id, user.id);
  await mkdir(path.join(app, ".runtime", "uploads"), { recursive: true });
  await writeFile(
    path.join(app, ".runtime", "uploads", "preserve-marker.txt"),
    "preserved",
  );
  const originalEnv = await readFile(path.join(app, ".env"), "utf8");
  await stopWeb();
  await stopDatabase();
  console.log(
    "Reinstalling to verify settings, database and upload preservation...",
  );
  await run(exe, args);
  assert.ok(
    (await readFile(path.join(app, ".env"), "utf8")) === originalEnv,
    "Environment must be preserved without displaying secrets",
  );
  assert.equal(
    await readFile(
      path.join(app, ".runtime", "uploads", "preserve-marker.txt"),
      "utf8",
    ),
    "preserved",
  );
  url = await startWeb();
  assert.equal(
    (await request("/auth/me")).id,
    user.id,
    "Database-backed session must survive reinstall",
  );
  await stopWeb();
  url = await startWeb(["--lan", "--screen-test"]);
  const apkResponse = await fetch(url + "/__test/android.apk");
  assert.equal(apkResponse.status, 200);
  assert.equal(sha256(Buffer.from(await apkResponse.arrayBuffer())), sha256(await readFile(path.join(root, "releases/Geuncha-android-debug.apk"))));
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(url + "/mobile-test");
    await page.getByRole("heading", { name: "휴대폰 화면 테스트" }).waitFor();
    assert.equal(await page.locator("#test-screen option").count(), 53);
    await page.getByRole("button", { name: "게스트 화면 테스트", exact: true }).click();
    await page.getByRole("heading", { name: "내 주변 차량", exact: true }).waitFor();
    await page.goto(url + "/mobile-test");
    await page.getByRole("button", { name: "호스트 화면 테스트", exact: true }).click();
    await page.getByRole("heading", { name: "내 차가 만드는 새로운 일상", exact: true }).waitFor();
  } finally { await browser.close(); }
  console.log("PASS: installed LAN test page, both role logins, 52 screen links, APK download hash and platform settings.");
  await stopWeb();
  await stopDatabase();
  console.log("Testing uninstall without deleting data...");
  await run(path.join(app, "unins000.exe"), [
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART",
  ]);
  uninstalled = true;
  assert.ok(
    (await readFile(path.join(app, ".env"), "utf8")) === originalEnv,
    "Environment must remain after uninstall without displaying secrets",
  );
  await access(path.join(app, ".runtime", "mariadb-data", "ibdata1"));
  assert.equal(
    await readFile(
      path.join(app, ".runtime", "uploads", "preserve-marker.txt"),
      "utf8",
    ),
    "preserved",
  );
  await assert.rejects(access(path.join(app, "runtime", "node.exe")));
  console.log(
    "PASS: silent install, bundled Node with no system Node/npm in PATH, fresh DB, login, reinstall/session/data preservation, uninstall/data preservation.",
  );
} finally {
  await stopWeb();
  await stopDatabase();
  if (!uninstalled) {
    try {
      await access(path.join(app, "unins000.exe"));
      await run(path.join(app, "unins000.exe"), [
        "/VERYSILENT",
        "/SUPPRESSMSGBOXES",
        "/NORESTART",
      ]);
    } catch {
      console.error(`Test installation cleanup needs review: ${app}`);
    }
  }
}
