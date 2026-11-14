근차 호스트 README
상태: 구현 요구사항·프롬프트 작성 / 앱 소스 미구현

1. 역할 및 범위
차량 등록·운영·요청 관리·수익
화면: 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 47, 49, 50, 51
49는 원본 기능 분류표에 누락되어 있지만 SVG가 있으므로 차량 등록 저장 확인 화면으로 포함했다. 47은 공용 프로필과 UI/API를 재사용한다.

2. 읽는 순서
00_전체_구현_프롬프트.txt → 01_PRD.txt → 02_구현순서.txt → 03_MariaDB_설계.txt → 아래 화면별 문서.
화면 구현은 전체 00~51 번호순, 공통 서비스/DB는 선행 작성 가능. 아래 목록은 이 구분 내의 순서다.

3. 화면별 PRD 및 구현 순서
25. 호스트 홈
+  문서: pages/25_host-home.txt
+  원본: ../25-host-home.svg
+  프론트엔드: 월 예상 수익·차량 상태·새 예약 요청과 호스트 하단 메뉴를 제공한다. 예상과 실제 지급액을 구별한다.
+  API: GET /api/host/dashboard?month=YYYY-MM → estimatedNet,paidOut,vehicles,pendingRequests. host 역할 필요, 항상 세션 사용자 기준.
+  DB/권한: 소유 vehicles/bookings/settlements/payout_records 집계. 월 구간은 서울 시각을 UTC로 변환.
+  완료 검증: 다른 호스트 합계 제외; 차량 0/요청 0 상태; 역할 없는 사용자 차단; 36 수익과 같은 기준.

26. 호스트 차량 목록
+  문서: pages/26_host-vehicles.txt
+  원본: ../26-host-vehicles.svg
+  프론트엔드: 작성 중/검토 중/공개/비공개 차량을 나눠 보여주고 등록 이어하기·정보 수정·차량 추가를 제공한다.
+  API: GET /api/host/vehicles?page=&limit= → items; POST /api/host/vehicles → draftId/currentStep. 목록에 등록 진행 단계와 누락 요건 반환.
+  DB/권한: vehicles/사진/분석 상태. 소유자 필터 필수, 다른 호스트 차량 제외.
+  완료 검증: 초기 빈 목록; 작성 중 이어가기; 공개 검색에는 draft 미노출; 페이지네이션/목록 갱신.

27. 차량 정보 수정 및 삭제
+  문서: pages/27_host-vehicle-edit.txt
+  원본: ../27-host-vehicle-edit.svg
+  프론트엔드: 기본 정보·번호·사양·사진 수정 진입과 저장/비공개·삭제 동작을 제공한다. 기존 예약에 영향을 주는 변경은 안내한다.
+  API: GET /api/host/vehicles/:id; PATCH /api/host/vehicles/:id {fields,version}; DELETE /api/host/vehicles/:id(보존형 삭제). 활성 예약이 있으면 삭제/충돌 변경 거부.
+  DB/권한: vehicles version 또는 updated_at 기반 충돌 검증. 변경 후 재심사 필요 필드와 예약 가격 스냅샷 보존.
+  완료 검증: 타인 수정/삭제 거부; 오래된 버전 409; 예약 이력 보존; 이름/옵션 수정 후 게스트 상세 반영.

28. 차량 기본 정보 입력
+  문서: pages/28_vehicle-information.txt
+  원본: ../28-vehicle-information.svg
+  프론트엔드: 차량명·연식·차량 번호·지역을 입력하고 draft를 저장한다. 뒤로가기/새로고침 후 복원한다.
+  API: POST /api/host/vehicles {name,year,registrationPlate,area} 또는 PATCH /api/host/vehicles/:id/basic. 번호 형식·중복 정책, 연식 범위 서버 검사.
+  DB/권한: vehicles draft. 원본에 없는 registration_plate 필드 추가. 차량 인증 성공 없이 공개 금지.
+  완료 검증: 필수 누락/잘못된 연식/번호 중복 검사; draft 저장/복구; 본인 소유 draft만 이어쓰기.

