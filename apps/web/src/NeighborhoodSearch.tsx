import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { currentPosition } from "./currentPosition";
import {
  Button,
  Form,
  Input,
  Notice,
  useApp,
  useData,
  Load,
} from "./components";

type Address = {
  sido: string;
  sigungu: string;
  bname: string;
  bcode: string;
  address?: string;
  zonecode?: string;
};
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
  const saved = useData<any>("/me/address");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const target = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const [selected, setSelected] = useState<{
    neighborhood: string;
    areaCode: string;
    baseAddress: string;
    postcode: string;
    detailAddress?: string;
    source?: string;
  } | null>(null);
  useEffect(() => {
    if (saved.data?.baseAddress)
      setSelected((current) => current ?? saved.data);
  }, [saved.data]);
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
        기기 위치로 동네를 찾거나 주소를 검색하고, 상세주소를 입력해 저장하세요.
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
                baseAddress:
                  address.address ||
                  [address.sido, address.sigungu, address.bname]
                    .filter(Boolean)
                    .join(" "),
                postcode: address.zonecode || "",
                source: "search",
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
      <Button
        disabled={locating}
        onClick={() => {
          setError("");
          setLocating(true);
          void currentPosition().then(
            async (position) => {
              try {
                if (position.coords.accuracy > 10000)
                  throw new Error(
                    "위치 오차가 너무 큽니다. 정확한 위치 사용을 켜고 다시 시도해 주세요.",
                  );
                const query = new URLSearchParams({
                  latitude: String(position.coords.latitude),
                  longitude: String(position.coords.longitude),
                  localityLanguage: "ko",
                });
                const response = await fetch(
                  `https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`,
                  { signal: AbortSignal.timeout(10000) },
                );
                if (!response.ok)
                  throw new Error(
                    "현재 위치의 지역을 조회하지 못했습니다. 다시 시도하거나 주소를 검색해 주세요.",
                  );
                const data = await response.json();
                const neighborhood = [
                  ...new Set(
                    [
                      data.principalSubdivision,
                      data.city,
                      data.locality,
                    ].filter(
                      (value) => typeof value === "string" && value.trim(),
                    ),
                  ),
                ].join(" ");
                if (!neighborhood)
                  throw new Error(
                    "현재 위치에 해당하는 주소가 없습니다. 주소 검색으로 선택해 주세요.",
                  );
                if (active.current)
                  setSelected({
                    neighborhood,
                    baseAddress: neighborhood,
                    areaCode: "",
                    postcode: data.postcode || "",
                    source: "gps",
                  });
              } catch (error) {
                if (active.current) setError((error as Error).message);
              } finally {
                if (active.current) setLocating(false);
              }
            },
            (error) => {
              if (active.current) {
                setError(
                  error.message ||
                    (error.code === 1
                      ? "기기 설정에서 위치 권한을 허용해 주세요."
                      : "기기 위치를 받지 못했습니다. 위치 서비스를 켜고 다시 시도해 주세요."),
                );
                setLocating(false);
              }
            },
          );
        }}
      >
        {locating ? "기기 위치를 확인하는 중…" : "현재 위치로 동네 확인"}
      </Button>
      <p className="muted">
        현재 위치 버튼을 누르면 기기 좌표를 BigDataCloud에 전달해 지역을
        조회합니다. 동·호수는 직접 입력해 주세요. 도로명·번지는 주소 검색으로
        선택할 수 있습니다.
      </p>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      <Load resource={saved}>{() => null}</Load>
      {selected && (
        <>
          <Notice>선택한 동네: {selected.neighborhood}</Notice>
          <Form
            key={`${selected.baseAddress}-${selected.detailAddress || ""}`}
            submit="주소 저장하고 동네 확인"
            onSubmit={async (data) => {
              await api("/verifications/neighborhood", "POST", {
                method: "address",
                ...selected,
                baseAddress: data.baseAddress,
                postcode: data.postcode,
                detailAddress: data.detailAddress,
              });
              setUser(await api("/auth/me"));
              go(7);
            }}
          >
            <Input
              label="기본주소"
              name="baseAddress"
              value={selected.baseAddress}
            />
            <Input
              label="우편번호"
              name="postcode"
              value={selected.postcode}
              required={false}
            />
            <Input
              label="상세주소"
              name="detailAddress"
              placeholder="예: 101동 202호"
              value={selected.detailAddress || ""}
              required={false}
            />
          </Form>
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
