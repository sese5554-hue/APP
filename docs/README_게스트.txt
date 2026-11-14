근차 게스트 README
상태: UI·API·MariaDB 구현 / 외부 공급자 미연동 별도 표시

1. 역할 및 범위
차량 탐색·예약·이용 준비
화면: 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 45, 48
공용 20~24의 인수/반납/비교/정산/후기도 게스트 이용 흐름에 포함된다. README_공용.txt와 해당 화면 문서를 함께 읽는다.

2. 읽는 순서
00_전체_구현_프롬프트.txt → 01_PRD.txt → 02_구현순서.txt → 03_MariaDB_설계.txt → 아래 화면별 문서.
화면 구현은 전체 00~51 번호순, 공통 서비스/DB는 선행 작성 가능. 아래 목록은 이 구분 내의 순서다.

3. 화면별 PRD 및 구현 순서
08. 게스트 홈
+  문서: pages/08_guest-home.txt
+  원본: ../08-guest-home.svg
+  프론트엔드: 로그인 사용자 인사·활동 동네·주변 차량·빠른 필터·하단 검색/예약/채팅/마이를 제공한다. 비회원 접근 시 공개 탐색 모드로 동작한다.
+  API: GET /api/auth/me(선택); GET /api/vehicles?area=&fuel=&bodyType=&page=&limit=. 사용자가 지역을 바꾸면 이전 응답이 새 검색을 덮지 않게 한다.
+  DB/권한: 공개 vehicles/사진/후기 집계, 사용자 프로필·동네. 거리·평점은 실제 데이터로 표시.
+  완료 검증: 로그인/비회원/동네 미인증, 필터 변경, 결과 없음, API 실패; 하단 메뉴 실제 경로 연결.

09. 지도에서 차량 찾기
+  문서: pages/09_map-expanded.txt
+  원본: ../09-map-expanded.svg
+  프론트엔드: 지도 이동·확대에 맞춰 차량 가격 마커와 목록을 동기화하고 선택 카드를 표시한다. 현재 위치 권한과 지도 공급자 오류를 처리한다.
+  API: GET /api/vehicles?bbox=west,south,east,north&startsAt=&endsAt=&limit= → 위치/가격/요약. bbox 범위·최대 결과 수 제한.
+  DB/권한: vehicles pickup_lat/lng와 가용 기간/예약. 공개 지도에는 대략적 위치, 상세 인수 좌표는 권한에 따라 제공.
+  완료 검증: 마커→차량 상세 연결; 지도 이동 재검색; 위치 거부 시 지역 중심 사용; 공급자 미연동은 목록 대체와 명시적 안내.

10. 차량 검색 결과
+  문서: pages/10_search-results.txt
+  원본: ../10-search-results.svg
+  프론트엔드: 지역/기간/필터 요약·결과 수·카드·정렬·페이지네이션을 제공한다. 검색 상태를 URL에 보존한다.
+  API: GET /api/vehicles?area=&startsAt=&endsAt=&fuel=&bodyType=&minPrice=&maxPrice=&seats=&sort=&page=&limit=. 허용 sort만 처리.
+  DB/권한: vehicles, vehicle_availability, 점유 중 bookings, reviews. 날짜 조건은 예약 충돌을 제외하되 최종 생성 시 다시 검사.
+  완료 검증: URL 새로고침 유지; 가격순/날짜 가용성 필터 정확성; 잘못된 페이지·정렬 거부; 공개 차량만 노출.

11. 검색 필터
+  문서: pages/11_search-filter.txt
+  원본: ../11-search-filter.svg
+  프론트엔드: 크기·차체·연료·좌석·최소/최대 일일 예산을 입력하고 초기화·적용한다. 미적용 임시값과 현재 검색값을 구별한다.
+  API: GET /api/vehicles/count?필터 → count. 검색 API와 같은 schema와 조건식을 사용한다. 가격은 원 단위 정수, 최소≤최대.
+  DB/권한: 검색 필터는 URL/클라이언트 상태; 새 필터 전용 DB 테이블을 만들지 않는다.
+  완료 검증: 초기화/취소/적용/뒤로가기; 잘못된 범위 거부; 표시 결과 수와 실제 조회 조건 일치.

