import { createConnection } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
export async function probeApp(webUrl, apiUrl) {
  const [web, api] = await Promise.allSettled([
    fetch(webUrl, { signal: AbortSignal.timeout(1500) }).then(
      async (response) =>
        response.ok && /<title>\s*근차/.test(await response.text()),
    ),
    fetch(apiUrl, { signal: AbortSignal.timeout(1500) }).then(
      async (response) => {
        if (!response.ok) return false;
        const value = await response.json();
        return (
          value.data?.status === "ok" && value.data?.database === "mariadb"
        );
      },
    ),
  ]);
  return (
    web.status === "fulfilled" &&
    web.value === true &&
    api.status === "fulfilled" &&
    api.value === true
  );
}
export async function portInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1000, () => done(true));
    socket.once("connect", () => done(true));
    socket.once("error", (error) => done(error.code !== "ECONNREFUSED"));
  });
}
export async function waitForApp(webUrl, apiUrl, timeoutMs = 45000, signal) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if (await probeApp(webUrl, apiUrl)) return;
    await delay(400, undefined, { signal });
  }
  throw new Error("Web/API startup timed out. See .runtime/startup.log.");
}
export async function openBrowser(url) {
  if (process.platform !== "win32") return;
  const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
}
export function stopOwnedChild(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32")
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  else child.kill("SIGTERM");
}
