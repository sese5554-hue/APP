근차 회원가입 및 로그인 README
상태: UI·API·MariaDB 구현 / 외부 공급자 미연동 별도 표시

1. 역할 및 범위
계정 생성·인증·약관과 역할 관리
화면: 00, 01, 02, 03, 04, 05, 06, 07
가입 전 동의·역할 선택과 가입 후 인증을 이어서 처리한다. 인증 입력 저장을 실제 공급자 인증 성공으로 대신하지 않는다.

2. 읽는 순서
00_전체_구현_프롬프트.txt → 01_PRD.txt → 02_구현순서.txt → 03_MariaDB_설계.txt → 아래 화면별 문서.
화면 구현은 전체 00~51 번호순, 공통 서비스/DB는 선행 작성 가능. 아래 목록은 이 구분 내의 순서다.

3. 화면별 PRD 및 구현 순서
00. 약관 및 권한 동의
+  문서: pages/00_consent-permissions.txt
+  원본: ../00-consent-permissions.svg
+  프론트엔드: 필수 개인정보·제3자 제공·위치 약관과 선택 마케팅 채널을 개별 선택한다. 전체 동의와 개별 선택을 동기화한다. 기기 위치 권한은 위치 기능 사용 시 별도 요청한다.
+  API: GET /api/terms → 버전/필수 여부/문구; POST /api/consents {versions,choices,signupChallenge?} → receiptId. 가입 전 동의는 서버가 발급한 참조로 묶고 가입 시 계정에 귀속한다.
+  DB/권한: consent_records, 약관 버전 설정. 필수 동의 누락은 서버도 거부하며 선택 채널은 기본 미동의.
+  완료 검증: 필수 누락 시 진행 차단; 선택 미동의여도 진행; 새 약관 버전 요구와 중복 제출 처리; 동의만으로 GPS 권한 승인으로 표시하지 않음.

01. 홈 둘러보기
+  문서: pages/01_welcome.txt
+  원본: ../01-welcome.svg
+  프론트엔드: 비회원 주변 차량 카드·지도 진입·빠른 필터를 제공한다. 로그인/회원가입 이동과 예약 시 인증 진입 경로를 표시한다.
+  API: GET /api/vehicles?area=&fuel=&page=&limit= → items/total/page; 공개 DTO에는 연락처·비공개 인수 안내를 포함하지 않는다.
+  DB/권한: vehicles, vehicle_photos, reviews의 공개 집계. 공개/인증 완료 차량만 검색.
+  완료 검증: 로그인 없이 목록·상세 조회; 예약 시 로그인 필요; 비공개 차량과 개인정보 미노출; 빈 목록/실패/재시도.

02. 이용 유형 선택
+  문서: pages/02_role-select.txt
+  원본: ../02-role-select.svg
+  프론트엔드: 게스트/호스트를 선택하고 선택 상태와 다음 진입 위치를 표시한다. 미가입 선택은 가입 과정에 전달하고 기존 계정은 역할 추가·전환을 구별한다.
+  API: POST /api/me/roles {role} → roles; PATCH /api/me/active-role {role} → activeRole. 인증 전 선택값은 가입 요청에 검증하여 포함한다.
+  DB/권한: user_roles, users.active_role. 역할 문자열 allowlist; 클라이언트의 임의 관리자 역할 금지.
+  완료 검증: 선택 없이 진행 차단; 호스트·게스트 역할 보유 상태 유지; 미보유 역할로 직접 전환 거부.

03. 로그인
+  문서: pages/03_login.txt
+  원본: ../03-login.svg
+  프론트엔드: 아이디·비밀번호, 표시 전환, 실패/잠김/로딩을 제공한다. 카카오와 아이디·비밀번호 복구 동작도 제공하되 공급자 미설정을 구별한다.
+  API: POST /api/auth/login {loginId,password}; POST /api/auth/logout; GET /api/auth/me; GET /api/auth/kakao/start 및 callback(state 검증); POST /api/auth/recovery/start와 /complete(일회성 토큰).
+  DB/권한: users, sessions, auth_challenges. 세션 재발급·만료, 해시 검증, 시도 제한; 복구 응답으로 계정 존재 여부 노출 방지.
+  완료 검증: 정상/오류 비밀번호, 세션 만료/로그아웃, 인증 시도 제한, OAuth state 변조와 복구 토큰 재사용 거부. 미연동은 성공 처리 금지.

