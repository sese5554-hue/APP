import test from "node:test";
import assert from "node:assert/strict";
import {
  isAppProcess,
  isPortableDatabase,
  selectAppRoots,
} from "../scripts/stop-processes.mjs";

const root = "C:\\Work Space\\geuncha";
const record = (
  ProcessId: number,
  ParentProcessId: number,
  CommandLine: string,
  more = {},
) => ({
  ProcessId,
  ParentProcessId,
  CommandLine,
  Name: "node.exe",
  ExecutablePath: "C:\\Program Files\\nodejs\\node.exe",
  StartedTicks: String(1000 + ProcessId),
  ...more,
});
const vite = (base = root) =>
  `node "${base}\\node_modules\\.bin\\..\\vite\\bin\\vite.js" --config apps/web/vite.config.ts`;

test("종료 대상은 현재 폴더의 실제 Vite/tsx와 확인된 실행기 조상으로 제한한다", () => {
  const rows = [
    record(1, 0, "node codex.js"),
    record(2, 1, "node scripts/start.mjs --db portable --lan"),
    record(3, 2, 'node "C:\\nodejs\\npm-cli.js" run dev'),
    record(4, 3, 'cmd.exe /d /s /c "node scripts/dev.mjs"', {
      Name: "cmd.exe",
    }),
    record(5, 4, "node scripts/dev.mjs"),
    record(6, 5, 'node "C:\\nodejs\\npm-cli.js" run dev:web'),
    record(7, 6, 'cmd.exe /d /s /c "vite --config apps/web/vite.config.ts"', {
      Name: "cmd.exe",
    }),
    record(8, 7, vite()),
    record(
      9,
      5,
      `node "${root}\\node_modules\\tsx\\dist\\cli.mjs" watch apps/api/src/server.ts`,
    ),
    record(10, 1, vite(root + "-other")),
    record(11, 1, `node "${root}\\scripts\\stop.mjs"`),
    record(
      12,
      1,
      `node "${root}\\node_modules\\tsx\\dist\\cli.mjs" tests/integration/auth.test.ts`,
    ),
    record(
      13,
      9,
      `node --require "${root}\\node_modules\\tsx\\dist\\preflight.cjs" apps/api/src/server.ts`,
    ),
  ];
  assert.deepEqual(
    selectAppRoots(rows, root).map((item) => item.ProcessId),
    [2],
  );
  assert.equal(isAppProcess(rows[9], root), false);
  assert.equal(isAppProcess(rows[10], root), false);
  assert.equal(isAppProcess(rows[11], root), false);
});

test("부모 PID가 재사용됐거나 알 수 없는 프로세스이면 그 위로 종료 범위를 넓히지 않는다", () => {
  const seed = record(3, 2, vite());
  assert.deepEqual(
    selectAppRoots(
      [record(2, 1, "node scripts/start.mjs", { StartedTicks: "99999" }), seed],
      root,
    ).map((item) => item.ProcessId),
    [3],
  );
  assert.deepEqual(
    selectAppRoots([record(2, 1, "node unrelated-server.js"), seed], root).map(
      (item) => item.ProcessId,
    ),
    [3],
  );
  assert.deepEqual(selectAppRoots([], root), []);
});

test("로컬 DB는 현재 폴더의 MariaDB 바이너리와 정확한 datadir가 모두 일치해야 한다", () => {
  const database = record(
    20,
    1,
    `mariadbd.exe --datadir="${root}\\.runtime\\mariadb-data" --port=3307`,
    {
      Name: "mariadbd.exe",
      ExecutablePath: `${root}\\.runtime\\mariadb-11.4.5-winx64\\bin\\mariadbd.exe`,
    },
  );
  assert.equal(isPortableDatabase(database, root), true);
  assert.equal(
    isPortableDatabase(
      {
        ...database,
        CommandLine: database.CommandLine.replace(
          "mariadb-data",
          "mariadb-data-other",
        ),
      },
      root,
    ),
    false,
  );
  assert.equal(
    isPortableDatabase(
      { ...database, ExecutablePath: "C:\\MariaDB\\bin\\mariadbd.exe" },
      root,
    ),
    false,
  );
  assert.equal(isPortableDatabase(database, root + "-other"), false);
});

test("설치본의 번들 Node와 현재 폴더의 절대 경로 실행은 식별하고 다른 설치본은 제외한다", () => {
  const installed = record(1, 0, "node scripts/serve.mjs", {
    ExecutablePath: `${root}\\runtime\\node.exe`,
  });
  assert.equal(isAppProcess(installed, root), true);
  assert.equal(isAppProcess(installed, root + "-other"), false);
  assert.equal(
    isAppProcess(record(2, 0, `node "${root}\\scripts\\serve.mjs"`), root),
    true,
  );
});
