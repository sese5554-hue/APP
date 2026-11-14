import {
  access,
  mkdir,
  readFile,
  writeFile,
  cp,
  readdir,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { root, run, npm } from "./process.mjs";
import {
  installerInputPaths,
  containedPath,
  validateBundleFiles,
  downloadVerified,
  sha256,
} from "./installer-utils.mjs";
process.chdir(root);
if (process.platform !== "win32" || process.arch !== "x64")
  throw new Error("Build this installer on Windows x64.");
const lock = JSON.parse(await readFile("installer/runtime-lock.json", "utf8")),
  pkg = JSON.parse(await readFile("package.json", "utf8"));
const cache = containedPath(
    root,
    path.join(root, ".runtime", "installer-cache"),
  ),
  tools = containedPath(root, path.join(root, ".runtime", "installer-tools")),
  payload = containedPath(
    root,
    path.join(root, ".runtime", "installer-build", randomUUID()),
  ),
  output = containedPath(root, path.join(root, "releases"));
await Promise.all(
  [cache, tools, payload, output].map((directory) =>
    mkdir(directory, { recursive: true }),
  ),
);
const compilerInstaller = path.join(
    cache,
    `innosetup-${lock.compiler.version}.exe`,
  ),
  vcRedist = path.join(cache, "vc_redist.x64.exe"),
  nodeZip = path.join(cache, `node-v${lock.node.version}-win-x64.zip`),
  mariaZip = path.join(cache, `mariadb-${lock.mariadb.version}-winx64.zip`);
async function download(url, target) {
  try {
    await access(target);
    return;
  } catch {}
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download ${response.status}: ${url}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}
async function verifySignature(file, publisher) {
  const escaped = file.replaceAll("'", "''"),
    expected = publisher.replaceAll("'", "''");
  await run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `$signature=Get-AuthenticodeSignature -LiteralPath '${escaped}'; if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '${expected}') { throw 'Official tool signature verification failed' }; Write-Output 'Verified publisher signature'`,
  ]);
}
async function extract(archive, destination) {
  await mkdir(destination, { recursive: true });
  await run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${destination.replaceAll("'", "''")}' -Force`,
  ]);
}
console.log(
  "Preparing official Node.js, MariaDB, Microsoft runtime and installer compiler...",
);
const sumsResponse = await fetch(lock.mariadb.checksums);
if (!sumsResponse.ok)
  throw new Error("Could not get official MariaDB checksums.");
const mariaName = new URL(lock.mariadb.url).pathname.split("/").at(-1),
  mariaHash = (await sumsResponse.text())
    .split("\n")
    .find((line) => line.trim().endsWith(mariaName))
    ?.trim()
    .split(/\s+/)[0];
if (!/^[a-f0-9]{64}$/i.test(mariaHash || ""))
  throw new Error("Official MariaDB checksum not found.");
// Reuse only the previously checksum-verified archive, never the current DB or configuration.
try {
  await access(mariaZip);
} catch {
  const existing = path.join(
    root,
    ".runtime",
    `mariadb-${lock.mariadb.version}.zip`,
  );
  try {
    if (sha256(await readFile(existing)) === mariaHash)
      await cp(existing, mariaZip);
  } catch {}
}
await Promise.all([
  downloadVerified(lock.node.url, nodeZip, lock.node.sha256),
  downloadVerified(lock.mariadb.url, mariaZip, mariaHash),
  download(lock.compiler.url, compilerInstaller),
  download(lock.visualCpp.url, vcRedist),
]);
await verifySignature(compilerInstaller, "Pyrsys|Jordan Russell");
await verifySignature(vcRedist, "Microsoft Corporation");
const compilerDir = path.join(tools, "InnoSetup"),
  compiler = path.join(compilerDir, "ISCC.exe");
try {
  await access(compiler);
} catch {
  console.log("Installing the compiler into the workspace tool directory...");
  await run(compilerInstaller, [
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART",
    "/CURRENTUSER",
    "/NOICONS",
    `/DIR=${compilerDir}`,
  ]);
}
await npm(["run", "build"]);
console.log("Staging application files and production dependencies...");
for (const relative of installerInputPaths)
  await cp(path.join(root, relative), path.join(payload, relative), {
    recursive: true,
  });