12. 차량 상세
+  문서: pages/12_vehicle-detail.txt
+  원본: ../12-vehicle-detail.svg
+  프론트엔드: 차량 사진·외관 등급·기본 사양·후기 집계·호스트 공개 프로필과 일일 요금을 표시한다. 날짜 선택 진입을 제공한다.
+  API: GET /api/vehicles/:id → 공개 상세; GET /api/vehicles/:id/reviews?page=&limit=. 비공개/삭제 차량은 권한에 맞게 404.
+  DB/권한: vehicles/사진/태그, 공개 users, reviews, 검증 요약. 실제 응답률/평균 응답시간을 계산하지 못하면 가짜 수치를 표시하지 않는다.
+  완료 검증: 비공개 차량 직접 URL 차단; 사진 없음 대체; 리뷰 집계 일치; 본인 차량 예약 서버 거부.

13. 차량 세부 정보
+  문서: pages/13_vehicle-specs.txt
+  원본: ../13-vehicle-specs.svg
+  프론트엔드: 크기·좌석·연식·연료·연비/단위·편의 옵션·대략적 인수 장소를 보여준다. 보험 보장은 별도 상품 정보와 구별한다.
+  API: GET /api/vehicles/:id/specs → size,seats,year,fuel,efficiency,efficiencyUnit,options,pickupArea. 상세에서 파생된 동일한 DTO 규칙 사용.
+  DB/권한: vehicles와 vehicle_tag_links. 전기차 km/kWh, 내연기관 km/L. 완전자차 옵션 태그를 보험 가입 증거로 쓰지 않는다.
+  완료 검증: 누락 사양은 미등록 표시; 단위 일치; 정확한 비공개 픽업 안내 미노출; 예약 버튼의 차량 ID 유지.

14. 대여 일정
+  문서: pages/14_date-selection.txt
+  원본: ../14-date-selection.svg
+  프론트엔드: 실제 현재 월 기준 달력·대여/반납 시간·불가 일정을 표시한다. 과거 날짜·종료≤시작은 선택/제출을 막는다.
+  API: GET /api/vehicles/:id/availability?from=&to= → available/blocked; POST /api/bookings/quote {vehicleId,startsAt,endsAt,insuranceProductId?} → quoteId/breakdown/expiresAt.
+  DB/권한: vehicle_availability, 점유 bookings, 차량 가격. 서버 UTC 검사, 프론트 Asia/Seoul 표시. quote는 재고 점유가 아님.
+  완료 검증: 월 경계/같은 날 시간/24시간 초과 과금; 가용 기간 밖/겹침/과거 거부; 날짜 변경 시 이전 견적 폐기.

15. 예약 확인
+  문서: pages/15_booking-summary.txt
+  원본: ../15-booking-summary.svg
+  프론트엔드: 기간·차량·인수 지역·차량료·게스트 수수료·보험료·총액을 서버 견적으로 표시한다. 일정/보험 수정 후 재견적한다.
+  API: POST /api/bookings/quote {vehicleId,startsAt,endsAt,insuranceProductId} → quoteId,pricedAt,expiresAt,lineItems,total,hostNet. 클라이언트 금액 입력 없음.
+  DB/권한: 차량/보험 버전 기반 요금 스냅샷. 견적 만료 시 재계산과 변경 동의 후 진행.
+  완료 검증: 68,000+18,000+6,800=92,800 검증; 보험 변경 즉시 총액 반영; 금액 변조 무시; 인증 미완료 시 안내.

