import { useState } from "react";
import { api } from "../api";
import {
  Button,
  Card,
  Form,
  Input,
  Intro,
  Notice,
  Select,
  useApp,
  useData,
  Load,
  Menu,
} from "../components";
export function AuthPage({ screen }: { screen: number }) {
  const { go, user, setUser, notify } = useApp();
  const [role, setRole] = useState("guest"),
    [choices, setChoices] = useState<Record<string, boolean>>({
      privacy: false,
      thirdParty: false,
      locationTerms: false,
      locationCollection: false,
      marketingApp: false,
      marketingSms: false,
      marketingEmail: false,
    });
  const [consentId, setConsentId] = useState(
      sessionStorage.getItem("consentId") ?? "",
    ),
    [challenge, setChallenge] = useState<any>(null),
    [verified, setVerified] = useState(false),
    [available, setAvailable] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [recovery, setRecovery] = useState(false);
  const verification = useData<any[]>(
    screen === 7 && user ? "/me/verifications" : null,
  );
  const fail = (e: unknown) => setMessage((e as Error).message);
  if (screen === 0)
    return (
      <>
        <Intro
          title="안전한 차량 공유의 시작"
          description="이용에 필요한 약관을 확인해 주세요."
        />
        <Card>
          <label className="check">
            <input
              type="checkbox"
              checked={Object.values(choices).every(Boolean)}
              onChange={(e) =>
                setChoices(
                  Object.fromEntries(
                    Object.keys(choices).map((k) => [k, e.target.checked]),
                  ),
                )
              }
            />
            전체 동의
          </label>
          {[
            ["privacy", "개인정보 수집·이용"],
            ["thirdParty", "개인정보 제3자 제공"],
            ["locationTerms", "위치정보 이용약관"],
            ["locationCollection", "위치정보 수집·이용"],
            ["marketingApp", "앱 혜택 알림 (선택)"],
            ["marketingSms", "문자 혜택 알림 (선택)"],
            ["marketingEmail", "이메일 혜택 알림 (선택)"],
          ].map(([key, label]) => (
            <details key={key}>
              <summary>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={choices[key]}
                    onChange={(e) =>
                      setChoices({ ...choices, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
                <span>내용 보기</span>
              </summary>
              <p>
                근차 개발용 약관 안내: {label}의 동의 여부와 버전을 저장합니다.
                실제 운영 약관은 출시 전에 확정해야 합니다. 선택 항목은 동의하지
                않아도 이용할 수 있습니다.
              </p>
            </details>
          ))}
        </Card>
        <Notice>위치 권한은 주변 차량을 찾을 때 별도로 요청합니다.</Notice>
        <Form
          submit="동의하고 홈 둘러보기"
          onSubmit={async () => {
            const value = await api("/consents", "POST", {
              version: "2026-11-14",
              choices,
            });
            setConsentId(value.id);
            sessionStorage.setItem("consentId", value.id);
            go(1);
          }}
        />
      </>
    );
  if (screen === 2)
    return (
      <>
        <Intro
          title="어떤 방식으로 이용하시나요?"
          description="나중에 다른 역할도 추가할 수 있어요."
        />
        {[
          ["guest", "차량을 빌리고 싶어요", "주변 차량을 찾고 예약해요"],
          [
            "host",
            "내 차를 공유하고 싶어요",
            "차량을 등록하고 수익을 확인해요",
          ],
        ].map(([value, title, desc]) => (
          <button
            className={`role-card ${role === value ? "selected" : ""}`}
            key={value}
            onClick={() => setRole(value)}
          >
            <span className="role-symbol">{value === "guest" ? "G" : "H"}</span>
            <span>
              <strong>{title}</strong>
              <small>{desc}</small>
            </span>
            <input
              type="radio"
              aria-label={title}
              checked={role === value}
              readOnly
            />
          </button>
        ))}
        <Form
          submit="선택하고 계속"
          onSubmit={async () => {
            sessionStorage.setItem("signupRole", role);
            if (user) {
              await api("/me/roles", "POST", { role });
              setUser(await api("/me/active-role", "PATCH", { role }));
              go(role === "host" ? 25 : 8);
            } else go(4);
          }}
        />
      </>
    );
  if (screen === 3)
    return (
      <>
        <Intro
          title="다시 만나서 반가워요"
          description="내 동네에서 시작하는 가벼운 이동."
        />
        <Form
          submit="로그인"
          onSubmit={async (d) => {
            const logged = await api("/auth/login", "POST", d);
            setUser(logged);
            go(logged.activeRole === "host" ? 25 : 8);
          }}
        >
          <Input label="아이디" name="loginId" autoComplete="username" />
          <Input
            label="비밀번호"
            name="password"
            type="password"
            autoComplete="current-password"
          />
        </Form>
        <Menu
          label="아이디 · 비밀번호 찾기"
          onClick={() => setRecovery(!recovery)}
        />
        {recovery && <Recovery />}
        <p className="divider">또는 간편 로그인</p>
        <Button
          secondary
          onClick={() => void api("/auth/kakao/start").catch(fail)}
        >
          카카오로 계속하기
        </Button>
        {message && <Notice>{message}</Notice>}
        <Menu label="처음 오셨나요? 회원가입" onClick={() => go(2)} />
        <Menu label="로그인 없이 차량 둘러보기" onClick={() => go(1)} />
        <Notice>
          개발 계정: guestdemo / hostdemo
          <br />
          비밀번호: Geuncha123!
        </Notice>
      </>
    );
  if (screen === 4)
    return (
      <>
        <Intro
          title="계정을 만들어요"
          description="아이디와 휴대폰으로 안전하게 시작해요."
        />
        {!consentId && (
          <Notice>
            가입 전 약관 동의가 필요합니다.{" "}
            <button onClick={() => go(0)}>약관 확인</button>
          </Notice>
        )}
        <Form
          submit="회원가입 완료"
          onSubmit={async (d) => {
            if (d.password !== d.confirmPassword)
              throw new Error("비밀번호가 일치하지 않습니다.");
            if (!verified) throw new Error("휴대폰 인증을 완료해 주세요.");
            setUser(
              await api("/auth/signup", "POST", {
                loginId: d.loginId,
                password: d.password,
                nickname: d.nickname,
                phone: d.phone,
                role: sessionStorage.getItem("signupRole") || "guest",
                challengeId: challenge.id,
                consentId,
              }),
            );
            sessionStorage.removeItem("consentId");
            go(5);
          }}
        >
          <Input
            label="아이디 (영문·숫자 6~20자)"
            name="loginId"
            autoComplete="username"
          />
          <Button
            secondary
            onClick={() => {
              const input =
                document.querySelector<HTMLInputElement>("[name=loginId]");
              void api(
                `/auth/login-id-availability?loginId=${encodeURIComponent(input?.value ?? "")}`,
              )
                .then((r) =>
                  setAvailable(
                    r.available
                      ? "사용 가능한 아이디입니다."
                      : "이미 사용 중인 아이디입니다.",
                  ),
                )
                .catch(fail);
            }}
          >
            중복 확인
          </Button>
          {available && <p role="status">{available}</p>}
          <Input label="닉네임" name="nickname" />
          <Input
            label="비밀번호 (8자 이상)"
            name="password"
            type="password"
            autoComplete="new-password"
          />
          <Input
            label="비밀번호 확인"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
          />
          <Input label="휴대폰 번호 (숫자만)" name="phone" type="tel" />
          <Button
            secondary
            onClick={() => {
              const phone =
                document.querySelector<HTMLInputElement>("[name=phone]")?.value;
              setVerified(false);
              void api("/auth/phone-challenges", "POST", { phone })
                .then(setChallenge)
                .catch(fail);
            }}
          >
            인증번호 받기
          </Button>
          {challenge && (
            <>
              <Notice>
                개발 모드 인증번호: {challenge.developmentCode} · 5분 이내
              </Notice>
              <Input label="인증번호 6자리" name="code" />
              <Button
                secondary
                onClick={() => {
                  const code =
                    document.querySelector<HTMLInputElement>(
                      "[name=code]",
                    )?.value;
                  void api(
                    `/auth/phone-challenges/${challenge.id}/verify`,
                    "POST",
                    { code },
                  )
                    .then(() => {
                      setVerified(true);
                      setMessage("휴대폰 인증 완료");
                    })
                    .catch(fail);
                }}
              >
                인증 확인
              </Button>
            </>
          )}
          {message && <Notice>{message}</Notice>}
        </Form>
      </>
    );
  if (!user)
    return (
      <>
        <Intro title="먼저 로그인해 주세요" />
        <Button onClick={() => go(3)}>로그인</Button>
      </>
    );
  if (screen === 5)
    return (
      <>
        <Intro
          title="본인 확인을 진행해 주세요"
          description="개발 인증을 실제 본인 확인과 구분합니다."
        />
        <Notice>
          현재는 개발 공급자입니다. 실제 PASS·문자 본인 확인이 이루어지지
          않습니다.
        </Notice>
        <Form
          submit="본인 확인 시작"
          onSubmit={async (d) => {
            await api("/verifications/identity", "POST", d);
            notify("개발 모드 본인 확인을 저장했습니다.");
            go(6);
          }}
        >
          <Select name="method" label="확인 방법" options={["PASS", "SMS"]} />
        </Form>
      </>
    );
  if (screen === 6)
    return (
      <>
        <Intro
          title="내 동네를 확인해요"
          description="현재 위치를 한 번 확인해 주변 차량을 찾습니다."
        />
        <div className="map-placeholder">
          <span className="map-pin">⌖</span>
          <strong>내 위치 확인</strong>
          <p>위치 권한을 허용해 주세요.</p>
        </div>
        <Notice>
          개발 모드의 지역 판정은 신림동 예시입니다. 실제 GPS 좌표 요청과 권한
          오류는 처리합니다.
        </Notice>
        <Button
          disabled={busy}
          onClick={() => {
            if (!navigator.geolocation) {
              setMessage(
                "이 브라우저는 위치 확인을 지원하지 않습니다. 차량 목록에서 지역으로 검색해 주세요.",
              );
              return;
            }
            setBusy(true);
            navigator.geolocation?.getCurrentPosition(
              (position) => {
                void api("/verifications/neighborhood", "POST", {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  capturedAt: new Date(position.timestamp).toISOString(),
                })
                  .then(async () => {
                    setUser(await api("/auth/me"));
                    go(7);
                  })
                  .catch(fail)
                  .finally(() => setBusy(false));
              },
              (error) => {
                setMessage(
                  error.code === 1
                    ? "위치 권한을 허용하거나 차량을 먼저 둘러보세요."
                    : "위치를 확인하지 못했습니다. 다시 시도해 주세요.",
                );
                setBusy(false);
              },
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            );
          }}
        >
          현재 위치로 동네 확인
        </Button>
        <Button secondary onClick={() => go(8)}>
          인증 없이 차량 둘러보기
        </Button>
        {message && <Notice>{message}</Notice>}
      </>
    );
  return (
    <>
      <Intro
        title="운전면허 정보를 입력해요"
        description="면허번호 원문은 저장하지 않습니다."
      />
      <Load resource={verification}>
        {(list) =>
          list.some((v: any) => v.kind === "license") ? (
            <Notice>
              등록된 면허가 있습니다. 새 정보를 제출하면 검증 결과를 갱신합니다.
            </Notice>
          ) : null
        }
      </Load>
      <Form
        submit="면허 정보 확인"
        onSubmit={async (d) => {
          await api("/verifications/license", "POST", d);
          notify("개발 모드 면허 확인을 저장했습니다.");
          go(user.activeRole === "host" ? 25 : 8);
        }}
      >
        <Select
          label="면허 종류"
          name="type"
          options={["1종 보통", "2종 보통"]}
        />
        <Input label="면허번호" name="number" placeholder="12-34-567890-12" />
        <Input label="발급일" name="issuedOn" type="date" />
        <Input label="유효기간" name="expiresOn" type="date" />
      </Form>
      <Notice>
        개발 검증입니다. 실제 면허 진위 확인은 공급자 연동 후 가능합니다.
      </Notice>
    </>
  );
}
function Recovery() {
  const [challenge, setChallenge] = useState<any>(null),
    [result, setResult] = useState("");
  return (
    <Card>
      <Form
        submit="인증번호 요청"
        onSubmit={async (d) =>
          setChallenge(await api("/auth/phone-challenges", "POST", d))
        }
      >
        <Input label="가입 휴대폰 번호" name="phone" type="tel" />
      </Form>
      {challenge && (
        <>
          <Notice>개발 인증번호: {challenge.developmentCode}</Notice>
          <Form
            submit="계정 확인"
            onSubmit={async (d) => {
              await api(
                `/auth/phone-challenges/${challenge.id}/verify`,
                "POST",
                { code: d.code },
              );
              const value = await api("/auth/recovery", "POST", {
                challengeId: challenge.id,
                action: d.action,
                newPassword: d.newPassword || undefined,
              });
              setResult(
                value.loginId
                  ? `아이디: ${value.loginId}`
                  : "요청을 처리했습니다. 비밀번호를 변경했다면 다시 로그인해 주세요.",
              );
            }}
          >
            <Input label="인증번호" name="code" />
            <label className="field">
              <span>찾기 종류</span>
              <select name="action">
                <option value="loginId">아이디 찾기</option>
                <option value="password">비밀번호 재설정</option>
              </select>
            </label>
            <Input
              label="새 비밀번호 (재설정 시)"
              name="newPassword"
              type="password"
              required={false}
            />
          </Form>
        </>
      )}
      {result && <Notice>{result}</Notice>}
    </Card>
  );
}
