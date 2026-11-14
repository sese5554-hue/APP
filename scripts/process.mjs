import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendFileSync } from "node:fs";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { onSpawn, ...spawnOptions } = options;
    const logPath = process.env.GEUNCHA_STARTUP_LOG;
    const child = spawn(command, args, {
      cwd: root,
      stdio: logPath ? ["inherit", "pipe", "pipe"] : "inherit",
      windowsHide: true,
      ...spawnOptions,
    });
    if (logPath)
      for (const [stream, target] of [
        [child.stdout, process.stdout],
        [child.stderr, process.stderr],
      ]) {
        if (!stream) continue;
        let pending = "";
        stream.setEncoding("utf8");
        const output = (line) => {
          const safe = redact(line);
          target.write(safe);
          appendFileSync(logPath, safe);
        };
        stream.on("data", (chunk) => {
          pending += chunk;
          let newline;
          while ((newline = pending.indexOf("\n")) >= 0) {
            output(pending.slice(0, newline + 1));
            pending = pending.slice(newline + 1);
          }
        });
        stream.on("end", () => {
          if (pending) output(pending);
        });
      }
    onSpawn?.(child);
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`${path.basename(command)} exited with code ${code}`),
          ),
    );
  });
}
export async function npm(args, options = {}) {
  if (process.platform !== "win32") {
    await run("npm", args, options);
    return;
  }
  // npm's JS entry avoids PowerShell policy changes and cmd shell escaping.
  const entry =
    process.env.npm_execpath ||
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    );
  await run(process.execPath, [entry, ...args], options);
}
export function redact(text) {
  for (const [key, value] of Object.entries(process.env))
    if (
      /(?:PASSWORD|SECRET|TOKEN|API_KEY)$/.test(key) &&
      value &&
      value.length >= 4
    )
      text = text.split(value).join("[REDACTED]");
  return text;
}
