import { useEffect, useRef, useState } from "react";
import { photoAngles } from "../../../../packages/contracts";
import { api, money, time } from "../api";
import {
  Button,
  Card,
  Form,
  Input,
  Intro,
  Load,
  Menu,
  NeedLogin,
  Notice,
  Row,
  Select,
  Textarea,
  useApp,
  useData,
} from "../components";
import { PhotoGrid, angleLabels, type Photo } from "../PhotoGrid";
export function SharedPage({ screen }: { screen: number }) {
  const { user } = useApp();
  if (screen === 42) return <Support />;
  if (!user) return <NeedLogin />;
  if (screen === 19) return <Chat />;
  if (screen === 20 || screen === 21)
    return <Inspection phase={screen === 20 ? "pickup" : "return"} />;
  if (screen === 22) return <Comparison />;
  if (screen === 23) return <Settlement />;
  if (screen === 24) return <Review />;
  if (screen === 37 || screen === 47) return <Profile host={screen === 47} />;
  if (screen === 38) return <EditProfile />;
  if (screen === 39) return <License />;
  if (screen === 40) return <PaymentMethods />;
  if (screen === 41) return <Notifications />;
  if (screen === 43) return <Inquiry />;
  if (screen === 44) return <Conversations />;
  if (screen === 46) return <AddPayment />;
  return null;
}
function Chat() {
  const { params, user, go } = useApp(),
    id = params.get("booking");
  const [messages, setMessages] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const messageKey = useRef(crypto.randomUUID()),
    tail = useRef<HTMLDivElement>(null);
  const booking = useData<any>(id ? `/bookings/${id}` : null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    async function load() {
      try {
        const list = await api<any[]>(`/bookings/${id}/messages`);
        if (!active) return;
        setMessages(list);
        setError("");
        if (list.length)
          await api(`/bookings/${id}/read`, "POST", { seq: list.at(-1)!.seq });
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      if (JSON.parse(event.data).bookingId === id) void load();
    };
    events.onerror = () => {
      if (active)
        setError("연결을 다시 시도하고 있습니다. 메시지는 서버에 보관됩니다.");
    };
    return () => {
      active = false;
      events.close();
    };
  }, [id]);
  useEffect(
    () => tail.current?.scrollIntoView({ block: "end" }),
    [messages.length],
  );
  if (!id)
    return (
      <>
        <Intro title="대화할 예약을 선택해 주세요" />
        <Button onClick={() => go(44)}>채팅 목록</Button>
      </>
    );
  return (
    <>
      <Load resource={booking}>
        {(b) => (
          <div className="chat-heading">
            <h1>
              {b.guestId === user!.id ? b.hostNickname : b.guestNickname}님
            </h1>
            <p>
              {b.vehicleName} · {time(b.startsAt)}
            </p>
            <button onClick={() => go(user?.activeRole === "host" ? 35 : 18)}>
              예약 보기
            </button>
          </div>
        )}
      </Load>
      {error && <Notice>{error}</Notice>}
      {loading ? (
        <p role="status">대화를 불러오는 중…</p>
      ) : (
        <div className="messages">
          {messages.length >= 50 && (
            <Button
              secondary
              onClick={() =>
                void api<any[]>(
                  `/bookings/${id}/messages?before=${messages[0].seq}`,
                )
                  .then((older) =>
                    setMessages((current) => [...older, ...current]),
                  )
                  .catch((e) => setError(e.message))
              }
            >
              이전 메시지 보기
            </Button>
          )}
          {messages.length ? (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.senderId === user!.id ? "mine" : ""}`}
              >
                <p>{message.content}</p>
                <small>{time(message.sentAt)}</small>
              </div>
            ))
          ) : (
            <Notice>첫 메시지를 보내 인수 정보를 확인해 보세요.</Notice>
          )}
          <div ref={tail} />
        </div>
      )}
      <Form
        submit="메시지 보내기"
        onSubmit={async (d, form) => {
          await api(`/bookings/${id}/messages`, "POST", {
            clientMessageId: messageKey.current,
            content: d.content,
          });
          messageKey.current = crypto.randomUUID();
          form.reset();
          setMessages(await api(`/bookings/${id}/messages`));
        }}
      >
        <Textarea label="메시지" name="content" required maxLength={2000} />
      </Form>
    </>
  );
}
function Inspection({ phase }: { phase: "pickup" | "return" }) {
  const { params, go } = useApp(),
    id = params.get("booking"),
    resource = useData<any[]>(id ? `/bookings/${id}/inspections` : null);
  if (!id) return <NeedBooking />;
  return (
    <>
      <Intro
        title={
          phase === "pickup"
            ? "대여 전 차량 상태를 기록해요"
            : "반납 후 차량 상태를 기록해요"
        }
        description="밝은 곳에서 같은 각도로 촬영해 주세요."
      />
      <Notice>
        외관 8방향과 주행거리 계기판 사진이 모두 필요합니다. 실제 사진만
        증빙으로 올려 주세요.
      </Notice>
      <Load resource={resource}>
        {(list) => (
          <InspectionForm
            key={phase}
            id={id}
            phase={phase}
            initial={list.find((i: any) => i.phase === phase)}
            onDone={() => go(phase === "pickup" ? 18 : 22)}
          />
        )}
      </Load>
    </>
  );
}
function InspectionForm({
  id,
  phase,
  initial,
  onDone,
}: {
  id: string;
  phase: string;
  initial?: any;
  onDone: () => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>(
      initial?.photos?.map((p: any) => ({
        angle: p.angle,
        uploadId: p.uploadId,
        url: p.url,
      })) ?? [],
    ),
    [busy, setBusy] = useState(false);
  const { notify } = useApp();
  if (initial?.status === "submitted")
    return (
      <>
        <Notice>이미 제출한 점검입니다.</Notice>
        <Button onClick={onDone}>다음 단계</Button>
      </>
    );
  return (
    <>
      <PhotoGrid
        angles={[...photoAngles, "odometer"]}
        purpose="inspection"
        photos={photos}
        onChange={setPhotos}
        onBusy={setBusy}
      />
      <p className="muted">등록한 사진 {photos.length}/9장</p>
      <Form
        submit={
          phase === "pickup"
            ? "인수 확인하고 이용 시작"
            : "반납 제출하고 비교하기"
        }
        onSubmit={async (d) => {
          if (busy) throw new Error("사진 업로드가 끝날 때까지 기다려 주세요.");
          await api(`/bookings/${id}/inspections/${phase}`, "PUT", {
            odometerKm: Number(d.odometerKm),
            photos: photos.map(({ angle, uploadId }) => ({ angle, uploadId })),
            draft: false,
          });
          onDone();
        }}
      >
        <Input
          label="현재 계기판 주행거리 (km)"
          name="odometerKm"
          type="number"
          min={0}
          max={9999999}
          value={initial?.odometerKm ?? ""}
        />
        <Button
          secondary
          disabled={busy}
          onClick={() => {
            const input =
              document.querySelector<HTMLInputElement>("[name=odometerKm]");
            void api(`/bookings/${id}/inspections/${phase}`, "PUT", {
              odometerKm: Number(input?.value || 0),
              photos: photos.map(({ angle, uploadId }) => ({
                angle,
                uploadId,
              })),
              draft: true,
            })
              .then(() => notify("점검을 임시 저장했습니다."))
              .catch((e) => notify(e.message));
          }}
        >
          임시 저장
        </Button>
      </Form>
    </>
  );
}
function Comparison() {
  const { params, go, refresh } = useApp(),
    id = params.get("booking"),
    comparison = useData<any>(id ? `/bookings/${id}/comparison` : null),
    images = useData<any[]>(id ? `/bookings/${id}/inspections` : null);
  if (!id) return <NeedBooking />;
  return (
    <>
      <Intro
        title="인수·반납 상태 비교"
        description="사진과 계기판을 양측이 함께 확인합니다."
      />
      <Load resource={comparison}>
        {(data) => (
          <>
            <Notice>{data.message}</Notice>
            <Card>
              {data.inspections.map((i: any) => (
                <Row
                  key={i.phase}
                  label={
                    i.phase === "pickup" ? "인수 주행거리" : "반납 주행거리"
                  }
                  value={`${i.odometerKm.toLocaleString()} km`}
                />
              ))}
              <Row
                label="확인 참여자"
                value={`${data.acknowledgements.filter((a: any) => a.decision === "confirmed").length}/2명`}
              />
            </Card>
          </>
        )}
      </Load>
      <Load resource={images}>
        {(list) => (
          <div className="comparison-photos">
            {photoAngles.map((angle) => (
              <Card key={angle}>
                <h2>{angleLabels[angle]}</h2>
                <div className="columns">
                  {["pickup", "return"].map((phase) => {
                    const photo = list
                      .find((i: any) => i.phase === phase)
                      ?.photos?.find((p: any) => p.angle === angle);
                    return (
                      <div key={phase}>
                        <small>
                          {phase === "pickup" ? "대여 전" : "반납 후"}
                        </small>
                        {photo ? (
                          <a href={photo.url} target="_blank" rel="noreferrer">
                            <img
                              src={photo.url}
                              alt={`${angleLabels[angle]} ${phase === "pickup" ? "인수" : "반납"}`}
                            />
                          </a>
                        ) : (
                          <p className="muted">제출 전</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Load>
      <Form
        submit="확인 내용 저장"
        onSubmit={async (d) => {
          await api(`/bookings/${id}/comparison/acknowledgements`, "POST", d);
          refresh();
        }}
      >
        <label className="field">
          <span>차량 상태 확인</span>
          <select name="decision">
            <option value="confirmed">추가 손상 없이 확인했습니다</option>
            <option value="dispute">확인이 필요합니다 · 이의 제기</option>
          </select>
        </label>
        <Textarea label="확인 메모" name="note" maxLength={500} />
      </Form>
      <Button secondary onClick={() => go(19)}>
        상대방과 채팅하기
      </Button>
      <Button onClick={() => go(23)}>정산 내역 보기</Button>
    </>
  );
}
function Settlement() {
  const { params, user, go, refresh } = useApp(),
    id = params.get("booking"),
    resource = useData<any>(id ? `/bookings/${id}/settlement` : null),
    booking = useData<any>(id ? `/bookings/${id}` : null);
  if (!id) return <NeedBooking />;
  return (
    <>
      <Intro
        title="최종 이용 금액을 확인해요"
        description="같은 예약의 점검 자료로 계산한 정산입니다."
      />
      <Load resource={resource}>
        {(s) => (
          <>
            <Card>
              <Row label="예약 시 결제" value={money(s.bookingTotal)} />
              <Row label="주행 거리" value={`${s.distanceKm} km`} />
              <Row label="포함 거리" value={`${s.includedKm} km`} />
              <Row
                label={`초과 주행료 · ${money(s.extraKmPrice)}/km`}
                value={money(s.extraDistance)}
              />
              <Row label="검증된 통행료" value={money(s.toll)} />
              <div className="total">
                <Row label="총 이용 금액" value={money(s.total)} />
                <Row label="추가 결제 잔액" value={money(s.balance)} />
              </div>
            </Card>
            <Notice>
              통행료 외부 연동과 자동 손상 판정은 미설정입니다. 검증되지 않은
              비용은 청구하지 않습니다. 현재 정산 상태:{" "}
              {(
                {
                  review: "양측 확인 대기",
                  agreed: "양측 확인 완료",
                  disputed: "이의 제기 · 운영 검토 필요",
                  paid: "정산 완료",
                } as Record<string, string>
              )[s.status] || s.status}
            </Notice>
            {booking.data?.guestId === user!.id && s.status === "agreed" && (
              <Form
                submit={
                  s.balance > 0
                    ? `${money(s.balance)} 개발 추가 결제`
                    : "추가 요금 없이 이용 완료"
                }
                onSubmit={async () => {
                  await api(
                    `/bookings/${id}/settlement/${s.balance > 0 ? "pay" : "complete"}`,
                    "POST",
                  );
                  refresh();
                }}
              />
            )}
            {s.status === "paid" && (
              <Button onClick={() => go(24)}>이용 후기 작성하기</Button>
            )}
            <Button secondary onClick={() => go(22)}>
              사진 비교·양측 확인
            </Button>
          </>
        )}
      </Load>
    </>
  );
}
function Review() {
  const { params, go } = useApp(),
    [rating, setRating] = useState(5),
    [tags, setTags] = useState<string[]>([]);
  if (!params.get("booking")) return <NeedBooking />;
  return (
    <>
      <Intro
        title="이번 대여는 어떠셨나요?"
        description="상대방과의 경험을 남겨 주세요."
      />
      <div className="stars" aria-label={`평점 ${rating}점`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} onClick={() => setRating(i)} aria-label={`${i}점`}>
            {i <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <Form
        submit="평가 등록하기"
        onSubmit={async (d) => {
          await api(`/bookings/${params.get("booking")}/reviews`, "POST", {
            rating,
            mannerRating: Number(d.mannerRating),
            content: d.content,
            tags,
          });
          go(45);
        }}
      >
        <Select
          label="매너 평가"
          name="mannerRating"
          options={["5", "4", "3", "2", "1"]}
        />
        <div className="chips">
          {["시간 약속", "친절해요", "차량 깨끗", "소통이 좋아요"].map(
            (tag) => (
              <label className="check" key={tag}>
                <input
                  type="checkbox"
                  checked={tags.includes(tag)}
                  onChange={(event) =>
                    setTags(
                      event.target.checked
                        ? [...tags, tag]
                        : tags.filter((item) => item !== tag),
                    )
                  }
                />
                {tag}
              </label>
            ),
          )}
        </div>
        <Textarea
          label="후기를 작성해 주세요"
          name="content"
          required
          maxLength={2000}
        />
      </Form>
    </>
  );
}
function Profile({ host }: { host: boolean }) {
  const { user, go, setUser } = useApp();
  return (
    <>
      <div className="profile-head">
        {user!.avatarId ? (
          <img
            className="avatar"
            src={`/api/uploads/${user!.avatarId}`}
            alt="프로필"
          />
        ) : (
          <span className="avatar">{user!.nickname[0]}</span>
        )}
        <h1>{user!.nickname}님</h1>
        <p>
          {user!.neighborhood || "동네 인증 전"} · 매너{" "}
          {user!.mannerTemperature}°
        </p>
      </div>
      <Card>
        <Row label="이용 모드" value={host ? "호스트" : "게스트"} />
        <Form
          submit={host ? "게스트로 전환" : "호스트로 전환"}
          onSubmit={async () => {
            const role = host ? "guest" : "host";
            if (!user!.roles.includes(role))
              await api("/me/roles", "POST", { role });
            setUser(await api("/me/active-role", "PATCH", { role }));
            go(host ? 8 : 25);
          }}
        />
      </Card>
      <h2 className="section-title">내 정보</h2>
      {[
        [38, "개인정보 수정", "닉네임 · 연락처 · 동네"],
        [39, "운전면허 관리", "인증 상태와 유효기간"],
        [40, "결제수단 관리", "등록 카드와 기본 결제수단"],
        [41, "알림 설정", "예약 · 채팅 · 정산 · 혜택"],
        [42, "고객센터", "자주 묻는 질문 · 1:1 문의"],
      ].map(([n, label, detail]) => (
        <Menu
          key={n}
          label={String(label)}
          detail={String(detail)}
          onClick={() => go(Number(n))}
        />
      ))}
      {host && (
        <Card>
          <Menu label="수익 대시보드" onClick={() => go(36)} />
          <Menu label="차량 관리" onClick={() => go(26)} />
        </Card>
      )}
      <Form
        submit="로그아웃"
        onSubmit={async () => {
          await api("/auth/logout", "POST");
          setUser(null);
          go(1);
        }}
      />
    </>
  );
}
function EditProfile() {
  const { user, setUser, go, notify } = useApp(),
    [avatar, setAvatar] = useState<string | undefined>();
  return (
    <>
      <Intro title="내 정보를 수정해요" />
      <Form
        submit="변경 내용 저장"
        onSubmit={async (d) => {
          setUser(
            await api("/me/profile", "PATCH", {
              nickname: d.nickname,
              email: d.email,
              avatarUploadId: avatar,
            }),
          );
          notify("내 정보를 저장했습니다.");
          go(user!.activeRole === "host" ? 47 : 37);
        }}
      >
        <Input label="닉네임" name="nickname" value={user!.nickname} />
        <Input
          label="이메일"
          name="email"
          type="email"
          value={user!.email ?? ""}
          required={false}
        />
        <label className="field">
          <span>프로필 사진</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const data = new FormData();
              data.set("file", file);
              data.set("purpose", "profile");
              void api("/uploads", "POST", data)
                .then((r) => {
                  setAvatar(r.id);
                  notify(
                    "프로필 사진을 올렸습니다. 저장 버튼을 눌러 반영하세요.",
                  );
                })
                .catch((e) => notify(e.message));
            }}
          />
        </label>
        <Row label="휴대폰" value={user!.phone} />
      </Form>
      <PhoneChange />
      <Menu
        label="동네 다시 인증"
        detail={user!.neighborhood ?? "인증 전"}
        onClick={() => go(6)}
      />
    </>
  );
}
function PhoneChange() {
  const { setUser, notify } = useApp(),
    [challenge, setChallenge] = useState<any>(null);
  return (
    <details>
      <summary>휴대폰 번호 변경</summary>
      <Form
        submit="새 번호 인증 요청"
        onSubmit={async (d) =>
          setChallenge(await api("/auth/phone-challenges", "POST", d))
        }
      >
        <Input label="새 휴대폰 번호" name="phone" type="tel" />
      </Form>
      {challenge && (
        <>
          <Notice>개발 인증번호: {challenge.developmentCode}</Notice>
          <Form
            submit="새 번호로 변경"
            onSubmit={async (d) => {
              await api(
                `/auth/phone-challenges/${challenge.id}/verify`,
                "POST",
                d,
              );
              setUser(
                await api("/me/phone-change", "POST", {
                  challengeId: challenge.id,
                }),
              );
              setChallenge(null);
              notify("휴대폰 번호를 변경했습니다.");
            }}
          >
            <Input label="인증번호" name="code" />
          </Form>
        </>
      )}
    </details>
  );
}
function License() {
  const { go } = useApp(),
    license = useData<any>("/me/license");
  return (
    <>
      <Intro title="운전면허 관리" />
      <Load resource={license}>
        {(l) => (
          <Card>
            <span className="pill">
              {l.status === "success" ? "개발 인증 완료" : l.status}
            </span>
            <h2 className="spaced">{l.type}</h2>
            <Row label="면허번호" value={l.maskedNumber} />
            <Row label="발급일" value={l.issuedOn} />
            <Row label="유효기간" value={l.expiresOn} />
          </Card>
        )}
      </Load>
      {!license.loading && !license.data && (
        <Notice>등록된 면허가 없습니다.</Notice>
      )}
      <Notice>실제 면허 진위 확인 공급자는 미연동입니다.</Notice>
      <Button onClick={() => go(7)}>면허 정보 입력·수정</Button>
    </>
  );
}
function PaymentMethods() {
  const { go, refresh } = useApp(),
    methods = useData<any[]>("/me/payment-methods");
  return (
    <>
      <Intro title="등록된 결제수단" />
      <Load resource={methods}>
        {(list) =>
          list.length ? (
            list.map((m: any) => (
              <Card key={m.id}>
                <h2>
                  {m.brand} {m.isDefault ? "· 기본" : ""}
                </h2>
                <p className="muted">•••• •••• •••• {m.lastFour}</p>
                {!m.isDefault && (
                  <Form
                    submit="기본 결제수단으로 설정"
                    onSubmit={async () => {
                      await api(`/me/payment-methods/${m.id}`, "PATCH", {
                        isDefault: true,
                      });
                      refresh();
                    }}
                  />
                )}
                <Form
                  submit="삭제하기"
                  onSubmit={async () => {
                    await api(`/me/payment-methods/${m.id}`, "DELETE");
                    refresh();
                  }}
                />
              </Card>
            ))
          ) : (
            <Notice>등록된 결제수단이 없습니다.</Notice>
          )
        }
      </Load>
      <Button onClick={() => go(46, { returnTo: 40 })}>결제수단 추가</Button>
      <Notice>
        현재는 개발 테스트 토큰만 저장합니다. 전체 카드번호는 입력하지 않습니다.
      </Notice>
    </>
  );
}
function AddPayment() {
  const { params, go } = useApp();
  return (
    <>
      <Intro
        title="결제수단 추가"
        description="현재는 개발용 테스트 카드만 등록할 수 있습니다."
      />
      <div className="test-card">
        <small>GEUNCHA · DEVELOPMENT</small>
        <strong>••••　••••　••••　1234</strong>
        <span>실제 결제 정보 입력 금지</span>
      </div>
      <Form
        submit="개발 테스트 카드 등록"
        onSubmit={async (d) => {
          const setup = await api("/me/payment-method-setup", "POST");
          await api("/me/payment-methods", "POST", {
            setupId: setup.id,
            lastFour: d.lastFour,
            isDefault: d.isDefault === "on",
          });
          go(Number(params.get("returnTo") || 40));
        }}
      >
        <Input label="테스트 카드 끝 4자리" name="lastFour" value="1234" />
        <label className="check">
          <input type="checkbox" name="isDefault" defaultChecked />
          기본 결제수단으로 설정
        </label>
      </Form>
      <Notice>
        실제 카드 등록은 PG 호스팅 입력창 연동 후 제공됩니다.
        카드번호·유효기간·CVC를 근차 서버에 보내지 않습니다.
      </Notice>
    </>
  );
}
function Notifications() {
  const settings = useData<any>("/me/notification-settings");
  return (
    <>
      <Intro title="받고 싶은 알림을 설정해요" />
      <Load resource={settings}>
        {(value) => <NotificationForm value={value} />}
      </Load>
      <Notice>
        현재는 설정 저장과 앱 내 실시간 채팅 알림만 제공합니다. 기기
        푸시·문자·이메일 발송 공급자는 미연동입니다.
      </Notice>
    </>
  );
}
function NotificationForm({ value }: { value: Record<string, boolean> }) {
  const [settings, setSettings] = useState(value),
    { notify } = useApp();
  return (
    <Form
      submit="알림 설정 저장"
      onSubmit={async () => {
        await api("/me/notification-settings", "PUT", settings);
        notify("알림 설정을 저장했습니다.");
      }}
    >
      <Card>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.booking && settings.chat && settings.settlement}
            onChange={(e) =>
              setSettings({
                ...settings,
                booking: e.target.checked,
                chat: e.target.checked,
                settlement: e.target.checked,
              })
            }
          />
          전체 서비스 알림
        </label>
        {[
          ["booking", "예약 알림"],
          ["chat", "채팅 알림"],
          ["settlement", "정산 알림"],
          ["benefit", "혜택 알림 · 마케팅 앱 수신 동의 (선택)"],
        ].map(([key, label]) => (
          <label className="switch-row" key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) =>
                setSettings({ ...settings, [key]: e.target.checked })
              }
            />
          </label>
        ))}
      </Card>
    </Form>
  );
}
function Support() {
  const { go } = useApp(),
    [query, setQuery] = useState(""),
    faqs = useData<any[]>(`/support/faqs?q=${encodeURIComponent(query)}`);
  return (
    <>
      <Intro title="무엇을 도와드릴까요?" />
      <Form submit="질문 검색" onSubmit={async (d) => setQuery(d.q)}>
        <Input label="궁금한 내용" name="q" required={false} />
      </Form>
      <Load resource={faqs}>
        {(list) =>
          list.length ? (
            list.map((faq: any) => (
              <details key={faq.id}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))
          ) : (
            <Notice>검색된 질문이 없습니다.</Notice>
          )
        }
      </Load>
      <Card>
        <h2>상담이 더 필요하신가요?</h2>
        <p className="muted">운영 시간 09:00–18:00 · 평일</p>
        <Button onClick={() => go(43)}>1:1 문의하기</Button>
      </Card>
    </>
  );
}
function Inquiry() {
  const { notify, refresh } = useApp(),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [photos, setPhotos] = useState<Photo[]>([]),
    inquiries = useData<any[]>("/me/inquiries");
  return (
    <>
      <Intro
        title="문의 내용을 남겨주세요"
        description="접수 내역을 저장하고 확인할 수 있습니다."
      />
      <Form
        submit="문의 접수하기"
        onSubmit={async (d, form) => {
          const result = await api("/support/inquiries", "POST", {
            idempotencyKey: key,
            ...d,
            uploadIds: photos.map((p) => p.uploadId),
          });
          notify(
            `접수 번호 ${result.id.slice(0, 8)} · 이메일 발송은 미연동입니다.`,
          );
          setKey(crypto.randomUUID());
          setPhotos([]);
          form.reset();
          refresh();
        }}
      >
        <Select
          label="문의 유형"
          name="category"
          options={["예약", "결제", "차량", "기타"]}
        />
        <Input label="제목" name="title" />
        <Textarea label="문의 내용" name="content" required maxLength={5000} />
        <label className="field">
          <span>사진 첨부 (최대 3장)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={photos.length >= 3}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.set("file", file);
              form.set("purpose", "inquiry");
              void api("/uploads", "POST", form)
                .then((result) =>
                  setPhotos((previous) => [
                    ...previous,
                    { angle: result.id, uploadId: result.id, url: result.url },
                  ]),
                )
                .catch((e) => notify(e.message));
            }}
          />
        </label>
        <p className="muted">
          첨부 {photos.length}/3 · 개인정보와 결제 비밀번호를 적지 마세요.
        </p>
      </Form>
      <h2 className="section-title">내 문의 내역</h2>
      <Load resource={inquiries}>
        {(list) =>
          list.map((item: any) => (
            <Card key={item.id}>
              <h2>{item.title}</h2>
              <p className="muted">{item.category} · 접수 완료</p>
              <p className="muted">{item.content}</p>
            </Card>
          ))
        }
      </Load>
    </>
  );
}
function Conversations() {
  const { go, refresh } = useApp(),
    [query, setQuery] = useState(""),
    [unread, setUnread] = useState(false),
    list = useData<any[]>(`/me/conversations?q=${encodeURIComponent(query)}`);
  useEffect(() => {
    const stream = new EventSource("/api/events");
    stream.onmessage = () => refresh();
    return () => stream.close();
  }, []);
  return (
    <>
      <Intro
        title="이웃과 나눈 이야기"
        description="예약과 관련된 대화를 모아봤어요."
      />
      <Form submit="대화 검색" onSubmit={async (d) => setQuery(d.q)}>
        <Input label="이름이나 차량" name="q" required={false} />
      </Form>
      <label className="check">
        <input
          type="checkbox"
          checked={unread}
          onChange={(e) => setUnread(e.target.checked)}
        />
        안 읽은 대화만
      </label>
      <Load resource={list}>
        {(items) =>
          items.length ? (
            items
              .filter((i: any) => !unread || i.unread > 0)
              .map((item: any) => (
                <button
                  className="conversation"
                  key={item.id}
                  onClick={() =>
                    go(19, { booking: item.id, vehicle: item.vehicleId })
                  }
                >
                  <span className="avatar small">{item.partner[0]}</span>
                  <span>
                    <strong>
                      {item.partner}님 · {item.vehicleName}
                    </strong>
                    <small>
                      {item.lastMessage || "인수 안내를 먼저 물어보세요."}
                    </small>
                  </span>
                  {item.unread > 0 && <b>{item.unread}</b>}
                </button>
              ))
          ) : (
            <Notice>예약하면 상대방과 대화를 나눌 수 있어요.</Notice>
          )
        }
      </Load>
    </>
  );
}
function NeedBooking() {
  const { go } = useApp();
  return (
    <>
      <Notice>예약을 먼저 선택해 주세요.</Notice>
      <Button onClick={() => go(45)}>내 예약 보기</Button>
    </>
  );
}