await npm(["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
  cwd: payload,
});
const nodeExtract = path.join(cache, `node-${lock.node.version}`),
  mariaExtract = path.join(cache, `mariadb-${lock.mariadb.version}`);
try {
  await access(
    path.join(nodeExtract, `node-v${lock.node.version}-win-x64`, "node.exe"),
  );
} catch {
  await extract(nodeZip, nodeExtract);
}
try {
  await access(
    path.join(
      mariaExtract,
      `mariadb-${lock.mariadb.version}-winx64`,
      "bin",
      "mariadbd.exe",
    ),
  );
} catch {
  await extract(mariaZip, mariaExtract);
}
await mkdir(path.join(payload, "runtime"), { recursive: true });
await cp(
  path.join(nodeExtract, `node-v${lock.node.version}-win-x64`, "node.exe"),
  path.join(payload, "runtime", "node.exe"),
);
await cp(
  path.join(nodeExtract, `node-v${lock.node.version}-win-x64`, "LICENSE"),
  path.join(payload, "runtime", "NODE-LICENSE.txt"),
);
await cp(
  path.join(mariaExtract, `mariadb-${lock.mariadb.version}-winx64`),
  path.join(payload, ".runtime", `mariadb-${lock.mariadb.version}-winx64`),
  { recursive: true },
);
await mkdir(path.join(payload, "scripts"), { recursive: true });
for (const name of [
  "installed-start.mjs",
  "process.mjs",
  "env.mjs",
  "portable-db.mjs",
  "launcher-health.mjs",
  "mobile-network.mjs",
  "serve.mjs",
])
  await cp(
    path.join(root, "scripts", name),
    path.join(payload, "scripts", name),
  );
for (const name of ["Geuncha.cmd", "Geuncha-Mobile.cmd"])
  await cp(path.join(root, "installer", name), path.join(payload, name));
await mkdir(path.join(payload, "prerequisites"), { recursive: true });
await cp(vcRedist, path.join(payload, "prerequisites", "vc_redist.x64.exe"));
await cp(
  path.join(root, "installer", "INSTALL-NOTICE.txt"),
  path.join(payload, "INSTALL-NOTICE.txt"),
);
await writeFile(
  path.join(payload, "THIRD-PARTY-NOTICES.txt"),
  `Bundled Node.js ${lock.node.version}: https://nodejs.org/ (runtime/NODE-LICENSE.txt)\nBundled MariaDB ${lock.mariadb.version}: ${lock.mariadb.url} (see .runtime/mariadb-${lock.mariadb.version}-winx64/COPYING and THIRDPARTY)\nMicrosoft Visual C++ Redistributable: ${lock.visualCpp.url} (Microsoft runtime installer terms apply)\nNode.js package licenses are shipped inside node_modules.\n`,
);
const files = [];
async function list(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      await list(path.join(directory, entry.name), relative);
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unexpected symbolic link in installer: ${relative}`);
  }
}
await list(payload);
validateBundleFiles(files);
const manifest = {
  version: pkg.version,
  node: lock.node.version,
  mariadb: lock.mariadb.version,
  sourceCommit: process.env.GEUNCHA_SOURCE_COMMIT || "working-tree",
  fileCount: files.length,
  runtimeChecksums: {
    node: lock.node.sha256,
    mariadb: mariaHash,
    visualCpp: sha256(await readFile(vcRedist)),
  },
  files,
};
await writeFile(
  path.join(payload, "installer-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Compiling ${files.length} allowlisted files. No existing .env, DB, uploads or logs included.`,
);
await run(compiler, [
  "/Qp",
  `/DPayloadDir=${payload}`,
  `/DAppVersion=${pkg.version}`,
  `/DOutputDir=${output}`,
  path.join(root, "installer", "geuncha.iss"),
]);
const name = `Geuncha-Setup-${pkg.version}-win-x64.exe`,
  exe = path.join(output, name),
  checksum = sha256(await readFile(exe));
await writeFile(path.join(output, `${name}.sha256`), `${checksum}  ${name}\n`);
await writeFile(
  path.join(output, "build-manifest.json"),
  JSON.stringify(
    {
      ...manifest,
      files: undefined,
      installer: name,
      sha256: checksum,
      payload,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Installer ready: ${exe}\nSHA256: ${checksum}`);
