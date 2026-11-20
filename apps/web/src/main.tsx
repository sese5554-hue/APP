import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import type { User } from "../../../packages/contracts";
import { api } from "./api";
import { RecoveryBoundary } from "./RecoveryBoundary";
import { AppContext, Button, Intro, Notice } from "./components";
const ScreenTest = lazy(() =>
  import("./ScreenTest").then((module) => ({ default: module.ScreenTest })),
);
const AuthPage = lazy(() =>
  import("./pages/Auth").then((module) => ({ default: module.AuthPage })),
);
const GuestPage = lazy(() =>
  import("./pages/Guest").then((module) => ({ default: module.GuestPage })),
);
const SharedPage = lazy(() =>
  import("./pages/Shared").then((module) => ({ default: module.SharedPage })),
);
const HostPage = lazy(() =>
  import("./pages/Host").then((module) => ({ default: module.HostPage })),
);
import "./style.css";
import "./extra.css";
import { initializeMobile } from "./mobile";
void initializeMobile().catch(console.error);
function App() {
  const [location, setLocation] = useState(
      window.location.pathname + window.location.search,
    ),
    [user, setUser] = useState<User | null>(null),
    [revision, setRevision] = useState(0),
    [toast, setToast] = useState(
      new URLSearchParams(window.location.search).has("recovered")
        ? "오류가 발생하여 첫 번째 화면으로 돌아왔습니다."
        : "",
    ),
    [ready, setReady] = useState(false);
  const [activity, setActivity] = useState<{
    bookingId: string;
    refund: boolean;
  } | null>(null);
  useEffect(() => {
    if (!activity) return;
    const timer = setTimeout(() => setActivity(null), 5000);
    return () => clearTimeout(timer);
  }, [activity]);
  useEffect(() => {
    if (!user) return;
    const stream = new EventSource("/api/events");
    stream.onmessage = (event) => {
      const { bookingId, kind, senderId } = JSON.parse(event.data);
      if (senderId === user.id) return;
      if (
        kind !== "refund" &&
        /\/screens\/19$/.test(window.location.pathname) &&
        new URLSearchParams(window.location.search).get("booking") === bookingId
      )
        return;
      void api<Record<string, boolean>>("/me/notification-settings")
        .then((settings) => {
          if (
            !(
              window.location.pathname === "/screens/19" &&
              new URLSearchParams(window.location.search).get("booking") ===
                bookingId
            ) &&
            settings[kind === "refund" ? "booking" : "chat"]
          )
            setActivity({ bookingId, refund: kind === "refund" });
          setRevision((v) => v + 1);
        })
        .catch(() => {});
    };
    return () => stream.close();
  }, [user?.id]);
  const screen = Number(location.match(/\/screens\/(\d{1,2})/)?.[1] ?? 0),
    params = new URLSearchParams(location.split("?")[1]);
  function go(
    next: number,
    values: Record<string, string | number | null> = {},
  ) {
    const query = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === null) query.delete(key);
      else query.set(key, String(value));
    }
    const url = `/screens/${String(next).padStart(2, "0")}${query.size ? "?" + query : ""}`;
    history.pushState({}, "", url);
    setLocation(url);
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    const pop = () =>
      setLocation(window.location.pathname + window.location.search);
    window.addEventListener("popstate", pop);
    void api<User | null>("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function content() {
    if (!ready) return <p role="status">연결 중…</p>;
    if (
      (import.meta.env.DEV || import.meta.env.VITE_SCREEN_TEST === "true") &&
      location.startsWith("/mobile-test")
    )
      return <ScreenTest />;
    if (screen <= 7 && screen !== 1) return <AuthPage screen={screen} />;
    if ([1, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 45, 48].includes(screen))
      return <GuestPage screen={screen} />;
    if (
      [
        19, 20, 21, 22, 23, 24, 37, 38, 39, 40, 41, 42, 43, 44, 46, 47, 52,
      ].includes(screen)
    )
      return <SharedPage screen={screen} />;
    if (
      [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 49, 50, 51].includes(
        screen,
      )
    )
      return <HostPage screen={screen} />;
    return (
      <>
        <Intro title="페이지를 찾을 수 없어요" />
        <Button onClick={() => go(8)}>차량 찾기로 돌아가기</Button>
      </>
    );
  }
  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        go,
        params,
        refresh: () => setRevision((v) => v + 1),
        revision,
        notify: setToast,
      }}
    >
      <div className="app-shell">
        <aside className="brand-panel">
          <div className="wordmark">
            근차<span>GEUNCHA</span>
          </div>
          <h2>
            우리 동네에서,
            <br />
            가볍게 떠나요.
          </h2>
          <p>
            가까운 이웃의 차와 만나는
            <br />
            새로운 이동의 시작.
          </p>
          <div className="brand-road" />
          <small>내 동네 차량 공유</small>
        </aside>
        <div className={screen === 19 ? "phone chat-phone" : "phone"}>
          <header className="topbar">
            <button aria-label="뒤로가기" onClick={() => history.back()}>
              ‹
            </button>
            <button
              className="brand"
              onClick={() => go(user?.activeRole === "host" ? 25 : 8)}
            >
              근차
            </button>
            <button
              onClick={() =>
                go(user ? (user.activeRole === "host" ? 47 : 37) : 3)
              }
            >
              {user &&
                (user.avatarId ? (
                  <img
                    className="avatar small"
                    src={`/api/uploads/${user.avatarId}`}
                    alt="프로필"
                  />
                ) : (
                  <span className="avatar small">
                    {user.nickname.slice(0, 1)}
                  </span>
                ))}
              {user ? user.nickname : "로그인"}
            </button>
          </header>
          {toast && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
          <main key={screen}>
            {activity && (
              <div className="notice activity-notice" role="status">
                <button
                  onClick={() => {
                    go(
                      activity.refund
                        ? user?.activeRole === "host"
                          ? 35
                          : 18
                        : 19,
                      { booking: activity.bookingId },
                    );
                    setActivity(null);
                  }}
                >
                  {activity.refund
                    ? "환불 요청·처리 알림 · 예약 확인"
                    : "새 채팅 알림 · 대화 보기"}
                </button>
                <button
                  aria-label="알림 닫기"
                  onClick={() => setActivity(null)}
                >
                  ×
                </button>
              </div>
            )}
            <Suspense fallback={<p role="status">화면을 불러오는 중…</p>}>
              {content()}
            </Suspense>
          </main>
          <footer className="bottom-nav">
            {(user?.activeRole === "host"
              ? [
                  [25, "⌂", "홈"],
                  [34, "▤", "예약"],
                  [44, "▧", "채팅"],
                  [47, "◉", "마이"],
                ]
              : [
                  [8, "⌕", "검색"],
                  [45, "▤", "예약"],
                  [44, "▧", "채팅"],
                  [37, "◉", "마이"],
                ]
            ).map(([n, icon, label]) => (
              <button
                key={n}
                className={screen === n ? "active" : ""}
                onClick={() => go(Number(n))}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </button>
            ))}
          </footer>
        </div>
      </div>
    </AppContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RecoveryBoundary>
      <App />
    </RecoveryBoundary>
  </React.StrictMode>,
);
