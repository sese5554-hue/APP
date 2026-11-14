import { test, expect, type Page } from "@playwright/test";
const headers = { "X-Geuncha-Request": "1" };
// Reproduce mobile LAN HTTP, where randomUUID is unavailable.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
  });
});
async function login(page: Page, id = "guestdemo") {
  await page.goto("/screens/03");
  await page.getByLabel("아이디", { exact: true }).fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill("Geuncha123!");
  await page
    .getByRole("button", { name: "로그인", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/screens\/(08|25)/);
}

test("마이페이지에서 미완료 인증 상태와 본인·동네·면허 바로가기 표시", async ({ page }) => {
  await login(page);
  await page.route("**/api/me/verifications", route => route.fulfill({ json: { data: [] } }));
  for (const [label, screen, title] of [
    ["본인 인증", "05", "본인 확인을 진행해 주세요"],
    ["동네 인증", "06", "내 동네를 확인해요"],
    ["면허 인증", "07", "운전면허 정보를 입력해요"],
  ]) {
    await page.goto("/screens/37");
    const link = page.getByRole("button", { name: new RegExp(label + ".*미완료") });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp("/screens/" + screen));
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});

test("마이페이지 인증 완료 항목 순차 숨김과 만료 항목 재표시", async ({ page }) => {
  await login(page);
  let records: any[] = [];
  await page.route("**/api/me/verifications", route => route.fulfill({ json: { data: records } }));
  const kinds = ["identity", "neighborhood", "license"];
  const labels = ["본인 인증", "동네 인증", "면허 인증"];
  for (let completed = 0; completed <= 3; completed++) {
    records = kinds.slice(0, completed).map(kind => ({ kind, status: "success", mode: "development", expiresAt: "2099-01-01 00:00:00" }));
    await page.goto("/screens/37");
    await expect(page.locator("main .skeleton")).toHaveCount(0);
    for (let index = 0; index < 3; index++) {
      await expect(page.getByRole("button", { name: new RegExp("^" + labels[index]) })).toHaveCount(index < completed ? 0 : 1);
    }
    await expect(page.getByRole("heading", { name: "예약을 위한 인증" })).toHaveCount(completed === 3 ? 0 : 1);
  }
  records[1].expiresAt = "2000-01-01 00:00:00";
  await page.goto("/screens/37");
  await expect(page.getByRole("button", { name: /^동네 인증/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^본인 인증/ })).toHaveCount(0);
});

test("렌더링 오류 안내 후 첫 화면 복귀", async ({ page }) => {
  await login(page);
  await page.route("**/api/me/conversations?**", route => route.fulfill({ json: { data: { length: 1 } } }));
  await page.goto("/screens/44?booking=old");
  await expect(page.getByRole("alert")).toContainText("오류가 발생했습니다");
  await expect(page).toHaveURL(/\/screens\/00\?recovered=1$/);
  await expect(page.getByRole("status")).toContainText("첫 번째 화면으로 돌아왔습니다");
});

test("처리되지 않은 실행 오류와 요청 시간 초과 시 첫 화면 복귀", async ({ page }) => {
  await login(page);
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent("error", { error: new Error("test failure") })));
  await expect(page.getByRole("alert")).toContainText("오류가 발생했습니다");
  await expect(page).toHaveURL(/\/screens\/00\?recovered=1$/);
  await page.goto("/screens/44");
  await page.getByRole("heading", { name: "이웃과 나눈 이야기" }).waitFor();
  await page.clock.install();
  await page.route("**/api/me/conversations?**", () => {});
  await page.getByLabel("이름이나 차량").fill("응답 지연 검사");
  const request = page.waitForRequest("**/api/me/conversations?**");
  await page.getByRole("button", { name: "대화 검색", exact: true }).click();
  await request;
  await page.clock.fastForward(21000);
  await expect(page.getByRole("alert")).toContainText("오류가 발생했습니다");
  await page.clock.fastForward(2100);
  await expect(page).toHaveURL(/\/screens\/00\?recovered=1$/);
});
test("게스트 화면에서 검색·보험 견적·예약 요청·호스트 승인·개발 결제", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.locator(".vehicle-card").first().click();
  await page.getByRole("button", { name: "날짜 선택하고 예약하기" }).click();
  const offset = 10 + Math.floor(Math.random() * 300),
    start =
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10) +
      "T10:00",
    end =
      new Date(Date.now() + (offset + 1) * 86400000)
        .toISOString()
        .slice(0, 10) + "T10:00";
  await page.getByLabel("대여 시작", { exact: true }).fill(start);
  await page.getByLabel("반납 예정", { exact: true }).fill(end);
  await page.getByRole("button", { name: "일정 확인", exact: true }).click();
  await expect(page.getByText("총 결제 금액", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "보험 선택", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "완전자차", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "선택한 보험 · 계속" }).click();
  await page
    .getByRole("button", { name: "결제수단 선택", exact: true })
    .click();
  await page
    .getByRole("button", { name: "호스트에게 예약 요청", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "예약 요청을 보냈어요" }),
  ).toBeVisible();
  const url = new URL(page.url()),
    booking = url.searchParams.get("booking")!;
  const hostContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3001",
  });
  const host = await hostContext.newPage();
  await login(host, "hostdemo");
  const approved = await host.request.post(
    `/api/host/bookings/${booking}/approve`,
    { headers },
  );
  expect(approved.status()).toBe(200);
  await page.goto(`/screens/19?booking=${booking}`);
  await page.locator(".chat-heading h1").waitFor();
  await expect(page.getByText("대화를 불러오는 중…", { exact: true })).toHaveCount(0);
  const send = page.getByRole("button", { name: "메시지 보내기", exact: true });
  const initialY = (await send.boundingBox())!.y;
  for (const content of Array.from({ length: 8 }, (_, index) => `${index + 1}번째 메시지\n긴 메시지를 연속으로 보내도\n입력창과 전송 버튼은\n같은 위치를 유지해야 합니다.`)) {
    await page.getByLabel("메시지", { exact: true }).fill(content);
    await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
    await expect(page.locator(".message p").getByText(content, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeEnabled();
    expect(Math.abs((await send.boundingBox())!.y - initialY)).toBeLessThan(2);
  }
  expect(await page.locator(".messages").evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.setViewportSize({ width: 390, height: 500 });
  await expect(send).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel("메시지", { exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: ".runtime/qa/chat-compact.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".runtime/qa/chat-fixed-composer.png" });
  await page.getByRole("button", { name: "예약 보기", exact: true }).click();
  await page.goto(`/screens/17?booking=${booking}`);
  await page
    .getByRole("button", { name: "예약 상세 보기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "개발 결제하고 예약 확정", exact: true })
    .click();
  await expect(page.getByText("예약 확정", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "예약 취소 · 인수 전 전액 환불" })
    .click();
  await expect(page.getByText("예약 취소", { exact: true })).toBeVisible();
  await hostContext.close();
  expect(errors).toEqual([]);
});
test("52개 화면이 유효한 리소스에서 렌더링되고 런타임 오류와 가로 넘침이 없다", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "hostdemo");
  await page.request.post("/api/me/roles", {
    headers,
    data: { role: "guest" },
  });
  const vehicles = (await (await page.request.get("/api/host/vehicles")).json())
    .data;
  const id = vehicles[0].id;
  const guestContext = await page
    .context()
    .browser()!
    .newContext({ baseURL: "http://127.0.0.1:3001" });
  const guest = await guestContext.newPage();
  await login(guest);
  const methods = (
    await (await guest.request.get("/api/me/payment-methods")).json()
  ).data;
  const offset = 10 + Math.floor(Math.random() * 300),
    period = {
      vehicleId: id,
      startsAt: new Date(Date.now() + offset * 86400000).toISOString(),
      endsAt: new Date(Date.now() + (offset + 1) * 86400000).toISOString(),
      insuranceId: "full",
    };
  const quote = await guest.request.post("/api/bookings/quote", {
    headers,
    data: period,
  });
  expect(quote.status()).toBe(200);
  const request = await guest.request.post("/api/bookings", {
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      ...period,
      quoteTotal: (await quote.json()).data.total,
      paymentMethodId: methods[0].id,
    },
  });
  expect(request.status()).toBe(201);
  const booking = (await request.json()).data.id;
  for (let screen = 0; screen <= 51; screen++) {
    await page.goto(
      `/screens/${String(screen).padStart(2, "0")}?vehicle=${id}&booking=${booking}&startsAt=${encodeURIComponent(period.startsAt)}&endsAt=${encodeURIComponent(period.endsAt)}`,
    );
    await expect(page.locator("main")).not.toBeEmpty();
    await page.waitForTimeout(120);
    await expect(page.getByRole("status", { name: "연결 중…" })).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `horizontal overflow at ${screen}`,
    ).toBe(true);
  }
  const cancelled = await guest.request.post(
    `/api/bookings/${booking}/cancel`,
    { headers },
  );
  expect(cancelled.status()).toBe(200);
  await guestContext.close();
  expect(errors).toEqual([]);
  await page.goto("/screens/08");
  await expect(
    page.getByRole("heading", { name: "내 주변 차량", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".vehicle-card").first()).toBeVisible();
  await page.screenshot({ path: ".runtime/qa/mobile-home.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: ".runtime/qa/desktop-home.png" });
});
