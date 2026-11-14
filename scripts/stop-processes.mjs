import path from "node:path";

const normalize = (value) =>
  String(value || "")
    .replaceAll("\\", "/")
    .toLowerCase();
const canonical = (value) => normalize(path.win32.resolve(value));

export function isAppProcess(record, root) {
  if (normalize(record.Name) !== "node.exe") return false;
  const base = canonical(root),
    command = normalize(record.CommandLine);
  const localTools = command.includes(`${base}/node_modules/`);
  const development =
    localTools &&
    ((command.includes("/vite/") &&
      command.includes("apps/web/vite.config.ts")) ||
      (command.includes("/tsx/") &&
        command.includes("apps/api/src/server.ts")));
  const bundled =
    canonical(record.ExecutablePath || ".") === `${base}/runtime/node.exe`;
  const serve = /scripts\/(?:serve|installed-start)\.mjs(?:[\s"]|$)/.test(
    command,
  );
  const absoluteServe = ["serve", "installed-start"].some(
    (name) =>
      command.includes(`"${base}/scripts/${name}.mjs"`) ||
      (!base.includes(" ") && command.endsWith(` ${base}/scripts/${name}.mjs`)),
  );
  return development || (bundled && serve) || absoluteServe;
}

function isLauncher(record) {
  const name = normalize(record.Name),
    command = normalize(record.CommandLine);
  if (!["node.exe", "cmd.exe"].includes(name)) return false;
  return (
    /(?:^|[\s"/])scripts\/(?:start|dev|serve|installed-start)\.mjs(?:[\s"]|$)/.test(
      command,
    ) ||
    /npm-cli\.js"?\s+run\s+(?:dev(?::(?:api|web))?|start)(?:\s|$)/.test(
      command,
    ) ||
    (name === "cmd.exe" &&
      /\/(?:c|s\s+\/c)\s+"?(?:tsx\s+watch\s+apps\/api\/src\/server\.ts|vite\s+--config\s+apps\/web\/vite\.config\.ts)/.test(
        command,
      ))
  );
}

export function selectAppRoots(records, root) {
  const byId = new Map(records.map((record) => [record.ProcessId, record]));
  const selected = new Map();
  for (const seed of records.filter((record) => isAppProcess(record, root))) {
    let current = seed;
    const visited = new Set([seed.ProcessId]);
    while (true) {
      const parent = byId.get(current.ParentProcessId);
      if (!parent || visited.has(parent.ProcessId) || !isLauncher(parent))
        break;
      // A reused parent PID must not associate an unrelated newer process.
      if (BigInt(parent.StartedTicks) > BigInt(current.StartedTicks)) break;
      visited.add(parent.ProcessId);
      current = parent;
    }
    selected.set(current.ProcessId, current);
  }
  return [...selected.values()].filter((record) => {
    let current = record;
    const visited = new Set([record.ProcessId]);
    while (true) {
      const parent = byId.get(current.ParentProcessId);
      if (!parent || visited.has(parent.ProcessId)) return true;
      if (BigInt(parent.StartedTicks) > BigInt(current.StartedTicks))
        return true;
      if (selected.has(parent.ProcessId)) return false;
      visited.add(parent.ProcessId);
      current = parent;
    }
  });
}

export function isPortableDatabase(record, root) {
  const base = canonical(root);
  const executable = canonical(record.ExecutablePath || ".");
  if (
    !new RegExp(
      `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/\\.runtime/mariadb-[^/]+-winx64/bin/mariadbd\\.exe$`,
    ).test(executable)
  )
    return false;
  const data = /--datadir=(?:"([^"]+)"|([^\s"]+))/i.exec(
    record.CommandLine || "",
  );
  return Boolean(
    data && canonical(data[1] || data[2]) === `${base}/.runtime/mariadb-data`,
  );
}
