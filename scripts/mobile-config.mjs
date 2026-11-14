// Hosted preview builds preserve same-origin sessions, uploads and API calls.
export function mobileServer(value, allowHttp) {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("MOBILE_SERVER_URL에는 경로·인증정보 없이 서버 주소만 입력하세요.");
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("서버 주소는 HTTPS 또는 HTTP여야 합니다.");
  if (url.protocol === "http:" && allowHttp !== "1")
    throw new Error("HTTP 개발 서버는 MOBILE_ALLOW_HTTP=1을 명시해야 합니다.");
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("휴대폰이 접속할 수 있는 LAN IP 또는 HTTPS 도메인을 사용하세요.");
  return { url: url.origin, cleartext: url.protocol === "http:" };
}