16. 결제 수단 및 예약 요청
+  문서: pages/16_payment.txt
+  원본: ../16-payment.svg
+  프론트엔드: 보유 결제수단·등록 진입·금액을 보여준다. 호스트 승인형 정책에 따라 최초 제출은 예약 요청 접수로 표시하며 승인 후 결제를 진행한다.
+  API: GET /api/me/payment-methods; POST /api/bookings {quoteId,paymentMethodId,consent} + Idempotency-Key → REQUESTED; POST /api/bookings/:id/pay → payment/status(승인 후만).
+  DB/권한: bookings/payments/payment_methods. 차량 잠금·요금 재검증·소유권·인증 확인. 결제 의도 저장 후 외부 호출, 서버 검증 후 확정.
+  완료 검증: 더블클릭/재시도 시 예약·청구 한 번; 타인 카드 거부; 승인 전 청구 거부; 결제 실패/시간초과/미연동 안내.

17. 예약 요청 및 완료
+  문서: pages/17_booking-complete.txt
+  원본: ../17-booking-complete.svg
+  프론트엔드: 서버에서 재조회한 상태에 따라 요청 접수/승인 후 결제 대기/예약 확정을 구별한다. 실제 예약 번호·기간·차량과 상세/채팅 진입을 표시한다.
+  API: GET /api/bookings/:id → status,paymentStatus,reference,vehicle,period,allowedActions. 결제 리디렉션의 success 파라미터를 성공 증거로 사용하지 않는다.
+  DB/권한: bookings와 서버 검증된 payments. 클라이언트 임시 상태를 정본으로 쓰지 않는다.
+  완료 검증: 새로고침/직접 URL에서 복구; 다른 계정 차단; 실패 결제가 완료로 보이지 않음; 상태에 맞는 CTA.

18. 예약 상세
+  문서: pages/18_booking-detail.txt
+  원본: ../18-booking-detail.svg
+  프론트엔드: 예약 상태·기간·호스트·권한에 맞는 정확한 픽업 안내·결제/취소/인수 버튼을 제공한다. 허용 동작은 서버 응답을 따른다.
+  API: GET /api/bookings/:id; POST /api/bookings/:id/cancel {reason}; 승인 후 /pay. 취소는 환불 상태를 함께 반환하며 외부 실패를 숨기지 않는다.
+  DB/권한: bookings/payments/vehicles, 허용 상태 전이. 참여자만 조회. 게스트 본인만 요청 취소, 이용 중 자동 취소 불가.
+  완료 검증: 타인 ID 접근 거부; 취소/환불 중복 처리; 승인/만료 경쟁; CONFIRMED만 인수 가능.

45. 게스트 예약 목록
+  문서: pages/45_guest-bookings.txt
+  원본: ../45-guest-bookings.svg
+  프론트엔드: 다가오는/지난 이용과 요청/승인 대기/확정/취소·완료 상태를 구별하고 적절한 상세/결제/인수 버튼을 제공한다.
+  API: GET /api/me/bookings?tab=&status=&page=&limit=. 게스트 본인 기준 조회, 시간과 상태 기준으로 탭 분류.
+  DB/권한: bookings/vehicles/호스트 공개 프로필. 페이지 총수와 상태 필터를 일치.
+  완료 검증: 자기 예약만 조회; 과거 미완료 예약의 상태 처리; 취소/만료 표기; 상세 ID 유지 및 재방문 복원.

48. 보험 선택
+  문서: pages/48_insurance.txt
+  원본: ../48-insurance.svg
+  프론트엔드: 완전자차/일반자차의 일요금·보장·자기부담금·면책·기간 합계를 보여주고 선택 후 예약 요약으로 돌아간다. 실제 계약 없는 보장을 확정 문구로 쓰지 않는다.
+  API: GET /api/insurance-products?vehicleId=&startsAt=&endsAt= → products/version/mode; POST /api/bookings/quote로 상품 선택 재계산.
+  DB/권한: insurance_products와 예약 보험 스냅샷. 가입 실행은 공급자 결과 확인 후 상태 저장. 시안 18,000/9,000은 개발 샘플로만 사용.
+  완료 검증: 보험 변경 시 기간 전체 보험료 반영; 만료 상품/허용 안 된 차량 거부; 예약 후 상품 변경이 기존 계약을 바꾸지 않음.

