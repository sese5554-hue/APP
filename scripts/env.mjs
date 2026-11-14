import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { root } from "./process.mjs";
export async function prepareEnv() {
  const file = path.join(root, ".env");
  try {
    await access(file);
  } catch {
    const template = await readFile(path.join(root, ".env.example"), "utf8");
    await writeFile(
      file,
      template
        .replace("replace-with-local-password", randomBytes(24).toString("hex"))
        .replace(
          "replace-with-local-root-password",
          randomBytes(24).toString("hex"),
        ),
      { mode: 0o600, flag: "wx" },
    );
    console.log(
      "Created local .env with random DB credentials; existing settings are preserved.",
    );
  }
  process.loadEnvFile(file);
  await mkdir(path.join(root, ".runtime"), { recursive: true });
}
