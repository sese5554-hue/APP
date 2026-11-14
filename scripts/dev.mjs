import { spawn } from "node:child_process";
import path from "node:path";
import { root } from "./process.mjs";
const children = [];
const npmEntry =
  process.env.npm_execpath ||
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
for (const task of ["dev:api", "dev:web"]) {
  const child = spawn(
    process.platform === "win32" ? process.execPath : "npm",
    process.platform === "win32" ? [npmEntry, "run", task] : ["run", task],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  children.push(child);
  child.once("error", (error) => {
    console.error(error.message);
    shutdown(1);
  });
  child.once("exit", (code) => shutdown(code || 0));
}
let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === "win32")
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
    else child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500).unref();
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
console.log(
  "Geuncha: http://127.0.0.1:5173 (API http://127.0.0.1:3001). Ctrl+C to stop.",
);
