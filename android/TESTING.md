Android 화면 테스트 설정은 [test-settings.json](test-settings.json)에서 바꿉니다.

기본값 `mode: "local"`, `lanIp: ""`는 빌드하는 PC의 Wi-Fi/LAN 주소를 자동으로 찾습니다.
다른 PC에서 서버를 실행한다면 `lanIp`에 그 PC의 주소를 넣으세요. 예: `192.168.55.3`.
`port`는 웹 서버 포트이며 기본값은 `5173`입니다.

1. 저장소 루트에서 `start-screen-test.cmd`를 실행합니다.
2. 휴대폰을 같은 Wi-Fi에 연결하고 출력된 SCREEN TEST URL을 엽니다.
3. Android 앱으로 테스트하려면 `build-apk.cmd`를 실행하거나 루트에서 `npm run mobile:apk`를 실행합니다.
   이 PC에 준비한 `.runtime/android-tools`의 Java·SDK를 자동 사용합니다.
   다른 PC에서는 Android Studio·JDK 21·SDK 36을 준비해야 합니다.
4. `releases/Geuncha-android-debug.apk`를 휴대폰에 복사해 설치합니다.

APK 상단의 `PC 연결 주소 설정`에서 서버 주소를 바꿀 수 있습니다. PC·Wi-Fi가 바뀌어도 APK를 다시 만들 필요가 없습니다.
`test-settings.json`은 프로젝트에서 앱을 빌드할 때 사용하는 기본 서버 설정입니다.
휴대폰만 바뀌고 서버 주소가 같다면 같은 APK를 사용할 수 있습니다.
브라우저 테스트는 APK 생성 없이 새 주소를 열면 됩니다.

추후 HTTPS 서버가 생기면 `mode: "server"`, `serverUrl: "https://실제주소"`로 바꾸세요.
`MOBILE_SERVER_URL` 환경변수가 설정돼 있다면 파일보다 우선합니다.