04. 회원가입
+  문서: pages/04_signup.txt
+  원본: ../04-signup.svg
+  프론트엔드: 영문·숫자 6~20자 아이디 중복 확인, 최소 8자 비밀번호·확인, 휴대폰 OTP, 약관 동의를 제공한다. 아이디 변경 시 중복 확인을 무효화한다.
+  API: GET /api/auth/login-id-availability?loginId=; POST /api/auth/phone-challenges {phone}; POST /api/auth/phone-challenges/:id/verify {code}; POST /api/auth/signup {loginId,password,phoneChallengeId,consentReceiptId,role}.
+  DB/권한: users.login_id UNIQUE, auth_challenges, consent_records, user_roles. OTP 만료/시도 제한/일회 사용. 가입과 참조 귀속은 트랜잭션.
+  완료 검증: 동시 동일 아이디 가입은 하나만 성공; 확인값 불일치/만료 OTP/필수약관 누락 거부; 비밀번호·OTP 원문 로그 없음.

05. 본인 확인
+  문서: pages/05_identity-check.txt
+  원본: ../05-identity-check.svg
+  프론트엔드: PASS/문자 선택, 인증 진행·취소·실패·만료·완료를 표시한다. 시안 예시 성공을 실제 인증으로 재사용하지 않는다.
+  API: POST /api/verifications/identity {method} → verificationId/redirect; POST /api/providers/identity/callback(공급자 검증); GET /api/verifications/:id → status/mode. callback은 서명과 중복 검증.
+  DB/권한: user_verifications. 공급자 참조·성공 시각·만료 저장. 민감 원문 최소화, 본인 확인과 단순 휴대폰 소유 확인을 구별.
+  완료 검증: 다른 계정 인증 참조 접근 거부; 위조 callback 거부; 개발 결과는 개발 표시; 운영 미설정은 성공 불가.

06. 동네 인증
+  문서: pages/06_neighborhood-check.txt
+  원본: ../06-neighborhood-check.svg
+  프론트엔드: 명시적 버튼 동작에서 geolocation을 요청한다. 권한 거부·시간초과·부정확 위치를 처리한다. 인증 불가 시 지역 수동 검색은 허용하되 인증 완료로 표시하지 않는다.
+  API: POST /api/verifications/neighborhood {latitude,longitude,accuracy,capturedAt} → neighborhood/status/expiresAt. 서버가 경계 데이터/공급자로 지역 판정; 좌표 범위와 최신성 검사.
+  DB/권한: user_verifications, 지역 코드 설정. GPS 입력만으로 위변조 방지를 보증하지 않는다. 고정밀 좌표는 필요한 기간만 저장.
+  완료 검증: 권한 허용/거부/범위 밖/오래된 좌표; 수동 지역 선택과 인증 구별; 만료 인증 처리. 지역 판정 공급자 미연동 명시.

07. 면허 정보 입력
+  문서: pages/07_license-entry.txt
+  원본: ../07-license-entry.svg
+  프론트엔드: 면허 종류/번호/발급일/유효기간을 입력한다. 입력 중 마스킹과 일관된 날짜 검증, 검증 진행 상태를 표시한다.
+  API: POST /api/verifications/license {type,number,issuedOn,expiresOn} → verificationId/status/mode. 전체 번호를 응답에 되돌리지 않고 공급자 검증 후 마스킹/참조만 저장.
+  DB/권한: user_verifications와 면허 메타데이터. 유효기간 및 본인 확인 관계 검증. provider 미설정이면 인증 성공 불가.
+  완료 검증: 종료일<발급일, 만료 면허, 형식 오류 거부; API/로그/화면에 원문 재노출 없음; 새로고침 후 저장 결과 조회.

