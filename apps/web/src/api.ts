export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "X-Geuncha-Request": "1",
    ...extraHeaders,
  };
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers,
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error?.message ?? "요청에 실패했습니다.",
      result.error?.code ?? "UNKNOWN",
      response.status,
      result.error?.fields,
    );
  return result.data as T;
}
export const money = (value: number = 0) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
export const time = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const stateLabels: Record<string, string> = {
  REQUESTED: "호스트 확인 중",
  APPROVED: "승인 · 결제 대기",
  CONFIRMED: "예약 확정",
  IN_USE: "이용 중",
  RETURNED: "반납 완료",
  SETTLEMENT_PENDING: "정산 대기",
  COMPLETED: "이용 완료",
  REJECTED: "예약 거절",
  CANCELLED: "예약 취소",
  EXPIRED: "기한 만료",
  draft: "등록 준비 중",
  published: "예약 가능",
  hidden: "비공개",
  deleted: "삭제됨",
};
