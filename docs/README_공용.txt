근차 공용 README
상태: 구현 요구사항·프롬프트 작성 / 앱 소스 미구현

1. 역할 및 범위
채팅·점검·정산·후기·프로필·지원
화면: 19, 20, 21, 22, 23, 24, 37, 38, 39, 40, 41, 42, 43, 44, 46
20~24는 게스트 이용 흐름과 중복되며 수행자는 단계마다 구별한다. 기본 제출자는 게스트, 열람/확인은 예약 참여자 양쪽이다.

2. 읽는 순서
00_전체_구현_프롬프트.txt → 01_PRD.txt → 02_구현순서.txt → 03_MariaDB_설계.txt → 아래 화면별 문서.
화면 구현은 전체 00~51 번호순, 공통 서비스/DB는 선행 작성 가능. 아래 목록은 이 구분 내의 순서다.

3. 화면별 PRD 및 구현 순서
19. 예약 채팅방
+  문서: pages/19_chat.txt
+  원본: ../19-chat.svg
+  프론트엔드: 참여자·차량·예약 요약, 메시지·전송 중/실패·재전송·읽음 상태를 제공한다. 연결 끊김 후 마지막 커서부터 복구한다.
+  API: GET /api/bookings/:id/messages?cursor=&limit=; POST /api/bookings/:id/messages {clientMessageId,content}; POST /api/bookings/:id/read {lastMessageId}; 인증된 실시간 구독.
+  DB/권한: chat_messages, chat_reads. UNIQUE(sender_id,client_message_id)로 재전송 중복 방지. DB 저장 후 해당 예약 참여자에게 전달.
+  완료 검증: 비참여자 조회/전송/구독 거부; XSS는 텍스트로 표시; 재연결 누락·중복 없음; 본인 메시지는 unread 제외.

20. 인수 전 차량 상태
+  문서: pages/20_pickup-inspection.txt
+  원본: ../20-pickup-inspection.svg
+  프론트엔드: 앞/뒤/좌/우/네 모서리 8방향과 계기판 사진, 주행거리 입력·임시저장·제출을 제공한다. 카메라 권한 실패 시 파일 선택을 지원한다.
+  API: POST /api/uploads(인증 이미지); PUT /api/bookings/:id/inspections/pickup {photos:[{angle,uploadId}],odometerKm,draft}; POST /api/bookings/:id/inspections/pickup/submit.
+  DB/권한: uploads, inspections, inspection_photos. 게스트 제출 및 참여자 열람, CONFIRMED 검사. 제출 확정 시 IN_USE 전이.
+  완료 검증: 필수 각도/계기판 누락 차단; 타인 업로드 연결 거부; 중복 제출 한 번; 시작 전/취소 예약 거부; 개발 파일 공개 노출 없음.

21. 반납 후 차량 상태
+  문서: pages/21_return-inspection.txt
+  원본: ../21-return-inspection.svg
+  프론트엔드: 인수와 같은 각도의 8장 및 계기판 증빙을 올리고 반납 주행거리 입력·제출한다. 업로드 재시도와 진행률을 제공한다.
+  API: PUT /api/bookings/:id/inspections/return {photos,odometerKm,draft}; POST /api/bookings/:id/inspections/return/submit → RETURNED/comparisonStatus.
+  DB/권한: inspections baseline_id로 인수 연결, 사진 및 주행거리. IN_USE에서만 반납, 감소 주행거리/중복 단계 방지.
+  완료 검증: 인수 없는 반납 거부; 계기판 감소 거부; 재제출 정책; 재시작 후 분석 대기 유지; 업로드 소유권 검사.

22. 외관 및 계기판 비교
+  문서: pages/22_condition-comparison.txt
+  원본: ../22-condition-comparison.svg
+  프론트엔드: 인수/반납 사진 쌍·손상 후보·분석 신뢰도·모델/개발 모드·검토 상태·주행거리 차이를 표시한다. 호스트와 확인하기는 해당 채팅으로 이동한다.
+  API: GET /api/bookings/:id/comparison → baseline,returned,damageCandidates,odometerDiff,mode,status; POST /api/bookings/:id/comparison/acknowledgements {decision,note}.
+  DB/권한: inspections/comparison 결과 및 참여자 확인 기록. 손상 후보를 확정 손해액으로 자동 변환하지 않는다. 공급자 미연동은 분석 불가/개발 예시 구별.
+  완료 검증: 동일 예약 증빙끼리 비교; 이미지/AI 실패 안내; 위조된 손상 금액 입력 차단; 양 당사자 열람 가능.

