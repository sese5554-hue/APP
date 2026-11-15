import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../../apps/api/src/app.js";
import { pool } from "../../apps/api/src/database/db.js";
import { config } from "../../apps/api/src/config.js";
test("MariaDB: 약관→휴대폰→가입→세션→역할→로그아웃, CSRF 및 중복 보호", async () => {
  assert.ok(config.DB_NAME.endsWith("_test"), "Use an isolated test database");
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  let cookie = "";
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Geuncha-Request": "1",
        Cookie: cookie,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie")!.split(";")[0];
    return { status: response.status, ...(await response.json()) };
  }
  try {
    assert.equal((await request("/health")).data.database, "mariadb");
    assert.equal(
      (await request("/me/active-role", "PATCH", { role: "host" })).status,
      401,
    );
    assert.equal(
      (await request("/auth/login", "POST", {}, { "X-Geuncha-Request": "" }))
        .status,
      403,
    );
    const consent = await request("/consents", "POST", {
      version: "2026-11-14",
      choices: {
        privacy: true,
        thirdParty: true,
        locationTerms: true,
        locationCollection: true,
        marketingApp: false,
        marketingSms: false,
        marketingEmail: false,
      },
    });
    assert.equal(consent.status, 201);
    const suffix = String(Date.now()).slice(-9),
      phone = "010" + suffix.slice(-8),
      loginId = "u" + suffix;
    const challenge = await request("/auth/phone-challenges", "POST", {
      phone,
    });
    assert.equal(challenge.data.mode, "development");
    assert.equal(
      (
        await request(
          `/auth/phone-challenges/${challenge.data.id}/verify`,
          "POST",
          { code: "000000" },
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          `/auth/phone-challenges/${challenge.data.id}/verify`,
          "POST",
          { code: challenge.data.developmentCode },
        )
      ).status,
      200,
    );
    const signup = {
      loginId,
      password: "Geuncha123!",
      nickname: "통합검증",
      phone,
      role: "guest",
      challengeId: challenge.data.id,
      consentId: consent.data.id,
    };
    const user = await request("/auth/signup", "POST", signup);
    assert.equal(user.status, 201);
    assert.ok(cookie.startsWith("geuncha_session="));
    assert.ok(!("passwordHash" in user.data));
    assert.equal((await request("/auth/me")).data.id, user.data.id);
    const addressResult = await request("/verifications/neighborhood", "POST", { method: "address", neighborhood: "경기 성남시 분당구 백현동", areaCode: "4113511000" });
    assert.equal(addressResult.status, 200);
    assert.equal(addressResult.data.metadata.neighborhood, "경기 성남시 분당구 백현동");
    assert.equal((await request("/auth/me")).data.neighborhood, "경기 성남시 분당구 백현동");
    assert.equal((await request("/verifications/neighborhood", "POST", { method: "address", neighborhood: "", areaCode: "bad" })).error.code, "INVALID_ADDRESS");
    const position = { latitude: 37.48, longitude: 126.93, accuracy: 0, capturedAt: new Date().toISOString() };
    const neighborhood = await request("/verifications/neighborhood", "POST", position);
    assert.equal(neighborhood.status, 200, JSON.stringify(neighborhood.error));
    assert.equal(neighborhood.data.status, "success");
    assert.equal((await request("/verifications/neighborhood", "POST", {...position, accuracy: 20000})).error.code, "INACCURATE_POSITION");
    assert.equal((await request("/verifications/neighborhood", "POST", {...position, accuracy: -1})).error.code, "INVALID_POSITION");
    assert.equal((await request("/verifications/neighborhood", "POST", {...position, latitude: 100})).error.code, "INVALID_POSITION");
    assert.equal((await request("/verifications/neighborhood", "POST", {...position, capturedAt: "2000-01-01T00:00:00.000Z"})).error.code, "STALE_POSITION");
    assert.equal(
      (await request("/me/active-role", "PATCH", { role: "host" })).status,
      403,
    );
    assert.equal(
      (await request("/me/roles", "POST", { role: "host" })).status,
      200,
    );
    assert.equal(
      (await request("/me/active-role", "PATCH", { role: "host" })).data
        .activeRole,
      "host",
    );
    assert.equal((await request("/auth/signup", "POST", signup)).status, 400);
    assert.equal(
      (await request("/auth/login", "POST", { loginId, password: "incorrect" }))
        .status,
      401,
    );
    await request("/auth/logout", "POST");
    assert.equal((await request("/auth/me")).data, null);
    assert.equal(
      (
        await request("/auth/login", "POST", {
          loginId,
          password: "Geuncha123!",
        })
      ).status,
      200,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
