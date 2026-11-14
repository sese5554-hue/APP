import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Plain JS build tool.
import { resolveMobileSettings } from "../scripts/mobile-settings.mjs";

test("test settings support automatic and manually selected PCs", () => {
  assert.deepEqual(resolveMobileSettings({ mode: "local", port: 5173, lanIp: "" }, () => "192.168.0.3"), { url: "http://192.168.0.3:5173", allowHttp: "1" });
  assert.equal(resolveMobileSettings({ mode: "local", port: 6000, lanIp: "192.168.1.7" }, () => { throw new Error(); }).url, "http://192.168.1.7:6000");
  assert.deepEqual(resolveMobileSettings({ mode: "server", serverUrl: "https://example.com" }), { url: "https://example.com", allowHttp: "0" });
  for (const settings of [{ mode: "other" }, { mode: "local", port: 0 }, { mode: "local", port: 5173, lanIp: "127.0.0.1" }, { mode: "server", serverUrl: "http://example.com" }])
    assert.throws(() => resolveMobileSettings(settings, () => "192.168.0.3"));
});
