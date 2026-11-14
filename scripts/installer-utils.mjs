import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export const installerInputPaths = [
  "dist/api",
  "dist/web",
  "database/migrations",
  ".env.example",
  "package.json",
  "package-lock.json",
];
export function containedPath(root, target) {
  const base = path.resolve(root),
    resolved = path.resolve(target),
    relative = path.relative(base, resolved);
  if (
    !relative ||
    relative.startsWith(".." + path.sep) ||
    relative === ".." ||
    path.isAbsolute(relative)
  )
    throw new Error(
      "Installer staging target must be a child of the workspace.",
    );
  return resolved;
}
export function validateBundleFiles(files) {
  for (const name of files) {
    const normalized = name.replaceAll("\\", "/");
    if (
      normalized
        .split("/")
        .some((part) => part === ".." || part === ".git" || part === ".aws") ||
      (/(^|\/)\.env($|\.)/.test(normalized) &&
        !normalized.endsWith("/.env.example") &&
        normalized !== ".env.example") ||
      /(^|\/)\.runtime\/(?:mariadb-data|uploads|qa)(\/|$)/.test(normalized)
    )
      throw new Error(`Private data must not be packaged: ${name}`);
  }
}
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export async function downloadVerified(url, target, expectedHash) {
  try {
    const bytes = await readFile(target);
    if (sha256(bytes) === expectedHash) return;
  } catch {}
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Download failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== expectedHash)
    throw new Error("Downloaded runtime checksum mismatch.");
  await writeFile(target, bytes);
}
