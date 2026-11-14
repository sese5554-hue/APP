import { access, mkdir, readFile, writeFile, open } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { root, run } from "./process.mjs";
import { prepareEnv } from "./env.mjs";
const version = "11.4.5";
export async function portableDb() {
  if (process.platform !== "win32")
    throw new Error(
      "Portable setup supports Windows. Use Docker Compose or an existing MariaDB on Linux.",
    );
  const mariadb = (await import("mariadb")).default;
  const runtime = path.join(root, ".runtime"),
    archive = path.join(runtime, `mariadb-${version}.zip`),
    directory = path.join(runtime, `mariadb-${version}-winx64`),
    data = path.join(runtime, "mariadb-data");
  const binary = path.join(directory, "bin", "mariadbd.exe");
  try {
    await access(binary);
  } catch {
    const base = `https://archive.mariadb.org/mariadb-${version}/winx64-packages/`,
      filename = `mariadb-${version}-winx64.zip`;
    console.log(
      `Downloading official MariaDB ${version} development runtime (87 MB) into .runtime...`,
    );
    const [response, sumsResponse] = await Promise.all([
      fetch(base + filename),
      fetch(base + "sha256sums.txt"),
    ]);
    if (!response.ok || !sumsResponse.ok)
      throw new Error("MariaDB download failed. Check network access.");
    const sums = await sumsResponse.text(),
      line = sums.split("\n").find((s) => s.trim().endsWith(filename));
    if (!line) throw new Error("MariaDB checksum entry is missing.");
    const bytes = Buffer.from(await response.arrayBuffer()),
      actual = createHash("sha256").update(bytes).digest("hex");
    if (line.trim().split(/\s+/)[0].toLowerCase() !== actual)
      throw new Error("MariaDB archive checksum mismatch.");
    await writeFile(archive, bytes);
    const escapedArchive = archive.replace(/'/g, "''"),
      escapedRuntime = runtime.replace(/'/g, "''");
    await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Expand-Archive -LiteralPath '${escapedArchive}' -DestinationPath '${escapedRuntime}' -Force`,
    ]);
  }
  let fresh = false;
  try {
    await access(path.join(data, "mysql"));
  } catch {
    await mkdir(data, { recursive: true });
    await run(path.join(directory, "bin", "mariadb-install-db.exe"), [
      `--datadir=${data}`,
      `--port=${process.env.DB_PORT || 3307}`,
    ]);
    fresh = true;
  }
  const rootOptions = {
    host: "127.0.0.1",
    port: Number(process.env.DB_PORT || 3307),
    user: "root",
    password: process.env.DB_ROOT_PASSWORD,
    connectTimeout: 1500,
  };
  let connection;
  try {
    connection = await mariadb.createConnection(rootOptions);
  } catch {
    const log = await open(path.join(runtime, "mariadb.log"), "a");
    const child = spawn(
      binary,
      [
        `--datadir=${data}`,
        "--bind-address=127.0.0.1",
        `--port=${rootOptions.port}`,
        "--character-set-server=utf8mb4",
        "--console",
      ],
      {
        cwd: root,
        detached: true,
        stdio: ["ignore", log.fd, log.fd],
        windowsHide: true,
      },
    );
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
    await log.close();
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        connection = await mariadb.createConnection({
          ...rootOptions,
          password: fresh ? "" : rootOptions.password,
        });
        break;
      } catch {
        /* bounded startup retry */
      }
    }
  }
  if (!connection)
    throw new Error(
      "MariaDB did not start. See .runtime/mariadb.log; check DB_PORT and credentials.",
    );
  try {
    if (fresh)
      await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [
        process.env.DB_ROOT_PASSWORD,
      ]);
    const name = process.env.DB_NAME || "geuncha",
      user = process.env.DB_USER || "geuncha";
    if (!/^[a-zA-Z0-9_]+$/.test(name) || !/^[a-zA-Z0-9_]+$/.test(user))
      throw new Error("Invalid database or user name.");
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query("CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?", [
      user,
      "127.0.0.1",
      process.env.DB_PASSWORD,
    ]);
    await connection.query(`GRANT ALL PRIVILEGES ON \`${name}\`.* TO ?@?`, [
      user,
      "127.0.0.1",
    ]);
    console.log(
      `MariaDB ready on 127.0.0.1:${rootOptions.port}. Existing data preserved.`,
    );
  } finally {
    await connection.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await prepareEnv();
  await portableDb();
}