29. 차량 종류와 사양 입력
+  문서: pages/29_vehicle-category.txt
+  원본: ../29-vehicle-category.svg
+  프론트엔드: 크기·차체·연료·좌석·변속기·연비를 선택하고 연료에 따라 단위를 설정한다.
+  API: PATCH /api/host/vehicles/:id/specs {size,bodyType,fuel,seats,transmission,efficiency,efficiencyUnit}. enum/range와 연료-단위 조합 검증.
+  DB/권한: vehicles의 사양 필드. 클라이언트 문자열 자유 입력 대신 허용된 코드 사용.
+  완료 검증: 음수 연비/0좌석/미지원 단위 거부; 연료 전환 시 단위 갱신; 게스트 13과 값 일치.

30. 차량 세부사항 입력
+  문서: pages/30_vehicle-details.txt
+  원본: ../30-vehicle-details.svg
+  프론트엔드: 픽업 주소/안내·편의 옵션·차량 소개를 저장한다. 소개의 개행을 보존하고 저장 중 중복 제출을 막는다.
+  API: PATCH /api/host/vehicles/:id/details {pickupAddress,pickupInstructions,options,description,version} → persistedSummary. 좌표는 확인된 지도 결과와 연결.
+  DB/권한: vehicles, vehicle_tags, vehicle_tag_links. 옵션 연결 변경은 트랜잭션. 보험 옵션은 실제 가입 상태와 분리.
+  완료 검증: 실제 DB 저장 성공 때만 49 이동; 실패 시 입력 유지; XSS 문자열 실행 안 됨; 타인 draft 거부.

31. 차량 외관 사진 등록
+  문서: pages/31_vehicle-photos.txt
+  원본: ../31-vehicle-photos.svg
+  프론트엔드: 방향별 파일 선택·미리보기·재시도·삭제·대표 이미지·순서 조정을 제공한다. 등록 권장과 공개 필수 조건을 구별한다.
+  API: POST /api/uploads purpose=vehicle-photo; PUT /api/host/vehicles/:id/photos {items:[{uploadId,angle,order,isCover}]}; POST /api/host/vehicles/:id/analysis → job/status.
+  DB/권한: uploads/vehicle_photos, 분석 작업 상태. 초기 공개 기준 8방향 사진 제안, 실제 형식/용량/MIME·매직바이트 검사. SVG 실행 파일 업로드 금지.
+  완료 검증: 다른 사용자 업로드 연결 거부; 허용 크기 초과/위장 파일 거부; 사진 실패 후 재개; 분석 시작 중복 방지.

32. AI 외관 등급
+  문서: pages/32_ai-grade.txt
+  원본: ../32-ai-grade.svg
+  프론트엔드: A~D 등급·손상 후보·신뢰도·분석 모드·모델 버전·검토 대기/실패를 표시한다. 분석이 없으면 B를 고정 표시하지 않는다.
+  API: GET /api/host/vehicles/:id/analysis → status,grade,candidates,modelVersion,mode; 재시도 POST /analysis. 결과 적용은 서버 provider 검증 후만.
+  DB/권한: 차량 분석 결과/사진 버전. 사진 변경 시 과거 등급을 최신으로 표시하지 않는다. 외관 등급과 소유·법적 차량 인증은 별개.
+  완료 검증: pending/failed/개발 모드 처리; 사진 버전 변경 무효화; 클라이언트 등급 조작 거부; 운영 미연동 표시.

33. 대여 가능 일정과 요금
+  문서: pages/33_availability-pricing.txt
+  원본: ../33-availability-pricing.svg
+  프론트엔드: 달력에서 기간·시간을 설정하고 일요금을 입력한다. AI 추천 보기와 수동 수정·저장/공개를 제공한다.
+  API: PUT /api/host/vehicles/:id/availability {periods}; PATCH /api/host/vehicles/:id/pricing {dailyPrice,version}; POST /api/host/vehicles/:id/publish. 공개 요건과 차량 인증 검사.
+  DB/권한: vehicle_availability/vehicles. 날짜 구간 정규화, 가격>0, 활성 예약과 충돌하는 운영 변경 거부. 예약 가격 스냅샷 불변.
+  완료 검증: 겹친 기간/역전/과거/예약 충돌 거부; 필수 사진·인증 없는 공개 차단; 새 요금은 신규 견적에만 적용.

