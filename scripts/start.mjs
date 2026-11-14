import { access } from "node:fs/promises";
import { root, npm, run } from "./process.mjs";
import { prepareEnv } from "./env.mjs";
process.chdir(root);
try {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12))
    throw new Error("Node.js 22.12+ is required.");
  await prepareEnv();
  try {
    await access("node_modules/.package-lock.json");
  } catch {
    await npm(["ci"]);
  }
  const index = process.argv.indexOf("--db"),
    mode = index >= 0 ? process.argv[index + 1] : "existing";
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
  await npm(["run", "db:migrate"]);
  if (process.env.NODE_ENV === "development") await npm(["run", "db:seed"]);
  if (!process.argv.includes("--setup-only")) await npm(["run", "dev"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
