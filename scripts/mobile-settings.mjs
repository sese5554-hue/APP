import { isIP } from "node:net";
import { mobileServer } from "./mobile-config.mjs";

export function resolveMobileSettings(settings, detectAddress) {
  if (settings.mode === "server") {
    if (!settings.serverUrl) throw new Error("server 모드에서는 serverUrl을 입력하세요.");
    const server = mobileServer(settings.serverUrl);
    return { url: server.url, allowHttp: "0" };
  }
  if (settings.mode !== "local") throw new Error("mode는 local 또는 server여야 합니다.");
  const port = settings.port;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("port는 1~65535 정수여야 합니다.");
  const address = settings.lanIp || detectAddress();
  if (isIP(address) !== 4 || address.startsWith("127.") || address === "0.0.0.0")
    throw new Error("lanIp에는 휴대폰에서 접속할 PC의 IPv4 주소를 입력하세요.");
  return { url: `http://${address}:${port}`, allowHttp: "1" };
}