4. 소스코드 설명 기준
구현 후 각 화면의 실제 파일과 핵심 함수를 이 문서에 기록한다. 예정 경로: apps/web/src/pages, apps/api/src/modules/auth, packages/contracts, database/migrations.
실제 소스와 단계별 커밋은 implementation-status.json 및 08_실제구현.txt에서 관리한다. 원래 예정 경로 대신 기능별 pages/Auth.tsx, Guest.tsx, Shared.tsx, Host.tsx와 API 책임별 모듈로 구현했다. ../scripts/generate-docs.mjs는 원본 PRD와 실제 구현 상태를 결합해 이 TXT와 화면별 TXT를 생성한다. ../scripts/check-docs.mjs는 52개 정본·실제 소스 존재·참조를 검사한다.
문서 생성기를 다시 실행하면 화면별 TXT 및 이 README TXT를 재생성하므로 실제 구현 이력은 07_구현기록.txt에 먼저 남긴다. 구현 시 생성기 명세에도 이력 반영 방식을 추가하거나 이 문서의 관리를 수동으로 전환하고 재생성 정책을 갱신한다.

5. SOLID / KISS / YAGNI
SOLID: 컨트롤러/업무 서비스/저장소/화면 책임을 구별하고 외부 provider만 필요한 경계에서 주입한다.
KISS: 공통 상태 전이/요금 계산/DTO를 재사용하고 같은 규칙을 여러 화면에 복제하지 않는다.
YAGNI: 위 화면에 필요한 기능만 구현한다. 미요구 운영자 UI·쿠폰·포인트 등을 선제 추가하지 않는다.
적용 기준 전문: 04_SOLID_KISS_YAGNI.txt. 실제 적용 여부는 코드와 검증으로 기록한다.

6. 실제 구현 기록
앱 소스: [02] 약관·가입·로그인·역할·개발 인증 (496f5c1) / [03] 공개 탐색·검색·지도·견적·예약·개발 결제 (4e7ebe2)
실제 파일: apps/web/src/pages/Auth.tsx, apps/api/src/modules/auth/routes.ts, apps/api/src/middleware/auth.ts, apps/api/src/providers/index.ts, apps/web/src/pages/Guest.tsx, apps/web/src/GeoMap.tsx, apps/api/src/modules/vehicles/routes.ts, apps/api/src/modules/vehicles/repository.ts, apps/api/src/modules/bookings/service.ts, apps/api/src/modules/bookings/routes.ts
MariaDB migration: 001_initial.sql / 002_chat_and_setup.sql 적용
검증: 실제 결과·환경·테스트 명령은 08_실제구현.txt 및 저장소 README 참조
외부 공급자: 실제 카카오·PASS·문자·면허·GPS 지역 판정 공급자 미연동; PG 카드 등록·실제 결제·환불·계좌 지급 공급자 미연동; 실제 보험 가입/보장 및 통행료 공급자 미연동; 외관 AI 미연동: 개발 B등급 예시/수동 비교 제공; 요금 추천: 비교 차량 평균과 등급을 사용한 개발 규칙, 학습 AI 수요예측 아님; 이메일/기기 푸시 미연동; AWS 배포 및 Ubuntu 실기동 미수행
구현 이력 정본: 08_실제구현.txt / API 정본: 09_API_실행계약.txt
향후 기록: 화면번호 / 구현 순서 / 실제 소스파일 / 핵심 함수와 호출 흐름 / API·DB / 원칙별 적용 / 검증명령·결과 / 미연동.

7. 사용 도구
문서 작업에 실제 사용한 도구와 앱 도입 후보는 06_사용도구.txt를 참조한다. 기능 구현 시 정확한 버전과 사용 위치를 그 문서에 추가한다.
