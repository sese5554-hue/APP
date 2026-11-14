import { Card, Intro, Load, Menu, useApp, useData } from "./components";

export function VerificationStatus({ returnTo }: { returnTo?: number }) {
  const { user, go } = useApp();
  const verification = useData<any[]>(user ? "/me/verifications" : null);
  if (!user) return null;
  return (
    <Card>
      <Intro
        title="예약을 위한 인증"
        description="본인·동네·면허 인증을 각각 완료해 주세요."
      />
      <Load resource={verification}>
        {(list) => (
          <>
            {(
              [
                ["identity", "본인 인증", 5],
                ["neighborhood", "동네 인증", 6],
                ["license", "면허 인증", 7],
              ] as const
            ).map(([kind, label, screen]) => {
              const record = list.find((item) => item.kind === kind);
              const expires = record?.expiresAt?.replace(" ", "T");
              const complete =
                record?.status === "success" &&
                expires &&
                Date.parse(
                  /(?:Z|[+-]\d\d:\d\d)$/.test(expires)
                    ? expires
                    : expires + "Z",
                ) > Date.now();
              return (
                <Menu
                  key={kind}
                  label={label}
                  detail={
                    complete
                      ? `${record.mode === "development" ? "개발 " : ""}완료 · 다시 확인`
                      : "미완료 또는 만료 · 인증하기"
                  }
                  onClick={() =>
                    go(screen, { verificationReturn: returnTo ?? null })
                  }
                />
              );
            })}
          </>
        )}
      </Load>
    </Card>
  );
}