23. 최종 정산 및 추가 결제
+  문서: pages/23_final-settlement.txt
+  원본: ../23-final-settlement.svg
+  프론트엔드: 선결제·실제 주행·포함거리·초과료·증빙 통행료·보험·최종 총액·미납/환불을 표시한다. 합의/검토 중인 손상은 확정액과 구별한다.
+  API: GET /api/bookings/:id/settlement; POST /api/bookings/:id/settlement/pay {paymentMethodId} + Idempotency-Key. 서버만 승인된 항목을 합산.
+  DB/권한: settlements/payments/inspections/payout_records. 추가 청구와 환불 거래를 별도 기록; COMPLETED 전 잔액과 검토 상태 확인.
+  완료 검증: 142km-130km=12km×300=3,600; 톨비3,200이면 추가6,800. 22/23 같은 주행거리 유지. 중복 청구 방지 및 결제 실패 재시도.

24. 이용 후기 작성
+  문서: pages/24_review.txt
+  원본: ../24-review.svg
+  프론트엔드: 예약 상대방과 차량 경험에 대한 1~5 평점·매너 평가·태그·본문을 입력한다. 호스트/게스트 역할에 맞는 대상을 표시한다.
+  API: POST /api/bookings/:id/reviews {rating,mannerRating,tags,content} → review; 서버가 상대방 targetId 결정. 같은 작성자의 재등록은 409.
+  DB/권한: reviews UNIQUE(booking_id,author_id), 태그 목록. COMPLETED만 허용. 매너온도는 별도로 명시한 결정적 정책이 없으면 초기 36.5 유지/평가 집계만 표시.
+  완료 검증: 미완료 예약/자기평가/타인 예약/범위 밖 평점 거부; 동시 중복 등록 방지; 상대방 프로필과 집계 일치.

37. 게스트 마이페이지
+  문서: pages/37_my-page.txt
+  원본: ../37-my-page.svg
+  프론트엔드: 프로필·동네/매너·게스트 모드·호스트 전환과 내 정보/설정/도움 메뉴를 제공한다. 보유 역할에 따라 전환 또는 추가 동작을 구별한다.
+  API: GET /api/me/profile → publicFields,verificationSummaries,roles,activeRole; PATCH /api/me/active-role. 인증 정보는 마스킹된 요약만 반환.
+  DB/권한: users/user_roles/user_verifications/reviews. mode는 실제 권한 검사를 대체하지 않는다.
+  완료 검증: 로그아웃 후 접근 제어; 프로필 변경 반영; 역할 추가/전환; 전체 메뉴 연결.

38. 개인정보 수정
+  문서: pages/38_personal-information.txt
+  원본: ../38-personal-information.svg
+  프론트엔드: 프로필 사진·닉네임·연락처·이메일·동네를 수정한다. 연락처 변경은 재인증, 동네 변경은 검색지역과 인증동네를 구별한다.
+  API: PATCH /api/me/profile {nickname,email,avatarUploadId}; POST /api/me/phone-change {verifiedChallengeId}; 동네 인증은 /verifications/neighborhood 재사용.
+  DB/권한: users, uploads, user_verifications. 닉네임 길이·이메일 형식·연락처 unique. 사용자 ID는 세션에서만 결정.
+  완료 검증: 타인 사진/ID 주입 차단; 중복 연락처; 재인증 없는 번호 변경 거부; 저장 실패 입력 유지.

39. 면허 관리
+  문서: pages/39_license-management.txt
+  원본: ../39-license-management.svg
+  프론트엔드: 면허 종류·마스킹 번호·발급/만료일·검증 상태를 보여주고 재검증/수정을 07과 같은 입력으로 연결한다.
+  API: GET /api/me/license → maskedNumber,type,issuedOn,expiresOn,status; POST /api/verifications/license(07 계약). 만료된 성공을 유효로 반환하지 않는다.
+  DB/권한: user_verifications 및 면허 메타데이터. 원문 번호를 수정용 자동 채우기로 되돌리지 않는다.
+  완료 검증: 미등록/검증 중/실패/만료; 번호 마스킹; 만료 면허 예약 차단; 변경 후 새 검증 결과 유지.

40. 결제수단 관리
+  문서: pages/40_payment-methods.txt
+  원본: ../40-payment-methods.svg
+  프론트엔드: 브랜드·끝4자리·기본 여부·연결 상태를 보여주고 기본 변경·삭제·추가를 제공한다.
+  API: GET /api/me/payment-methods; PATCH /api/me/payment-methods/:id {isDefault:true}; DELETE /api/me/payment-methods/:id. 공급자 토큰 폐기와 로컬 상태를 구별.
+  DB/권한: payment_methods. 사용자 행 잠금으로 기본 수단 최대 한 개; 결제 이력 FK는 보존하며 삭제 상태 처리.
+  완료 검증: 타인 카드 변경/삭제 거부; 기본 변경 동시 요청; 유일 기본 수단 삭제 후 정책; vault_ref/전체 번호 미노출.

