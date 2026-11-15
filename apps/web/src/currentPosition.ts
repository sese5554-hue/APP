import { Capacitor } from "@capacitor/core";

export async function currentPosition() {
  const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const permission = await Geolocation.requestPermissions();
    if (
      permission.location !== "granted" &&
      permission.coarseLocation !== "granted"
    )
      throw new Error("기기 설정에서 근차의 위치 권한을 허용해 주세요.");
    return Geolocation.getCurrentPosition(options);
  }
  if (!window.isSecureContext || !navigator.geolocation)
    throw new Error(
      "브라우저 위치 확인에는 HTTPS 접속이 필요합니다. 모바일 앱의 기기 위치 기능 또는 주소 검색을 이용해 주세요.",
    );
  return new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options),
  );
}
