import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { screenImplementations } from "./screen-implementation-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "docs", "implementation");
const moduleFiles = {
  Auth: "apps/web/src/pages/Auth.tsx",
  Guest: "apps/web/src/pages/Guest.tsx",
  Shared: "apps/web/src/pages/Shared.tsx",
  Host: "apps/web/src/pages/Host.tsx",
};
const guest = new Set([1, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 45, 48]);
const host = new Set([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 49, 50, 51]);
const auth = new Set([0, 2, 3, 4, 5, 6, 7]);
const groupNames = {
  auth: "회원가입·로그인",
  guest: "게스트",
  shared: "공용",
  host: "호스트",
};
const routeFiles = [
  "auth/routes.ts",
  "vehicles/routes.ts",
  "bookings/routes.ts",
  "shared/chat.ts",
  "shared/inspections.ts",
  "shared/account.ts",
  "shared/uploads.ts",
  "host/routes.ts",
].map((file) => `apps/api/src/modules/${file}`);
const frontNeedles = {
  0: 'const value = await api("/consents", "POST", {',
  2: 'sessionStorage.setItem("signupRole", role);',
  3: 'const logged = await api("/auth/login", "POST", d);',
  4: 'await api("/auth/signup", "POST", {',
  5: 'await api("/verifications/identity", "POST", d);',
  6: 'void api("/verifications/neighborhood", "POST", {',
  7: 'await api("/verifications/license", "POST", d);',
  9: "<GeoMap vehicles={vehicles.data?.items ?? []} onBounds={setBbox} />",
  11: 'submit="필터 적용하고 차량 보기"',
  13: 'title="차량 세부 정보"',
  14: 'const start = new Date(d.startsAt + ":00+09:00").toISOString(),',
  15: "<Quote period={period} onLoad={setQuote} />",
  16: "const booking = await api<Booking>(",
  17: "screen === 17",
  20: 'phase === "pickup"',
  21: 'phase === "pickup"',
  35: 'await api(`/host/bookings/${b.id}/approve`, "POST");',
  37: 'const role = host ? "guest" : "host";',
  47: "{host && (",
  48: 'title="안심하고 이용할 보험"',
};

