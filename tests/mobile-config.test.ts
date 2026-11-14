import { test } from "node:test";
import assert from "node:assert/strict";
import { mobileServer } from "../scripts/mobile-config.mjs";

test("mobile server preserves same origin and requires explicit HTTP opt-in", () => {
  assert.equal(mobileServer(undefined), undefined);
  assert.deepEqual(mobileServer("https://example.com/"), { url: "https://example.com", cleartext: false });
  assert.deepEqual(mobileServer("http://192.0.2.10:5173", "1"), { url: "http://192.0.2.10:5173", cleartext: true });
  for (const address of ["http://192.0.2.10", "https://a:b@example.com", "https://example.com/api", "https://example.com/?token=secret", "file:///tmp", "https://localhost"])
    assert.throws(() => mobileServer(address));
});
