import test from "node:test";
import assert from "node:assert/strict";
import { chooseLanAddress, isPrivateIPv4 } from "../scripts/mobile-network.mjs";
test("모바일 주소는 실제 PC의 사설 IPv4를 선택하며 가상 어댑터보다 Wi-Fi를 우선한다", () => {
  const interfaces = {
    Loopback: [{ family: "IPv4", address: "127.0.0.1", internal: true }],
    "vEthernet (WSL)": [
      { family: "IPv4", address: "172.22.1.1", internal: false },
    ],
    "Wi-Fi": [
      { family: "IPv4", address: "192.168.0.10", internal: false },
      { family: "IPv6", address: "::1", internal: false },
    ],
  };
  assert.equal(chooseLanAddress(interfaces), "192.168.0.10");
  assert.equal(chooseLanAddress(interfaces, "172.22.1.1"), "172.22.1.1");
  assert.throws(() => chooseLanAddress(interfaces, "192.168.0.99"));
  assert.throws(() => chooseLanAddress({}));
});
test("공인 IP·루프백·링크 로컬 주소를 모바일 접속 주소로 선택하지 않는다", () => {
  for (const value of [
    "8.8.8.8",
    "127.0.0.1",
    "169.254.1.1",
    "192.168.0.300",
    "172.32.0.1",
  ])
    assert.equal(isPrivateIPv4(value), false);
  for (const value of ["192.168.1.3", "10.0.0.3", "172.16.0.3", "172.31.0.3"])
    assert.equal(isPrivateIPv4(value), true);
});
