import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import {
  probeApp,
  portInUse,
  waitForApp,
} from "../scripts/launcher-health.mjs";
import { redact, root } from "../scripts/process.mjs";

test("실행 확인은 근차 HTML과 MariaDB health를 모두 검증한다", async () => {
  let ready = false,
    ours = true;
  const server = createServer((req, res) => {
    if (req.url === "/api/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          data: { status: ready ? "ok" : "starting", database: "mariadb" },
        }),
      );
    } else
      res.end(
        `<html><title>${ours ? "근차 · 내 동네 차량 공유" : "다른 앱"}</title></html>`,
      );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port,
    url = `http://127.0.0.1:${port}`;
  try {
    assert.equal(await portInUse(port), true);
    assert.equal(await probeApp(url, url + "/api/health"), false);
    ready = true;
    assert.equal(await probeApp(url, url + "/api/health"), true);
    await waitForApp(url, url + "/api/health", 500);
    ours = false;
    assert.equal(await probeApp(url, url + "/api/health"), false);
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
      waitForApp(url, url + "/api/health", 500, cancelled.signal),
      { name: "AbortError" },
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  assert.equal(await portInUse(port), false);
});
test("오류 로그에서 비밀번호·외부 토큰을 제거한다", () => {
  const previous = process.env.GEUNCHA_TEST_PASSWORD;
  process.env.GEUNCHA_TEST_PASSWORD = "test-local-secret";
  try {
    assert.equal(redact("failed: test-local-secret"), "failed: [REDACTED]");
  } finally {
    if (previous === undefined) delete process.env.GEUNCHA_TEST_PASSWORD;
    else process.env.GEUNCHA_TEST_PASSWORD = previous;
  }
});
test("개발 서버 자식 프로세스의 실패를 종료 코드 1로 전달한다", async () => {
  await mkdir(path.join(root, ".runtime"), { recursive: true });
  const directory = await mkdtemp(
      path.join(root, ".runtime", "launcher-test-"),
    ),
    entry = path.join(directory, "npm-cli.mjs");
  await writeFile(entry, "process.exit(1);\n");
  try {
    const child = spawn(process.execPath, ["scripts/dev.mjs"], {
      cwd: root,
      env: { ...process.env, npm_execpath: entry },
      stdio: "ignore",
      windowsHide: true,
    });
    const timeout = setTimeout(() => child.kill(), 8000);
    try {
      const [code] = await once(child, "exit");
      assert.equal(code, 1);
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    await unlink(entry);
    await rmdir(directory);
  }
});
