주소 192.0.2.10은 문서용 예시입니다. 실제 접속할 때는 서버 PC에서 표시되는 PHONE URL 또는 SCREEN TEST URL로 바꾸세요.

iOS 화면 테스트: Windows만 있으면 Safari 홈 화면 추가 방식으로 테스트합니다.
PC에서 Geuncha Mobile Test 또는 start-screen-test.cmd를 실행하고 같은 Wi-Fi의
iPhone Safari에서 SCREEN TEST URL을 엽니다. 공유 → 홈 화면에 추가 → 추가를 누릅니다.
웹 앱으로 열기 선택이 보이면 켜 둡니다. PC 주소가 바뀌면 새 주소로 아이콘을 다시 추가합니다.
이 방식은 네이티브 IPA 설치가 아니며 PC 서버가 계속 실행 중이어야 합니다.

네이티브 iOS 프로젝트의 기본 빌드 설정은 [test-settings.json](test-settings.json)에서 바꿉니다.

기본값 `mode: "local"`, `lanIp: ""`는 빌드하는 Mac의 LAN 주소를 자동으로 찾습니다.
Windows PC에서 서버를 실행하고 Mac에서 앱을 빌드한다면 `lanIp`에 Windows PC의 주소를 입력하세요.
예: `"lanIp": "192.0.2.10"`. `port` 기본값은 `5173`입니다.

1. Windows PC에서 `start-screen-test.cmd`를 실행합니다.
2. 같은 Wi-Fi의 iPhone Safari에서 출력된 SCREEN TEST URL을 엽니다. Mac이나 앱 설치 없이 화면을 확인할 수 있습니다.
3. iOS 앱으로 테스트하려면 Mac에서 저장소를 열고 `npm ci`, `npm run mobile:ios`, `npm run mobile:open:ios`를 실행합니다.
4. Xcode에서 Team과 Bundle Identifier를 설정하고 iPhone으로 Run합니다.

Debug 구성은 동기화 때 생성되는 `App/App/Info-Debug.plist`로 LAN HTTP 접속을 허용합니다.
Release는 기존 `Info.plist`를 사용합니다. HTTP 예외는 Debug에만 추가됩니다.
GPS는 HTTP에서 제한될 수 있으므로 현재는 화면 확인용으로 사용하세요.

네이티브 앱에는 PC 연결 주소 설정 버튼과 주소 저장 기능을 구현했습니다.
주소만 바뀌면 앱 안에서 변경할 수 있습니다. Windows에서는 Swift 컴파일·iPhone 실행을 검증하지 못했습니다.
Mac에서 시작하려면 저장소 루트에서 `bash ios/open-ios.command`를 실행할 수 있습니다.
iPhone만 바뀌고 서버 주소가 같아도 새 기기의 Apple 서명·설치는 Xcode에서 진행해야 합니다.
추후 HTTPS 서버는 `mode: "server"`, `serverUrl: "https://실제주소"`로 설정합니다.
`MOBILE_SERVER_URL` 환경변수가 있으면 파일보다 우선합니다.
