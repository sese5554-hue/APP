import { test, expect, type Page } from "@playwright/test";
const headers = { "X-Geuncha-Request": "1" };
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
test("게스트 화면에서 검색·보험 견적·예약 요청·호스트 승인·개발 결제", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page
    .getByRole("button", { name: /현대 아반떼/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "현대 아반떼 1.6" }),
  ).toBeVisible();
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