34. 호스트 예약 목록
+  문서: pages/34_host-reservations.txt
+  원본: ../34-host-reservations.svg
+  프론트엔드: 확인 필요/확정/이용 중/과거 탭과 일정 캘린더를 제공한다. 목록 상태와 요청 상세를 연결한다.
+  API: GET /api/host/bookings?status=&from=&to=&page=&limit=. allowed status·기간 제한과 소유 호스트 필터.
+  DB/권한: bookings/차량/게스트 공개 프로필. 취소/만료는 활성 재고와 구별.
+  완료 검증: 탭별 결과·총수 일치; 월 경계; 타인 차량 요청 없음; 승인 후 목록 상태 갱신.

35. 예약 요청 상세 및 관리
+  문서: pages/35_host-reservation-detail.txt
+  원본: ../35-host-reservation-detail.svg
+  프론트엔드: 게스트 인증 요약·기간·예상 순수익·매너/평가·승인/거절·채팅 진입을 제공한다. 호스트의 일방적 일정 변경 대신 게스트 동의가 필요한 변경은 범위 밖 안내.
+  API: GET /api/host/bookings/:id; POST /api/host/bookings/:id/approve; POST /api/host/bookings/:id/reject {reason}. 상태/기한/충돌 잠금 검사; 승인 후 게스트 결제 대기.
+  DB/권한: bookings와 인증·수익 스냅샷. 호스트 자기 차량 예약만 관리. 개인정보 원문 대신 상태만 조회.
+  완료 검증: 타인 승인/중복 승인/만료 후 승인 거부; 승인-취소 동시 요청; 거절 시 점유 해제; 수익61,200 계산 일치.

36. 호스트 수익 대시보드
+  문서: pages/36_host-earnings.txt
+  원본: ../36-host-earnings.svg
+  프론트엔드: 월별 예상/확정/지급 대기/지급 완료·수수료를 구별하고 일별 추이와 거래 상세를 제공한다. 비교 대상이 없으면 증감률 미표시.
+  API: GET /api/host/earnings?month=YYYY-MM; GET /api/host/payouts?page=&limit=. 합계 기준(이용완료일/지급일)을 각 지표에 명시.
+  DB/권한: bookings/settlements/payout_records/payments. 취소·환불 반영, 타인 수익 제외, 지급 참조 없는 완료 금지.
+  완료 검증: 월/연도 경계·환불·0건; 수수료와 순수익 합계; 25와 같은 예상 기준; 실제 이체 미연동 구별.

47. 호스트 마이페이지
+  문서: pages/47_host-my-page.txt
+  원본: ../47-host-my-page.svg
+  프론트엔드: 37과 같은 공용 프로필·설정 메뉴에 호스트 역할·게스트 전환·수익/차량 관리를 연결한다. 화면 공통 컴포넌트를 재사용한다.
+  API: GET /api/me/profile; PATCH /api/me/active-role; GET /api/host/dashboard의 요약. 서버 host 권한 필수.
+  DB/권한: users/user_roles, 호스트 요약. 화면 모드 문자열만 바꾸어 권한을 우회하지 않는다.
+  완료 검증: 37과 수정 내용 동기화; 게스트 전환; 수익/차량 경로 연결; 역할 미보유 접근 거부.

49. 차량 세부사항 저장 완료
+  문서: pages/49_vehicle-details-saved.txt
+  원본: ../49-vehicle-details-saved.svg
+  프론트엔드: 30에서 저장된 차량명·연식·사양·픽업/옵션 저장 요약을 재조회하고 사진 등록 계속하기를 제공한다. URL만으로 성공 메시지를 만들지 않는다.
+  API: GET /api/host/vehicles/:id/registration-progress → completedSteps/detailsSavedAt/summary/nextStep. 세부정보 저장 이력이 없으면 30으로 안내.
+  DB/권한: vehicles와 옵션 연결. 별도 saved-success 테이블 불필요; 저장 단계/시각은 실제 업데이트에서 기록.
+  완료 검증: 30 저장 실패 시 진입하지 않음; 직접 URL/새로고침 복구; 타인 ID 거부; 31로 같은 draft ID 전달.