4. 소스코드 설명 기준
구현 후 각 화면의 실제 파일과 핵심 함수를 이 문서에 기록한다. 예정 경로: apps/web/src/pages, apps/api/src/modules/bookings, packages/contracts, database/migrations.
실제 소스와 단계별 커밋은 implementation-status.json 및 08_실제구현.txt에서 관리한다. 원래 예정 경로 대신 기능별 pages/Auth.tsx, Guest.tsx, Shared.tsx, Host.tsx와 API 책임별 모듈로 구현했다. ../scripts/generate-docs.mjs는 원본 PRD와 실제 구현 상태를 결합해 이 TXT와 화면별 TXT를 생성한다. ../scripts/check-docs.mjs는 52개 정본·실제 소스 존재·참조를 검사한다.
문서 생성기를 다시 실행하면 화면별 TXT 및 이 README TXT를 재생성하므로 실제 구현 이력은 07_구현기록.txt에 먼저 남긴다. 구현 시 생성기 명세에도 이력 반영 방식을 추가하거나 이 문서의 관리를 수동으로 전환하고 재생성 정책을 갱신한다.

5. SOLID / KISS / YAGNI
SOLID: 컨트롤러/업무 서비스/저장소/화면 책임을 구별하고 외부 provider만 필요한 경계에서 주입한다.
KISS: 공통 상태 전이/요금 계산/DTO를 재사용하고 같은 규칙을 여러 화면에 복제하지 않는다.
YAGNI: 위 화면에 필요한 기능만 구현한다. 미요구 운영자 UI·쿠폰·포인트 등을 선제 추가하지 않는다.
적용 기준 전문: 04_SOLID_KISS_YAGNI.txt. 실제 적용 여부는 코드와 검증으로 기록한다.

6. 실제 구현 기록
앱 소스: [03] 공개 탐색·검색·지도·견적·예약·개발 결제 (4e7ebe2)
실제 파일: apps/web/src/pages/Guest.tsx, apps/web/src/GeoMap.tsx, apps/api/src/modules/vehicles/routes.ts, apps/api/src/modules/vehicles/repository.ts, apps/api/src/modules/bookings/service.ts, apps/api/src/modules/bookings/routes.ts
MariaDB migration: 001_initial.sql / 002_chat_and_setup.sql 적용
검증: 실제 결과·환경·테스트 명령은 08_실제구현.txt 및 저장소 README 참조
외부 공급자: 실제 카카오·PASS·문자·면허·GPS 지역 판정 공급자 미연동; PG 카드 등록·실제 결제·환불·계좌 지급 공급자 미연동; 실제 보험 가입/보장 및 통행료 공급자 미연동; 외관 AI 미연동: 개발 B등급 예시/수동 비교 제공; 요금 추천: 비교 차량 평균과 등급을 사용한 개발 규칙, 학습 AI 수요예측 아님; 이메일/기기 푸시 미연동; AWS 배포 및 Ubuntu 실기동 미수행
구현 이력 정본: 08_실제구현.txt / API 정본: 09_API_실행계약.txt
향후 기록: 화면번호 / 구현 순서 / 실제 소스파일 / 핵심 함수와 호출 흐름 / API·DB / 원칙별 적용 / 검증명령·결과 / 미연동.

7. 사용 도구
문서 작업에 실제 사용한 도구와 앱 도입 후보는 06_사용도구.txt를 참조한다. 기능 구현 시 정확한 버전과 사용 위치를 그 문서에 추가한다.