41. 알림 설정
+  문서: pages/41_notification-settings.txt
+  원본: ../41-notification-settings.svg
+  프론트엔드: 전체 알림·예약/채팅/정산/혜택과 채널별 선택을 표시하고 저장 실패 시 복구한다. 혜택 동의와 필수 서비스 알림을 구별한다.
+  API: GET /api/me/notification-settings; PUT /api/me/notification-settings {items:[{category,channel,enabled}]}. 허용 카테고리/채널만 저장.
+  DB/권한: notification_settings UNIQUE(user_id,category,channel), 마케팅 consent_records. 서비스 알림 전체 활성화가 마케팅 동의를 자동 생성하면 안 된다.
+  완료 검증: 새로고침 유지; 전체/개별 동기화; 타인 설정 접근 차단; 혜택 거부 상태 보존; 실제 푸시 발송과 저장 완료 구별.

42. 고객센터
+  문서: pages/42_customer-center.txt
+  원본: ../42-customer-center.svg
+  프론트엔드: FAQ 검색·접기/펼치기·운영 시간과 문의 진입을 제공한다. 답변에는 현재 취소/인증/정산 정책을 사용한다.
+  API: GET /api/support/faqs?q=&category= → items. 초기에는 서버 정적 데이터 가능; 원본 질문을 실제 정책으로 답변.
+  DB/권한: 정적 FAQ 설정 또는 faq 테이블(운영 편집 요구 시에만). 별도 관리자 CMS를 선제 구축하지 않는다.
+  완료 검증: 검색/결과 없음/답변 펼치기/문의 이동; 미확정 환불/보험 정책을 확정 보장으로 적지 않음.

43. 1:1 문의 접수
+  문서: pages/43_inquiry-form.txt
+  원본: ../43-inquiry-form.svg
+  프론트엔드: 예약/결제/차량/기타 유형·제목·본문·사진을 입력하고 접수번호를 표시한다. 연락 이메일 미등록 시 안내한다.
+  API: POST /api/support/inquiries {category,title,content,uploadIds}; GET /api/me/inquiries?page=&limit=; GET /api/me/inquiries/:id. 비동기 이메일 발송 상태는 별도.
+  DB/권한: inquiries/inquiry_attachments/uploads. 문자열 길이·첨부 제한·작성자 검증과 rate limit. 실제 메일 연동 전 발송 완료 금지.
+  완료 검증: 필수 누락/크기 초과/타인 파일 차단; 재시도 중복 접수 방지; 내 문의 재조회; 비밀정보 입력 안내.

44. 채팅 목록
+  문서: pages/44_chat-list.txt
+  원본: ../44-chat-list.svg
+  프론트엔드: 상대 이름/차량 검색, 전체/안읽음 필터, 마지막 메시지·시각·읽지 않은 수를 제공한다.
+  API: GET /api/me/conversations?q=&unreadOnly=&cursor=&limit= → 예약별 대화 요약. 실시간 새 메시지/읽음 이벤트로 목록 갱신.
+  DB/권한: 참여 bookings/chat_messages/chat_reads. 자기 메시지와 읽음 커서를 반영한 unread 집계, 마지막 메시지 순서 안정화.
+  완료 검증: 다른 예약 대화 미노출; 읽음 처리 후 수 감소; 본인 전송 unread 증가 안 됨; 검색/빈 목록/페이지 중복 방지.

46. 결제수단 추가
+  문서: pages/46_payment-method-add.txt
+  원본: ../46-payment-method-add.svg
+  프론트엔드: PG 호스팅 필드/리디렉션으로 카드 등록한다. 전체 카드번호·CVC가 앱 API/로그/저장소에 들어가지 않게 하며 기본 수단 선택을 제공한다.
+  API: POST /api/me/payment-method-setup → providerSession/mode; POST /api/me/payment-methods {setupReference,isDefault}. 서버가 공급자에서 등록 결과/소유 관계 확인 후 참조만 보관.
+  DB/권한: payment_methods(provider,vault_ref,brand,last_four), setup 참조 일회 사용. 개발 모드는 테스트 토큰만 허용하며 실제 카드 입력을 받지 않는다.
+  완료 검증: 위조 setup/재사용/타인 참조 거부; PG 취소/실패 처리; 응답/로그 카드 원문 없음; 등록 후 16/40에 반영.

4. 소스코드 설명 기준
구현 후 각 화면의 실제 파일과 핵심 함수를 이 문서에 기록한다. 예정 경로: apps/web/src/pages, apps/api/src/modules/shared, packages/contracts, database/migrations.
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