50. AI 요금 추천 이유
+  문서: pages/50_ai-pricing-reason.txt
+  원본: ../50-ai-pricing-reason.svg
+  프론트엔드: 추천/현재 요금·근거·산정시각·샘플수·모드·불확실성을 보여주고 명시적 적용 버튼을 제공한다. 근거 없는 예약률 상승 수치는 표시하지 않는다.
+  API: GET /api/host/vehicles/:id/pricing-recommendation → recommendationId,amount,factors,modelVersion,mode; POST /api/host/vehicles/:id/pricing-recommendation/apply {recommendationId,version}.
+  DB/권한: 차량 분석/추천 스냅샷, vehicles.daily_price. 개발 규칙 기반이면 AI 실모델로 가장하지 않는다. 적용 시 소유권/만료/가격 검증.
+  완료 검증: 조회만으로 요금 변경 없음; 만료 추천/타인 적용 거부; 적용 후 33과 신규 견적 갱신; 기존 예약 요금 유지.

51. 게스트 매너 및 이전 평가
+  문서: pages/51_guest-profile-reviews.txt
+  원본: ../51-guest-profile-reviews.svg
+  프론트엔드: 현재 예약 게스트의 공개 닉네임·인증 요약·매너온도·완료 이용수·평점·후기를 페이지로 보여주고 요청 상세로 복귀한다.
+  API: GET /api/host/bookings/:id/guest-profile?cursor=&limit= → publicProfile,reviewSummary,reviews. 예약 소유 호스트 관계 확인 후 공개 평가만 제공.
+  DB/권한: bookings 관계, users의 공개 프로필, reviews, 검증 요약. 전화/이메일/원문 면허/다른 예약 상세 미노출.
+  완료 검증: 예약 관계 없는 호스트 거부; 후기 0개 평균 처리; 실제 평가수/완료 이용수 일치; 35 복귀 ID 유지.

4. 소스코드 설명 기준
구현 후 각 화면의 실제 파일과 핵심 함수를 이 문서에 기록한다. 예정 경로: apps/web/src/pages, apps/api/src/modules/host, packages/contracts, database/migrations.
현재 이 경로들은 앱 코드가 없는 설계 제안이다. 실제 존재하는 문서 소스는 ../scripts/generate-docs.mjs이며 pages 명세와 groups 구분으로 이 TXT 및 화면별 TXT를 생성한다. ../scripts/check-docs.mjs는 누락·연결·필수 섹션을 검사한다.
문서 생성기를 다시 실행하면 화면별 TXT 및 이 README TXT를 재생성하므로 실제 구현 이력은 07_구현기록.txt에 먼저 남긴다. 구현 시 생성기 명세에도 이력 반영 방식을 추가하거나 이 문서의 관리를 수동으로 전환하고 재생성 정책을 갱신한다.

5. SOLID / KISS / YAGNI
SOLID: 컨트롤러/업무 서비스/저장소/화면 책임을 구별하고 외부 provider만 필요한 경계에서 주입한다.
KISS: 공통 상태 전이/요금 계산/DTO를 재사용하고 같은 규칙을 여러 화면에 복제하지 않는다.
YAGNI: 위 화면에 필요한 기능만 구현한다. 미요구 운영자 UI·쿠폰·포인트 등을 선제 추가하지 않는다.
적용 기준 전문: 04_SOLID_KISS_YAGNI.txt. 실제 적용 여부는 코드와 검증으로 기록한다.

6. 실제 구현 기록
앱 소스: 미구현
MariaDB migration: 미구현
API/화면 기능 테스트: 미실행
외부 공급자: 미연동
문서 생성/검사: 저장소 README 및 07_구현기록.txt 참조
향후 기록: 화면번호 / 구현 순서 / 실제 소스파일 / 핵심 함수와 호출 흐름 / API·DB / 원칙별 적용 / 검증명령·결과 / 미연동.

7. 사용 도구
문서 작업에 실제 사용한 도구와 앱 도입 후보는 06_사용도구.txt를 참조한다. 기능 구현 시 정확한 버전과 사용 위치를 그 문서에 추가한다.
