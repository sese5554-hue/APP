import { useState } from "react";
import type { User } from "../../../packages/contracts";
import screens from "../../../docs/screen-manifest.json";
import { api } from "./api";
import { Button, Card, Intro, Notice, useApp } from "./components";

export function ScreenTest() {
  const { setUser, go } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(role: "guest" | "host") {
    setBusy(true);
    setError("");
    try {
      const user = await api<User>("/auth/login", "POST", {
        loginId: `${role}demo`, password: "Geuncha123!",
      });
      const active = user.activeRole === role ? user : await api<User>("/me/active-role", "PATCH", { role });
      setUser(active);
      go(role === "host" ? 25 : 8);
    } catch (error) {
      setError(error instanceof Error ? error.message : "PC 서버 연결을 확인해 주세요.");
    } finally { setBusy(false); }
  }
  return <>
    <Intro title="휴대폰 화면 테스트" description="AWS 없이, 같은 Wi-Fi의 PC에서 실행 중입니다." />
    <Notice>PC 실행 창을 켜 둔 채 사용하세요. 테스트 계정의 변경 내용은 이 PC의 개발 DB에 저장됩니다.</Notice>
    <Card>
      <Button disabled={busy} onClick={() => void login("guest")}>게스트 화면 테스트</Button>
      <Button disabled={busy} secondary onClick={() => void login("host")}>호스트 화면 테스트</Button>
      <Button secondary onClick={() => go(0)}>회원가입·로그인 화면 보기</Button>
    </Card>
    {error && <Notice>{error}</Notice>}
    <p><a href="/__test/android.apk">Android 테스트 APK 다운로드</a></p>
    <p className="muted">APK를 만든 뒤 Android에서 다운로드해 설치할 수 있습니다. iPhone은 위의 화면 테스트 버튼을 이용하세요.</p>
    <Card>
      <h2>iPhone 홈 화면에 추가</h2>
      <p>Safari에서 이 주소를 열고 공유 → 홈 화면에 추가 → 추가를 누르세요. ‘웹 앱으로 열기’가 표시되면 켜 두세요.</p>
      <p className="muted">홈 화면의 근차 아이콘으로 실행할 수 있습니다. PC 서버와 같은 Wi-Fi 연결이 필요합니다. PC 주소가 바뀌면 새 주소를 Safari에서 열어 홈 화면 아이콘을 다시 추가하세요.</p>
    </Card>
    <p className="muted">예약·점검 화면은 차량 선택과 예약을 먼저 진행해야 내용이 표시됩니다. GPS 인증은 HTTP에서 제한될 수 있습니다.</p>
    <label htmlFor="test-screen">화면 바로가기</label>
    <select id="test-screen" defaultValue="" onChange={(event) => { if (event.target.value) go(Number(event.target.value)); }}>
      <option value="" disabled>00~51 화면 선택</option>
      {screens.map((screen) => <option key={screen.id} value={screen.number}>{screen.id} · {screen.title}</option>)}
    </select>
    <p className="muted">테스트 시작으로 돌아오려면 브라우저 뒤로 가기 또는 /mobile-test 주소를 여세요.</p>
  </>;
}
