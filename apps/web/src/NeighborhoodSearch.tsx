import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Button, Form, Input, Notice, useApp } from "./components";

type Address = { sido: string; sigungu: string; bname: string; bcode: string };
type Postcode = new (options: {
  oncomplete: (data: Address) => void;
  width: string;
  height: number;
}) => {
  embed: (
    element: HTMLElement,
    options: { q: string; autoClose: boolean },
  ) => void;
};
let scriptPromise: Promise<Postcode> | undefined;
function loadSearch() {
  const get = () => {
    const host = window as unknown as {
      kakao?: { Postcode: Postcode };
      daum?: { Postcode: Postcode };
    };
    return host.kakao?.Postcode ?? host.daum?.Postcode;
  };
  if (get()) return Promise.resolve(get()!);
  if (!scriptPromise)
    scriptPromise = new Promise<Postcode>((resolve, reject) => {
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        script.remove();
        reject(
          new Error(
            "주소 검색 연결 시간이 초과되었습니다. 다시 시도해 주세요.",
          ),
        );
      }, 15000);
      script.src =
        "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.onload = () => {
        clearTimeout(timer);
        const Search = get();
        if (Search) resolve(Search);
        else reject(new Error("주소 검색을 시작하지 못했습니다."));
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(
          new Error(
            "주소 검색에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.",
          ),
        );
      };
      document.head.append(script);
    }).catch((error) => {
      scriptPromise = undefined;
      throw error;
    });
  return scriptPromise;
}

export function NeighborhoodSearch() {
  const { setUser, go } = useApp();
  const target = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const [selected, setSelected] = useState<{
    neighborhood: string;
    areaCode: string;
  } | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <section aria-label="주소로 동네 찾기">
      <h2>사는 동네를 검색해 주세요</h2>
      <p className="muted">
        동네 이름, 도로명 또는 건물명을 입력해 주소를 찾아 선택하세요. 상세
        번지·호수는 저장하지 않습니다.
      </p>
      <Form
        submit="주소 검색"
        onSubmit={async (data) => {
          setSelected(null);
          const Search = await loadSearch();
          if (!active.current || !target.current) return;
          target.current.replaceChildren();
          new Search({
            width: "100%",
            height: 420,
            oncomplete: (address) => {
              if (!active.current) return;
              setSelected({
                neighborhood: [address.sido, address.sigungu, address.bname]
                  .filter(Boolean)
                  .join(" "),
                areaCode: address.bcode,
              });
              target.current?.replaceChildren();
            },
          }).embed(target.current, { q: data.query.trim(), autoClose: true });
        }}
      >
        <Input
          label="사는 동네 또는 주소"
          name="query"
          placeholder="예: 역삼동, 판교역로, 아파트 이름"
        />
      </Form>
      <div ref={target} className="neighborhood-search" />
      {selected && (
        <>
          <Notice>선택한 동네: {selected.neighborhood}</Notice>
          <Form
            submit="선택한 동네로 인증"
            onSubmit={async () => {
              await api("/verifications/neighborhood", "POST", {
                method: "address",
                ...selected,
              });
              setUser(await api("/auth/me"));
              go(7);
            }}
          />
          <Button
            secondary
            onClick={() => {
              setSelected(null);
            }}
          >
            다시 선택
          </Button>
        </>
      )}
      <Notice>
        현재 개발 인증으로 저장됩니다. 주소 선택만으로 실제 거주 사실을
        증명하지는 않습니다.
      </Notice>
    </section>
  );
}