export async function syncScreenImplementation(check = false) {
  const cache = new Map();
  async function source(file) {
    if (!cache.has(file))
      cache.set(file, await readFile(path.join(root, file), "utf8"));
    return cache.get(file);
  }
  async function locate(file, needle) {
    const text = await source(file);
    const at = text.indexOf(needle);
    assert.ok(at >= 0, `Missing source anchor: ${file}: ${needle}`);
    const line = text.slice(0, at).split("\n").length;
    return { file, line, label: `${file}:${line}`, text };
  }
  const routes = new Map();
  for (const file of routeFiles) {
    const text = await source(file);
    for (const match of text.matchAll(
      /\b\w+Routes\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g,
    )) {
      const key = `${match[1].toUpperCase()} ${match[2]}`;
      assert.ok(!routes.has(key), `Duplicate route: ${key}`);
      routes.set(key, { file, needle: match[0] });
    }
  }
  const schema = new Map();
  for (const file of [
    "database/migrations/001_initial.sql",
    "database/migrations/002_chat_and_setup.sql",
  ]) {
    for (const match of (await source(file)).matchAll(
      /CREATE TABLE IF NOT EXISTS (\w+)/g,
    ))
      schema.set(match[1], await locate(file, match[0]));
  }
  const manifest = JSON.parse(await source("docs/screen-manifest.json"));
  const stages = JSON.parse(
    await source("docs/implementation-status.json"),
  ).stages;
  assert.deepEqual(
    screenImplementations.map((item) => item.number),
    Array.from({ length: 52 }, (_, i) => i),
  );
  const stageFor = (number) =>
    stages.find((stage) => stage.screens.includes(number));
  const files = [];
  if (!check) await mkdir(output, { recursive: true });
  async function emit(filename, content) {
    files.push(filename);
    const target = path.join(output, filename);
    if (check)
      assert.equal(
        await readFile(target, "utf8"),
        content,
        `Implementation document is stale: ${filename}. Run node scripts/generate-docs.mjs`,
      );
    else await writeFile(target, content, "utf8");
  }
  function excerpt(ref) {
    // 실제 소스 줄을 그대로 발췌해 문서와 코드의 차이를 검사한다.
    const lines = ref.text.split(/\r?\n/);
    const part = lines.slice(ref.line - 1, ref.line + 10);
    const nextRoute = part.findIndex(
      (line, i) =>
        i > 0 && /^\w+Routes\.(get|post|put|patch|delete)\(/.test(line),
    );
    return part
      .slice(0, nextRoute < 0 ? part.length : nextRoute)
      .map((line, i) => `${ref.line + i} | ${line}`.trimEnd())
      .join("\n");
  }
  const commonRefs = await Promise.all(
    [
      ["apps/web/src/main.tsx", "function App()"],
      ["apps/web/src/api.ts", "export async function api"],
      ["apps/web/src/components.tsx", "export function useData"],
      ["apps/api/src/database/db.ts", "export async function transaction"],
      ["packages/contracts/index.ts", "import"],
    ].map(([file, needle]) => locate(file, needle)),
  );
  for (const item of screenImplementations) {
    const page = manifest[item.number];
    assert.equal(page.number, item.number);
    const components = item.component.split(" / ");
    const moduleName = auth.has(item.number)
      ? "Auth"
      : guest.has(item.number) || item.number === 35
        ? "Guest"
        : host.has(item.number)
          ? "Host"
          : "Shared";
    const frontFile = moduleFiles[moduleName];
    const componentRefs = await Promise.all(
      components.map((component) =>
        locate(frontFile, `function ${component}(`),
      ),
    );
    const front = await locate(
      frontFile,
      frontNeedles[item.number] ?? `function ${components[0]}(`,
    );
    assert.ok(item.apis.length > 0);
    const apiRefs = await Promise.all(
      item.apis.map(async (endpoint) => {
        const registered = routes.get(endpoint);
        assert.ok(
          registered,
          `Screen ${page.id}: API does not exist: ${endpoint}`,
        );
        return {
          endpoint,
          ...(await locate(registered.file, registered.needle)),
        };
      }),
    );
    const tables = item.tables.filter(Boolean);
    for (const table of tables)
      assert.ok(schema.has(table), `Screen ${page.id}: unknown table ${table}`);
    const extras = await Promise.all(
      item.extra.map(([file, needle]) => locate(file, needle)),
    );
    const integration = auth.has(item.number)
      ? "auth"
      : guest.has(item.number)
        ? "bookings"
        : host.has(item.number) || item.number === 35
          ? "host"
          : "shared";
    const tests = [
      `tests/integration/${integration}.test.ts`,
      "tests/e2e/app.spec.ts",
    ];
    for (const file of tests) await source(file);
    const stage = stageFor(item.number);
    assert.ok(stage, `Missing implementation stage: ${page.id}`);
    const reused =
      {
        Search:
          "홈·지도·검색결과·필터가 Search와 하나의 차량 목록 API를 공유한다. 필터를 URL에 표현해 별도 저장소 없이 화면 사이에 전달한다.",
        VehicleDetail:
          "12·13은 같은 차량 상세 DTO를 표시 방식만 바꿔 사용한다. 사양 조회용 중복 API를 만들지 않았다.",
        Reservation:
          "14·15·16·48은 Reservation과 Quote를 공유하며 같은 기간·보험을 URL로 전달한다. 서버 견적을 재계산해 별도 견적 저장 테이블을 생략했다.",
        BookingDetail:
          "17·18과 호스트 35는 BookingDetail을 공유한다. host 플래그와 실제 예약 상태로 API·버튼을 선택한다.",
        Inspection:
          "20·21은 phase만 다른 Inspection/InspectionForm과 PhotoGrid를 공유한다. 임시 저장과 제출은 같은 PUT API의 draft로 구분한다.",
        Profile:
          "37·47은 Profile의 host 표시 옵션을 공유하고 같은 역할 전환·로그아웃 처리를 사용한다.",
        AuthPage:
          "약관·가입·로그인·인증을 AuthPage에서 화면 번호로 분기하고 공통 Form·Input·api를 재사용한다.",
      }[components[0]] ??
      `${components[0]} 컴포넌트에서 공통 api·Form·useData/Load를 필요한 곳에 재사용한다. 서버는 명시적 라우터와 SQL로 처리한다.`;
    const filename = path.basename(page.document);
    const content = `근차 화면 ${page.id} 구현 설명: ${page.title}
분류: ${groupNames[page.group]}
화면 경로: /screens/${page.id}
최초 기능 구현: [${stage.number}] ${stage.title} / 커밋 ${stage.commit}
기준: 실제 소스코드. 기획 요구사항은 ../${page.document}에서 별도로 읽는다.
원본 화면: ../../${page.source}
문서의 소스 경로는 저장소 루트 기준이며 :숫자는 해당 줄이다.

1. 화면 진입과 연결 구조
- apps/web/src/main.tsx의 App이 URL 화면 번호로 기능 모듈을 선택한다.
- 실제 화면 컴포넌트: ${item.component} (${moduleName}.tsx).
${componentRefs.map((ref) => `- 컴포넌트 정의: ${ref.label}`).join("\n")}
- vehicle은 차량 ID, booking은 예약 ID, startsAt/endsAt는 UTC 기간, insuranceId는 선택 보험이다. 필요한 값은 이전 화면 선택으로 전달한다. 리소스 UUID를 문서의 예시 문자열로 대체하지 않는다.
- go는 기존 URL 검색값을 유지하고 전달된 null 키만 제거한다. 앱 시작 시 /api/auth/me로 사용자 세션을 복원한다.

2. 화면별 구현 흐름
${item.flow.map((text, i) => `${i + 1}) ${text}`).join("\n")}

3. 실제 백엔드 주요 API와 소스 위치
${apiRefs.map((ref) => `- ${ref.endpoint.replace(" /", " /api/")}\n  구현: ${ref.label}`).join("\n")}
${[
  item.number >= 5 && item.number <= 7
    ? `- 이 화면의 :kind는 ${["identity", "neighborhood", "license"][item.number - 5]}이다.`
    : "",
  item.number === 20 || item.number === 21
    ? `- 이 화면의 :phase는 ${item.number === 20 ? "pickup" : "return"}이다.`
    : "",
  item.number === 35
    ? "- :action은 approve 또는 reject이며 임의 상태 문자열을 허용하지 않는다."
    : "",
]
  .filter(Boolean)
  .join("\n")}
- 위 목록은 이 화면 및 연결 처리에서 사용하는 실제 등록 경로다. 조건에 따라 호출하며 화면 진입 때 모두 호출하지는 않는다.
- 일반 JSON 응답은 {data}, 오류는 {error:{code,message,fields?,requestId}}. /events는 SSE, /uploads/:id는 이미지 응답이다.
- 공통 api 함수가 /api 접두어·동일 출처 쿠키·X-Geuncha-Request 헤더를 처리한다. 폼은 처리 중 상태와 서버 오류를 표시하며 useData/Load는 조회 상태와 재시도를 담당한다.

4. MariaDB 읽기·쓰기와 권한
${tables.length ? tables.map((table) => `- ${table}: ${schema.get(table).label}`).join("\n") : "- 이 화면의 FAQ 조회는 메모리 상수 배열을 사용하며 업무용 DB 읽기·쓰기가 없다."}
${tables.length ? "- 위 테이블은 조회·연결·검증에 참여하는 테이블이며 모두 수정한다는 뜻은 아니다. 실제 쓰기 및 상태 변경은 2절의 흐름을 따른다." : "- 공통 세션 복원은 앱 기반 처리이며 FAQ 업무 데이터 저장과는 별개다."}
- 사용자 ID와 권한은 서버 세션에서 결정한다. 보호 업무의 소유권·예약 참여자·상태 검사는 각 라우터와 서비스에서 수행한다. 공개 조회는 해당 라우터의 공개 조건을 따른다.

5. 실제 코드 발췌와 읽는 방법
프론트엔드: ${front.label}
${excerpt(front)}
읽는 방법: 이 부분을 포함한 ${item.component}에서 입력/선택 상태와 이동을 추적하고, 2절의 순서로 API 호출을 확인한다.

백엔드: ${apiRefs[0].label}
${excerpt(apiRefs[0])}
읽는 방법: 요청 검증·세션 확인에서 시작해 2절의 조회/트랜잭션/응답을 따라간다. 라우터의 전체 함수가 아니라 시작 부분을 발췌했다.
${extras.map((ref) => `\n관련 핵심 코드: ${ref.label}\n${excerpt(ref)}\n읽는 방법: ${ref.file}의 해당 함수 전체를 화면별 흐름과 함께 읽는다.\n`).join("")}

6. SOLID·KISS·YAGNI 적용 구분
- SOLID / 책임 분리(SRP): ${item.component} 컴포넌트는 화면 입력과 표시를 담당하고 ${apiRefs[0].file}는 해당 요청을 처리한다. UI에서 SQL을 실행하지 않고 필요한 검증·권한·상태 처리를 서버에 둔다.
- SOLID / 의존 방향: 결제 서비스는 PaymentProvider를 생성자로 받으며 개발·미설정 공급자를 구분한다. 이 화면이 외부 인증/분석을 호출할 때도 providers 경계를 사용한다. 공급자 호출이 없는 조회 화면에 불필요한 공급자 계층을 추가하지 않는다. 다섯 원칙의 공통 적용 설명은 ../04_SOLID_KISS_YAGNI.txt를 참조한다.
- KISS / 구현 단순화: ${reused}
- YAGNI / 범위 제한: 이 화면의 현재 기능은 2절까지이며, 8절의 미연동·미구현 기능을 완료로 표시하지 않는다. 요구되지 않은 관리자·포인트·독립 마이크로서비스는 추가하지 않았다.

7. 확인 방법과 검증 근거
- 화면별 확인 시나리오: ${item.check}
${tests.map((file) => `- 관련 자동 검증 소스: ${file}`).join("\n")}
- e2e의 52개 화면 시나리오는 렌더링·런타임 오류·가로 넘침 검사이며 모든 버튼·역할·업무 상태를 각각 검증하는 테스트는 아니다.
- 위 확인 시나리오는 수동 확인 지침이며 이번 문서 작업에서 새로 실행한 결과를 뜻하지 않는다. 기존 자동 검증 결과와 이번 실행 기록은 ../08_실제구현.txt에서 구분한다.
- 문서 재생성: node scripts/generate-docs.mjs
- 문서 검사: node scripts/check-docs.mjs (52개 설명·소스 줄·실제 API·테이블·발췌 최신성 포함).
- 업무 검증 명령: npm run typecheck / npm test / npm run test:integration / npm run test:e2e. 통합 테스트는 별도 *_test DB를 사용한다.

8. 현재 구현 범위와 한계
${item.limitation}
실제 외부 서비스 연동 상태는 ../implementation-status.json의 limitations와 ../09_API_실행계약.txt를 함께 확인한다.

9. 공통 코드를 함께 읽을 위치
${commonRefs.map((ref) => `- ${ref.label}`).join("\n")}
관련 화면: ${page.related.map((number) => String(number).padStart(2, "0")).join(", ")}. 화면별 구현 설명 목록은 README.txt를 참조한다.
`;
    await emit(filename, content);
  }
  await emit(
    "README.txt",
    `근차 00~51 화면별 실제 구현 설명 목록

총 52개 화면. 각 TXT는 기획 프롬프트 대신 현재 코드의 동작·API·DB·코드 발췌·설계 원칙·확인 방법·한계를 설명한다.
화면 명세/요구사항은 ../pages, 실제 구현 설명은 이 폴더로 구분한다.
먼저 화면을 고른 다음 해당 컴포넌트와 API 소스를 따라 읽는다. 여러 화면이 하나의 컴포넌트를 공유할 수 있다.

${manifest.map((page) => `${page.id}. [${groupNames[page.group]}] ${page.title}\n    ${path.basename(page.document)}`).join("\n\n")}

갱신: scripts/screen-implementation-data.mjs의 화면 설명을 실제 코드에 맞게 수정한 뒤 node scripts/generate-docs.mjs 실행.
검사: node scripts/check-docs.mjs. 경로·함수 앵커·API 등록·테이블 존재와 생성 결과의 최신성을 확인한다.
소스 줄은 재생성 시점 기준이며 설명의 업무 의미는 코드 변경 시 함께 검토해야 한다.
사용 도구: Node.js fs/path/assert 기반 생성·검사, PowerShell/rg 소스 대조, Prettier 형식 정리. 새 패키지나 외부 서비스는 도입하지 않았다.
`,
  );
  const actual = (await readdir(output))
    .filter((file) => file.endsWith(".txt"))
    .sort();
  assert.deepEqual(
    actual,
    files.sort(),
    "Unexpected or missing implementation TXT files",
  );
  console.log(
    `${check ? "PASS" : "Generated"}: 52 screen implementation TXT files and index; actual API/table/source anchors checked.`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await syncScreenImplementation(process.argv.includes("--check"));
