import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const implementation = JSON.parse(
  await readFile(path.join(root, "docs", "implementation-status.json"), "utf8"),
);
const implemented = new Map(
  implementation.stages.flatMap((stage) =>
    stage.screens.map((number) => [number, stage]),
  ),
);
const groups = {
  auth: {
    name: "회원가입_로그인",
    label: "회원가입 및 로그인",
    responsibility: "계정 생성·인증·약관과 역할 관리",
    module: "auth",
  },
  guest: {
    name: "게스트",
    label: "게스트",
    responsibility: "차량 탐색·예약·이용 준비",
    module: "bookings",
  },
  shared: {
    name: "공용",
    label: "공용",
    responsibility: "채팅·점검·정산·후기·프로필·지원",
    module: "shared",
  },
  host: {
    name: "호스트",
    label: "호스트",
    responsibility: "차량 등록·운영·요청 관리·수익",
    module: "host",
  },
};

// 번호, 제목, 구분, 프론트엔드, API 계약, 데이터, 완료 검증, 관련 화면.
// 아래 내용은 구현 명세이며 실행 가능한 앱 비즈니스 로직이 아니다.
const rows = [
  [
    0,
    "약관 및 권한 동의",
    "auth",
    "필수 개인정보·제3자 제공·위치 약관과 선택 마케팅 채널을 개별 선택한다. 전체 동의와 개별 선택을 동기화한다. 기기 위치 권한은 위치 기능 사용 시 별도 요청한다.",
    "GET /api/terms → 버전/필수 여부/문구; POST /api/consents {versions,choices,signupChallenge?} → receiptId. 가입 전 동의는 서버가 발급한 참조로 묶고 가입 시 계정에 귀속한다.",
    "consent_records, 약관 버전 설정. 필수 동의 누락은 서버도 거부하며 선택 채널은 기본 미동의.",
    "필수 누락 시 진행 차단; 선택 미동의여도 진행; 새 약관 버전 요구와 중복 제출 처리; 동의만으로 GPS 권한 승인으로 표시하지 않음.",
    "01,04,06,41",
  ],
  [
    1,
    "홈 둘러보기",
    "auth",
    "비회원 주변 차량 카드·지도 진입·빠른 필터를 제공한다. 로그인/회원가입 이동과 예약 시 인증 진입 경로를 표시한다.",
    "GET /api/vehicles?area=&fuel=&page=&limit= → items/total/page; 공개 DTO에는 연락처·비공개 인수 안내를 포함하지 않는다.",
    "vehicles, vehicle_photos, reviews의 공개 집계. 공개/인증 완료 차량만 검색.",
    "로그인 없이 목록·상세 조회; 예약 시 로그인 필요; 비공개 차량과 개인정보 미노출; 빈 목록/실패/재시도.",
    "00,02,03,08,12",
  ],
  [
    2,
    "이용 유형 선택",
    "auth",
    "게스트/호스트를 선택하고 선택 상태와 다음 진입 위치를 표시한다. 미가입 선택은 가입 과정에 전달하고 기존 계정은 역할 추가·전환을 구별한다.",
    "POST /api/me/roles {role} → roles; PATCH /api/me/active-role {role} → activeRole. 인증 전 선택값은 가입 요청에 검증하여 포함한다.",
    "user_roles, users.active_role. 역할 문자열 allowlist; 클라이언트의 임의 관리자 역할 금지.",
    "선택 없이 진행 차단; 호스트·게스트 역할 보유 상태 유지; 미보유 역할로 직접 전환 거부.",
    "03,04,08,25,37,47",
  ],
  [
    3,
    "로그인",
    "auth",
    "아이디·비밀번호, 표시 전환, 실패/잠김/로딩을 제공한다. 카카오와 아이디·비밀번호 복구 동작도 제공하되 공급자 미설정을 구별한다.",
    "POST /api/auth/login {loginId,password}; POST /api/auth/logout; GET /api/auth/me; GET /api/auth/kakao/start 및 callback(state 검증); POST /api/auth/recovery/start와 /complete(일회성 토큰).",
    "users, sessions, auth_challenges. 세션 재발급·만료, 해시 검증, 시도 제한; 복구 응답으로 계정 존재 여부 노출 방지.",
    "정상/오류 비밀번호, 세션 만료/로그아웃, 인증 시도 제한, OAuth state 변조와 복구 토큰 재사용 거부. 미연동은 성공 처리 금지.",
    "01,02,04,08,25",
  ],
  [
    4,
    "회원가입",
    "auth",
    "영문·숫자 6~20자 아이디 중복 확인, 최소 8자 비밀번호·확인, 휴대폰 OTP, 약관 동의를 제공한다. 아이디 변경 시 중복 확인을 무효화한다.",
    "GET /api/auth/login-id-availability?loginId=; POST /api/auth/phone-challenges {phone}; POST /api/auth/phone-challenges/:id/verify {code}; POST /api/auth/signup {loginId,password,phoneChallengeId,consentReceiptId,role}.",
    "users.login_id UNIQUE, auth_challenges, consent_records, user_roles. OTP 만료/시도 제한/일회 사용. 가입과 참조 귀속은 트랜잭션.",
    "동시 동일 아이디 가입은 하나만 성공; 확인값 불일치/만료 OTP/필수약관 누락 거부; 비밀번호·OTP 원문 로그 없음.",
    "00,02,03,05",
  ],
  [
    5,
    "본인 확인",
    "auth",
    "PASS/문자 선택, 인증 진행·취소·실패·만료·완료를 표시한다. 시안 예시 성공을 실제 인증으로 재사용하지 않는다.",
    "POST /api/verifications/identity {method} → verificationId/redirect; POST /api/providers/identity/callback(공급자 검증); GET /api/verifications/:id → status/mode. callback은 서명과 중복 검증.",
    "user_verifications. 공급자 참조·성공 시각·만료 저장. 민감 원문 최소화, 본인 확인과 단순 휴대폰 소유 확인을 구별.",
    "다른 계정 인증 참조 접근 거부; 위조 callback 거부; 개발 결과는 개발 표시; 운영 미설정은 성공 불가.",
    "04,06,07",
  ],
  [
    6,
    "동네 인증",
    "auth",
    "명시적 버튼 동작에서 geolocation을 요청한다. 권한 거부·시간초과·부정확 위치를 처리한다. 인증 불가 시 지역 수동 검색은 허용하되 인증 완료로 표시하지 않는다.",
    "POST /api/verifications/neighborhood {latitude,longitude,accuracy,capturedAt} → neighborhood/status/expiresAt. 서버가 경계 데이터/공급자로 지역 판정; 좌표 범위와 최신성 검사.",
    "user_verifications, 지역 코드 설정. GPS 입력만으로 위변조 방지를 보증하지 않는다. 고정밀 좌표는 필요한 기간만 저장.",
    "권한 허용/거부/범위 밖/오래된 좌표; 수동 지역 선택과 인증 구별; 만료 인증 처리. 지역 판정 공급자 미연동 명시.",
    "00,05,07,08,38",
  ],
  [
    7,
    "면허 정보 입력",
    "auth",
    "면허 종류/번호/발급일/유효기간을 입력한다. 입력 중 마스킹과 일관된 날짜 검증, 검증 진행 상태를 표시한다.",
    "POST /api/verifications/license {type,number,issuedOn,expiresOn} → verificationId/status/mode. 전체 번호를 응답에 되돌리지 않고 공급자 검증 후 마스킹/참조만 저장.",
    "user_verifications와 면허 메타데이터. 유효기간 및 본인 확인 관계 검증. provider 미설정이면 인증 성공 불가.",
    "종료일<발급일, 만료 면허, 형식 오류 거부; API/로그/화면에 원문 재노출 없음; 새로고침 후 저장 결과 조회.",
    "05,06,08,39",
  ],
  [
    8,
    "게스트 홈",
    "guest",
    "로그인 사용자 인사·활동 동네·주변 차량·빠른 필터·하단 검색/예약/채팅/마이를 제공한다. 비회원 접근 시 공개 탐색 모드로 동작한다.",
    "GET /api/auth/me(선택); GET /api/vehicles?area=&fuel=&bodyType=&page=&limit=. 사용자가 지역을 바꾸면 이전 응답이 새 검색을 덮지 않게 한다.",
    "공개 vehicles/사진/후기 집계, 사용자 프로필·동네. 거리·평점은 실제 데이터로 표시.",
    "로그인/비회원/동네 미인증, 필터 변경, 결과 없음, API 실패; 하단 메뉴 실제 경로 연결.",
    "09,10,11,12,37,44,45",
  ],
  [
    9,
    "지도에서 차량 찾기",
    "guest",
    "지도 이동·확대에 맞춰 차량 가격 마커와 목록을 동기화하고 선택 카드를 표시한다. 현재 위치 권한과 지도 공급자 오류를 처리한다.",
    "GET /api/vehicles?bbox=west,south,east,north&startsAt=&endsAt=&limit= → 위치/가격/요약. bbox 범위·최대 결과 수 제한.",
    "vehicles pickup_lat/lng와 가용 기간/예약. 공개 지도에는 대략적 위치, 상세 인수 좌표는 권한에 따라 제공.",
    "마커→차량 상세 연결; 지도 이동 재검색; 위치 거부 시 지역 중심 사용; 공급자 미연동은 목록 대체와 명시적 안내.",
    "06,08,10,12",
  ],
  [
    10,
    "차량 검색 결과",
    "guest",
    "지역/기간/필터 요약·결과 수·카드·정렬·페이지네이션을 제공한다. 검색 상태를 URL에 보존한다.",
    "GET /api/vehicles?area=&startsAt=&endsAt=&fuel=&bodyType=&minPrice=&maxPrice=&seats=&sort=&page=&limit=. 허용 sort만 처리.",
    "vehicles, vehicle_availability, 점유 중 bookings, reviews. 날짜 조건은 예약 충돌을 제외하되 최종 생성 시 다시 검사.",
    "URL 새로고침 유지; 가격순/날짜 가용성 필터 정확성; 잘못된 페이지·정렬 거부; 공개 차량만 노출.",
    "08,09,11,12",
  ],
  [
    11,
    "검색 필터",
    "guest",
    "크기·차체·연료·좌석·최소/최대 일일 예산을 입력하고 초기화·적용한다. 미적용 임시값과 현재 검색값을 구별한다.",
    "GET /api/vehicles/count?필터 → count. 검색 API와 같은 schema와 조건식을 사용한다. 가격은 원 단위 정수, 최소≤최대.",
    "검색 필터는 URL/클라이언트 상태; 새 필터 전용 DB 테이블을 만들지 않는다.",
    "초기화/취소/적용/뒤로가기; 잘못된 범위 거부; 표시 결과 수와 실제 조회 조건 일치.",
    "08,10",
  ],
  [
    12,
    "차량 상세",
    "guest",
    "차량 사진·외관 등급·기본 사양·후기 집계·호스트 공개 프로필과 일일 요금을 표시한다. 날짜 선택 진입을 제공한다.",
    "GET /api/vehicles/:id → 공개 상세; GET /api/vehicles/:id/reviews?page=&limit=. 비공개/삭제 차량은 권한에 맞게 404.",
    "vehicles/사진/태그, 공개 users, reviews, 검증 요약. 실제 응답률/평균 응답시간을 계산하지 못하면 가짜 수치를 표시하지 않는다.",
    "비공개 차량 직접 URL 차단; 사진 없음 대체; 리뷰 집계 일치; 본인 차량 예약 서버 거부.",
    "10,13,14",
  ],
  [
    13,
    "차량 세부 정보",
    "guest",
    "크기·좌석·연식·연료·연비/단위·편의 옵션·대략적 인수 장소를 보여준다. 보험 보장은 별도 상품 정보와 구별한다.",
    "GET /api/vehicles/:id/specs → size,seats,year,fuel,efficiency,efficiencyUnit,options,pickupArea. 상세에서 파생된 동일한 DTO 규칙 사용.",
    "vehicles와 vehicle_tag_links. 전기차 km/kWh, 내연기관 km/L. 완전자차 옵션 태그를 보험 가입 증거로 쓰지 않는다.",
    "누락 사양은 미등록 표시; 단위 일치; 정확한 비공개 픽업 안내 미노출; 예약 버튼의 차량 ID 유지.",
    "12,14,48",
  ],
  [
    14,
    "대여 일정",
    "guest",
    "실제 현재 월 기준 달력·대여/반납 시간·불가 일정을 표시한다. 과거 날짜·종료≤시작은 선택/제출을 막는다.",
    "GET /api/vehicles/:id/availability?from=&to= → available/blocked; POST /api/bookings/quote {vehicleId,startsAt,endsAt,insuranceProductId?} → quoteId/breakdown/expiresAt.",
    "vehicle_availability, 점유 bookings, 차량 가격. 서버 UTC 검사, 프론트 Asia/Seoul 표시. quote는 재고 점유가 아님.",
    "월 경계/같은 날 시간/24시간 초과 과금; 가용 기간 밖/겹침/과거 거부; 날짜 변경 시 이전 견적 폐기.",
    "12,15",
  ],
  [
    15,
    "예약 확인",
    "guest",
    "기간·차량·인수 지역·차량료·게스트 수수료·보험료·총액을 서버 견적으로 표시한다. 일정/보험 수정 후 재견적한다.",
    "POST /api/bookings/quote {vehicleId,startsAt,endsAt,insuranceProductId} → quoteId,pricedAt,expiresAt,lineItems,total,hostNet. 클라이언트 금액 입력 없음.",
    "차량/보험 버전 기반 요금 스냅샷. 견적 만료 시 재계산과 변경 동의 후 진행.",
    "68,000+18,000+6,800=92,800 검증; 보험 변경 즉시 총액 반영; 금액 변조 무시; 인증 미완료 시 안내.",
    "14,16,48",
  ],
  [
    16,
    "결제 수단 및 예약 요청",
    "guest",
    "보유 결제수단·등록 진입·금액을 보여준다. 호스트 승인형 정책에 따라 최초 제출은 예약 요청 접수로 표시하며 승인 후 결제를 진행한다.",
    "GET /api/me/payment-methods; POST /api/bookings {quoteId,paymentMethodId,consent} + Idempotency-Key → REQUESTED; POST /api/bookings/:id/pay → payment/status(승인 후만).",
    "bookings/payments/payment_methods. 차량 잠금·요금 재검증·소유권·인증 확인. 결제 의도 저장 후 외부 호출, 서버 검증 후 확정.",
    "더블클릭/재시도 시 예약·청구 한 번; 타인 카드 거부; 승인 전 청구 거부; 결제 실패/시간초과/미연동 안내.",
    "15,17,40,46,48",
  ],
  [
    17,
    "예약 요청 및 완료",
    "guest",
    "서버에서 재조회한 상태에 따라 요청 접수/승인 후 결제 대기/예약 확정을 구별한다. 실제 예약 번호·기간·차량과 상세/채팅 진입을 표시한다.",
    "GET /api/bookings/:id → status,paymentStatus,reference,vehicle,period,allowedActions. 결제 리디렉션의 success 파라미터를 성공 증거로 사용하지 않는다.",
    "bookings와 서버 검증된 payments. 클라이언트 임시 상태를 정본으로 쓰지 않는다.",
    "새로고침/직접 URL에서 복구; 다른 계정 차단; 실패 결제가 완료로 보이지 않음; 상태에 맞는 CTA.",
    "16,18,19,45",
  ],
  [
    18,
    "예약 상세",
    "guest",
    "예약 상태·기간·호스트·권한에 맞는 정확한 픽업 안내·결제/취소/인수 버튼을 제공한다. 허용 동작은 서버 응답을 따른다.",
    "GET /api/bookings/:id; POST /api/bookings/:id/cancel {reason}; 승인 후 /pay. 취소는 환불 상태를 함께 반환하며 외부 실패를 숨기지 않는다.",
    "bookings/payments/vehicles, 허용 상태 전이. 참여자만 조회. 게스트 본인만 요청 취소, 이용 중 자동 취소 불가.",
    "타인 ID 접근 거부; 취소/환불 중복 처리; 승인/만료 경쟁; CONFIRMED만 인수 가능.",
    "17,19,20,23,45",
  ],
  [
    19,
    "예약 채팅방",
    "shared",
    "참여자·차량·예약 요약, 메시지·전송 중/실패·재전송·읽음 상태를 제공한다. 연결 끊김 후 마지막 커서부터 복구한다.",
    "GET /api/bookings/:id/messages?cursor=&limit=; POST /api/bookings/:id/messages {clientMessageId,content}; POST /api/bookings/:id/read {lastMessageId}; 인증된 실시간 구독.",
    "chat_messages, chat_reads. UNIQUE(sender_id,client_message_id)로 재전송 중복 방지. DB 저장 후 해당 예약 참여자에게 전달.",
    "비참여자 조회/전송/구독 거부; XSS는 텍스트로 표시; 재연결 누락·중복 없음; 본인 메시지는 unread 제외.",
    "18,35,44",
  ],
  [
    20,
    "인수 전 차량 상태",
    "shared",
    "앞/뒤/좌/우/네 모서리 8방향과 계기판 사진, 주행거리 입력·임시저장·제출을 제공한다. 카메라 권한 실패 시 파일 선택을 지원한다.",
    "POST /api/uploads(인증 이미지); PUT /api/bookings/:id/inspections/pickup {photos:[{angle,uploadId}],odometerKm,draft}; POST /api/bookings/:id/inspections/pickup/submit.",
    "uploads, inspections, inspection_photos. 게스트 제출 및 참여자 열람, CONFIRMED 검사. 제출 확정 시 IN_USE 전이.",
    "필수 각도/계기판 누락 차단; 타인 업로드 연결 거부; 중복 제출 한 번; 시작 전/취소 예약 거부; 개발 파일 공개 노출 없음.",
    "18,21,22,48",
  ],
  [
    21,
    "반납 후 차량 상태",
    "shared",
    "인수와 같은 각도의 8장 및 계기판 증빙을 올리고 반납 주행거리 입력·제출한다. 업로드 재시도와 진행률을 제공한다.",
    "PUT /api/bookings/:id/inspections/return {photos,odometerKm,draft}; POST /api/bookings/:id/inspections/return/submit → RETURNED/comparisonStatus.",
    "inspections baseline_id로 인수 연결, 사진 및 주행거리. IN_USE에서만 반납, 감소 주행거리/중복 단계 방지.",
    "인수 없는 반납 거부; 계기판 감소 거부; 재제출 정책; 재시작 후 분석 대기 유지; 업로드 소유권 검사.",
    "20,22,23",
  ],
  [
    22,
    "외관 및 계기판 비교",
    "shared",
    "인수/반납 사진 쌍·손상 후보·분석 신뢰도·모델/개발 모드·검토 상태·주행거리 차이를 표시한다. 호스트와 확인하기는 해당 채팅으로 이동한다.",
    "GET /api/bookings/:id/comparison → baseline,returned,damageCandidates,odometerDiff,mode,status; POST /api/bookings/:id/comparison/acknowledgements {decision,note}.",
    "inspections/comparison 결과 및 참여자 확인 기록. 손상 후보를 확정 손해액으로 자동 변환하지 않는다. 공급자 미연동은 분석 불가/개발 예시 구별.",
    "동일 예약 증빙끼리 비교; 이미지/AI 실패 안내; 위조된 손상 금액 입력 차단; 양 당사자 열람 가능.",
    "19,20,21,23",
  ],
  [
    23,
    "최종 정산 및 추가 결제",
    "shared",
    "선결제·실제 주행·포함거리·초과료·증빙 통행료·보험·최종 총액·미납/환불을 표시한다. 합의/검토 중인 손상은 확정액과 구별한다.",
    "GET /api/bookings/:id/settlement; POST /api/bookings/:id/settlement/pay {paymentMethodId} + Idempotency-Key. 서버만 승인된 항목을 합산.",
    "settlements/payments/inspections/payout_records. 추가 청구와 환불 거래를 별도 기록; COMPLETED 전 잔액과 검토 상태 확인.",
    "142km-130km=12km×300=3,600; 톨비3,200이면 추가6,800. 22/23 같은 주행거리 유지. 중복 청구 방지 및 결제 실패 재시도.",
    "21,22,24,36",
  ],
  [
    24,
    "이용 후기 작성",
    "shared",
    "예약 상대방과 차량 경험에 대한 1~5 평점·매너 평가·태그·본문을 입력한다. 호스트/게스트 역할에 맞는 대상을 표시한다.",
    "POST /api/bookings/:id/reviews {rating,mannerRating,tags,content} → review; 서버가 상대방 targetId 결정. 같은 작성자의 재등록은 409.",
    "reviews UNIQUE(booking_id,author_id), 태그 목록. COMPLETED만 허용. 매너온도는 별도로 명시한 결정적 정책이 없으면 초기 36.5 유지/평가 집계만 표시.",
    "미완료 예약/자기평가/타인 예약/범위 밖 평점 거부; 동시 중복 등록 방지; 상대방 프로필과 집계 일치.",
    "23,35,51",
  ],
  [
    25,
    "호스트 홈",
    "host",
    "월 예상 수익·차량 상태·새 예약 요청과 호스트 하단 메뉴를 제공한다. 예상과 실제 지급액을 구별한다.",
    "GET /api/host/dashboard?month=YYYY-MM → estimatedNet,paidOut,vehicles,pendingRequests. host 역할 필요, 항상 세션 사용자 기준.",
    "소유 vehicles/bookings/settlements/payout_records 집계. 월 구간은 서울 시각을 UTC로 변환.",
    "다른 호스트 합계 제외; 차량 0/요청 0 상태; 역할 없는 사용자 차단; 36 수익과 같은 기준.",
    "26,34,35,36,47",
  ],
  [
    26,
    "호스트 차량 목록",
    "host",
    "작성 중/검토 중/공개/비공개 차량을 나눠 보여주고 등록 이어하기·정보 수정·차량 추가를 제공한다.",
    "GET /api/host/vehicles?page=&limit= → items; POST /api/host/vehicles → draftId/currentStep. 목록에 등록 진행 단계와 누락 요건 반환.",
    "vehicles/사진/분석 상태. 소유자 필터 필수, 다른 호스트 차량 제외.",
    "초기 빈 목록; 작성 중 이어가기; 공개 검색에는 draft 미노출; 페이지네이션/목록 갱신.",
    "25,27,28,31,33",
  ],
  [
    27,
    "차량 정보 수정 및 삭제",
    "host",
    "기본 정보·번호·사양·사진 수정 진입과 저장/비공개·삭제 동작을 제공한다. 기존 예약에 영향을 주는 변경은 안내한다.",
    "GET /api/host/vehicles/:id; PATCH /api/host/vehicles/:id {fields,version}; DELETE /api/host/vehicles/:id(보존형 삭제). 활성 예약이 있으면 삭제/충돌 변경 거부.",
    "vehicles version 또는 updated_at 기반 충돌 검증. 변경 후 재심사 필요 필드와 예약 가격 스냅샷 보존.",
    "타인 수정/삭제 거부; 오래된 버전 409; 예약 이력 보존; 이름/옵션 수정 후 게스트 상세 반영.",
    "26,28,29,30,31,33",
  ],
  [
    28,
    "차량 기본 정보 입력",
    "host",
    "차량명·연식·차량 번호·지역을 입력하고 draft를 저장한다. 뒤로가기/새로고침 후 복원한다.",
    "POST /api/host/vehicles {name,year,registrationPlate,area} 또는 PATCH /api/host/vehicles/:id/basic. 번호 형식·중복 정책, 연식 범위 서버 검사.",
    "vehicles draft. 원본에 없는 registration_plate 필드 추가. 차량 인증 성공 없이 공개 금지.",
    "필수 누락/잘못된 연식/번호 중복 검사; draft 저장/복구; 본인 소유 draft만 이어쓰기.",
    "26,29",
  ],
  [
    29,
    "차량 종류와 사양 입력",
    "host",
    "크기·차체·연료·좌석·변속기·연비를 선택하고 연료에 따라 단위를 설정한다.",
    "PATCH /api/host/vehicles/:id/specs {size,bodyType,fuel,seats,transmission,efficiency,efficiencyUnit}. enum/range와 연료-단위 조합 검증.",
    "vehicles의 사양 필드. 클라이언트 문자열 자유 입력 대신 허용된 코드 사용.",
    "음수 연비/0좌석/미지원 단위 거부; 연료 전환 시 단위 갱신; 게스트 13과 값 일치.",
    "28,30,13",
  ],
  [
    30,
    "차량 세부사항 입력",
    "host",
    "픽업 주소/안내·편의 옵션·차량 소개를 저장한다. 소개의 개행을 보존하고 저장 중 중복 제출을 막는다.",
    "PATCH /api/host/vehicles/:id/details {pickupAddress,pickupInstructions,options,description,version} → persistedSummary. 좌표는 확인된 지도 결과와 연결.",
    "vehicles, vehicle_tags, vehicle_tag_links. 옵션 연결 변경은 트랜잭션. 보험 옵션은 실제 가입 상태와 분리.",
    "실제 DB 저장 성공 때만 49 이동; 실패 시 입력 유지; XSS 문자열 실행 안 됨; 타인 draft 거부.",
    "29,49,13",
  ],
  [
    31,
    "차량 외관 사진 등록",
    "host",
    "방향별 파일 선택·미리보기·재시도·삭제·대표 이미지·순서 조정을 제공한다. 등록 권장과 공개 필수 조건을 구별한다.",
    "POST /api/uploads purpose=vehicle-photo; PUT /api/host/vehicles/:id/photos {items:[{uploadId,angle,order,isCover}]}; POST /api/host/vehicles/:id/analysis → job/status.",
    "uploads/vehicle_photos, 분석 작업 상태. 초기 공개 기준 8방향 사진 제안, 실제 형식/용량/MIME·매직바이트 검사. SVG 실행 파일 업로드 금지.",
    "다른 사용자 업로드 연결 거부; 허용 크기 초과/위장 파일 거부; 사진 실패 후 재개; 분석 시작 중복 방지.",
    "30,49,32",
  ],
  [
    32,
    "AI 외관 등급",
    "host",
    "A~D 등급·손상 후보·신뢰도·분석 모드·모델 버전·검토 대기/실패를 표시한다. 분석이 없으면 B를 고정 표시하지 않는다.",
    "GET /api/host/vehicles/:id/analysis → status,grade,candidates,modelVersion,mode; 재시도 POST /analysis. 결과 적용은 서버 provider 검증 후만.",
    "차량 분석 결과/사진 버전. 사진 변경 시 과거 등급을 최신으로 표시하지 않는다. 외관 등급과 소유·법적 차량 인증은 별개.",
    "pending/failed/개발 모드 처리; 사진 버전 변경 무효화; 클라이언트 등급 조작 거부; 운영 미연동 표시.",
    "31,33",
  ],
  [
    33,
    "대여 가능 일정과 요금",
    "host",
    "달력에서 기간·시간을 설정하고 일요금을 입력한다. AI 추천 보기와 수동 수정·저장/공개를 제공한다.",
    "PUT /api/host/vehicles/:id/availability {periods}; PATCH /api/host/vehicles/:id/pricing {dailyPrice,version}; POST /api/host/vehicles/:id/publish. 공개 요건과 차량 인증 검사.",
    "vehicle_availability/vehicles. 날짜 구간 정규화, 가격>0, 활성 예약과 충돌하는 운영 변경 거부. 예약 가격 스냅샷 불변.",
    "겹친 기간/역전/과거/예약 충돌 거부; 필수 사진·인증 없는 공개 차단; 새 요금은 신규 견적에만 적용.",
    "26,32,50",
  ],
  [
    34,
    "호스트 예약 목록",
    "host",
    "확인 필요/확정/이용 중/과거 탭과 일정 캘린더를 제공한다. 목록 상태와 요청 상세를 연결한다.",
    "GET /api/host/bookings?status=&from=&to=&page=&limit=. allowed status·기간 제한과 소유 호스트 필터.",
    "bookings/차량/게스트 공개 프로필. 취소/만료는 활성 재고와 구별.",
    "탭별 결과·총수 일치; 월 경계; 타인 차량 요청 없음; 승인 후 목록 상태 갱신.",
    "25,35,36",
  ],
  [
    35,
    "예약 요청 상세 및 관리",
    "host",
    "게스트 인증 요약·기간·예상 순수익·매너/평가·승인/거절·채팅 진입을 제공한다. 호스트의 일방적 일정 변경 대신 게스트 동의가 필요한 변경은 범위 밖 안내.",
    "GET /api/host/bookings/:id; POST /api/host/bookings/:id/approve; POST /api/host/bookings/:id/reject {reason}. 상태/기한/충돌 잠금 검사; 승인 후 게스트 결제 대기.",
    "bookings와 인증·수익 스냅샷. 호스트 자기 차량 예약만 관리. 개인정보 원문 대신 상태만 조회.",
    "타인 승인/중복 승인/만료 후 승인 거부; 승인-취소 동시 요청; 거절 시 점유 해제; 수익61,200 계산 일치.",
    "19,34,36,51",
  ],
  [
    36,
    "호스트 수익 대시보드",
    "host",
    "월별 예상/확정/지급 대기/지급 완료·수수료를 구별하고 일별 추이와 거래 상세를 제공한다. 비교 대상이 없으면 증감률 미표시.",
    "GET /api/host/earnings?month=YYYY-MM; GET /api/host/payouts?page=&limit=. 합계 기준(이용완료일/지급일)을 각 지표에 명시.",
    "bookings/settlements/payout_records/payments. 취소·환불 반영, 타인 수익 제외, 지급 참조 없는 완료 금지.",
    "월/연도 경계·환불·0건; 수수료와 순수익 합계; 25와 같은 예상 기준; 실제 이체 미연동 구별.",
    "25,34,47",
  ],
  [
    37,
    "게스트 마이페이지",
    "shared",
    "프로필·동네/매너·게스트 모드·호스트 전환과 내 정보/설정/도움 메뉴를 제공한다. 보유 역할에 따라 전환 또는 추가 동작을 구별한다.",
    "GET /api/me/profile → publicFields,verificationSummaries,roles,activeRole; PATCH /api/me/active-role. 인증 정보는 마스킹된 요약만 반환.",
    "users/user_roles/user_verifications/reviews. mode는 실제 권한 검사를 대체하지 않는다.",
    "로그아웃 후 접근 제어; 프로필 변경 반영; 역할 추가/전환; 전체 메뉴 연결.",
    "38,39,40,41,42,47",
  ],
  [
    38,
    "개인정보 수정",
    "shared",
    "프로필 사진·닉네임·연락처·이메일·동네를 수정한다. 연락처 변경은 재인증, 동네 변경은 검색지역과 인증동네를 구별한다.",
    "PATCH /api/me/profile {nickname,email,avatarUploadId}; POST /api/me/phone-change {verifiedChallengeId}; 동네 인증은 /verifications/neighborhood 재사용.",
    "users, uploads, user_verifications. 닉네임 길이·이메일 형식·연락처 unique. 사용자 ID는 세션에서만 결정.",
    "타인 사진/ID 주입 차단; 중복 연락처; 재인증 없는 번호 변경 거부; 저장 실패 입력 유지.",
    "06,37,47",
  ],
  [
    39,
    "면허 관리",
    "shared",
    "면허 종류·마스킹 번호·발급/만료일·검증 상태를 보여주고 재검증/수정을 07과 같은 입력으로 연결한다.",
    "GET /api/me/license → maskedNumber,type,issuedOn,expiresOn,status; POST /api/verifications/license(07 계약). 만료된 성공을 유효로 반환하지 않는다.",
    "user_verifications 및 면허 메타데이터. 원문 번호를 수정용 자동 채우기로 되돌리지 않는다.",
    "미등록/검증 중/실패/만료; 번호 마스킹; 만료 면허 예약 차단; 변경 후 새 검증 결과 유지.",
    "07,37,47",
  ],
  [
    40,
    "결제수단 관리",
    "shared",
    "브랜드·끝4자리·기본 여부·연결 상태를 보여주고 기본 변경·삭제·추가를 제공한다.",
    "GET /api/me/payment-methods; PATCH /api/me/payment-methods/:id {isDefault:true}; DELETE /api/me/payment-methods/:id. 공급자 토큰 폐기와 로컬 상태를 구별.",
    "payment_methods. 사용자 행 잠금으로 기본 수단 최대 한 개; 결제 이력 FK는 보존하며 삭제 상태 처리.",
    "타인 카드 변경/삭제 거부; 기본 변경 동시 요청; 유일 기본 수단 삭제 후 정책; vault_ref/전체 번호 미노출.",
    "16,37,46,47",
  ],
  [
    41,
    "알림 설정",
    "shared",
    "전체 알림·예약/채팅/정산/혜택과 채널별 선택을 표시하고 저장 실패 시 복구한다. 혜택 동의와 필수 서비스 알림을 구별한다.",
    "GET /api/me/notification-settings; PUT /api/me/notification-settings {items:[{category,channel,enabled}]}. 허용 카테고리/채널만 저장.",
    "notification_settings UNIQUE(user_id,category,channel), 마케팅 consent_records. 서비스 알림 전체 활성화가 마케팅 동의를 자동 생성하면 안 된다.",
    "새로고침 유지; 전체/개별 동기화; 타인 설정 접근 차단; 혜택 거부 상태 보존; 실제 푸시 발송과 저장 완료 구별.",
    "00,37,47",
  ],
  [
    42,
    "고객센터",
    "shared",
    "FAQ 검색·접기/펼치기·운영 시간과 문의 진입을 제공한다. 답변에는 현재 취소/인증/정산 정책을 사용한다.",
    "GET /api/support/faqs?q=&category= → items. 초기에는 서버 정적 데이터 가능; 원본 질문을 실제 정책으로 답변.",
    "정적 FAQ 설정 또는 faq 테이블(운영 편집 요구 시에만). 별도 관리자 CMS를 선제 구축하지 않는다.",
    "검색/결과 없음/답변 펼치기/문의 이동; 미확정 환불/보험 정책을 확정 보장으로 적지 않음.",
    "37,43,47",
  ],
  [
    43,
    "1:1 문의 접수",
    "shared",
    "예약/결제/차량/기타 유형·제목·본문·사진을 입력하고 접수번호를 표시한다. 연락 이메일 미등록 시 안내한다.",
    "POST /api/support/inquiries {category,title,content,uploadIds}; GET /api/me/inquiries?page=&limit=; GET /api/me/inquiries/:id. 비동기 이메일 발송 상태는 별도.",
    "inquiries/inquiry_attachments/uploads. 문자열 길이·첨부 제한·작성자 검증과 rate limit. 실제 메일 연동 전 발송 완료 금지.",
    "필수 누락/크기 초과/타인 파일 차단; 재시도 중복 접수 방지; 내 문의 재조회; 비밀정보 입력 안내.",
    "38,42",
  ],
  [
    44,
    "채팅 목록",
    "shared",
    "상대 이름/차량 검색, 전체/안읽음 필터, 마지막 메시지·시각·읽지 않은 수를 제공한다.",
    "GET /api/me/conversations?q=&unreadOnly=&cursor=&limit= → 예약별 대화 요약. 실시간 새 메시지/읽음 이벤트로 목록 갱신.",
    "참여 bookings/chat_messages/chat_reads. 자기 메시지와 읽음 커서를 반영한 unread 집계, 마지막 메시지 순서 안정화.",
    "다른 예약 대화 미노출; 읽음 처리 후 수 감소; 본인 전송 unread 증가 안 됨; 검색/빈 목록/페이지 중복 방지.",
    "19,37,47",
  ],
  [
    45,
    "게스트 예약 목록",
    "guest",
    "다가오는/지난 이용과 요청/승인 대기/확정/취소·완료 상태를 구별하고 적절한 상세/결제/인수 버튼을 제공한다.",
    "GET /api/me/bookings?tab=&status=&page=&limit=. 게스트 본인 기준 조회, 시간과 상태 기준으로 탭 분류.",
    "bookings/vehicles/호스트 공개 프로필. 페이지 총수와 상태 필터를 일치.",
    "자기 예약만 조회; 과거 미완료 예약의 상태 처리; 취소/만료 표기; 상세 ID 유지 및 재방문 복원.",
    "08,17,18",
  ],
  [
    46,
    "결제수단 추가",
    "shared",
    "PG 호스팅 필드/리디렉션으로 카드 등록한다. 전체 카드번호·CVC가 앱 API/로그/저장소에 들어가지 않게 하며 기본 수단 선택을 제공한다.",
    "POST /api/me/payment-method-setup → providerSession/mode; POST /api/me/payment-methods {setupReference,isDefault}. 서버가 공급자에서 등록 결과/소유 관계 확인 후 참조만 보관.",
    "payment_methods(provider,vault_ref,brand,last_four), setup 참조 일회 사용. 개발 모드는 테스트 토큰만 허용하며 실제 카드 입력을 받지 않는다.",
    "위조 setup/재사용/타인 참조 거부; PG 취소/실패 처리; 응답/로그 카드 원문 없음; 등록 후 16/40에 반영.",
    "16,40",
  ],
  [
    47,
    "호스트 마이페이지",
    "host",
    "37과 같은 공용 프로필·설정 메뉴에 호스트 역할·게스트 전환·수익/차량 관리를 연결한다. 화면 공통 컴포넌트를 재사용한다.",
    "GET /api/me/profile; PATCH /api/me/active-role; GET /api/host/dashboard의 요약. 서버 host 권한 필수.",
    "users/user_roles, 호스트 요약. 화면 모드 문자열만 바꾸어 권한을 우회하지 않는다.",
    "37과 수정 내용 동기화; 게스트 전환; 수익/차량 경로 연결; 역할 미보유 접근 거부.",
    "25,26,36,37,38,39,40,41,42",
  ],
  [
    48,
    "보험 선택",
    "guest",
    "완전자차/일반자차의 일요금·보장·자기부담금·면책·기간 합계를 보여주고 선택 후 예약 요약으로 돌아간다. 실제 계약 없는 보장을 확정 문구로 쓰지 않는다.",
    "GET /api/insurance-products?vehicleId=&startsAt=&endsAt= → products/version/mode; POST /api/bookings/quote로 상품 선택 재계산.",
    "insurance_products와 예약 보험 스냅샷. 가입 실행은 공급자 결과 확인 후 상태 저장. 시안 18,000/9,000은 개발 샘플로만 사용.",
    "보험 변경 시 기간 전체 보험료 반영; 만료 상품/허용 안 된 차량 거부; 예약 후 상품 변경이 기존 계약을 바꾸지 않음.",
    "15,16,20,21",
  ],
  [
    49,
    "차량 세부사항 저장 완료",
    "host",
    "30에서 저장된 차량명·연식·사양·픽업/옵션 저장 요약을 재조회하고 사진 등록 계속하기를 제공한다. URL만으로 성공 메시지를 만들지 않는다.",
    "GET /api/host/vehicles/:id/registration-progress → completedSteps/detailsSavedAt/summary/nextStep. 세부정보 저장 이력이 없으면 30으로 안내.",
    "vehicles와 옵션 연결. 별도 saved-success 테이블 불필요; 저장 단계/시각은 실제 업데이트에서 기록.",
    "30 저장 실패 시 진입하지 않음; 직접 URL/새로고침 복구; 타인 ID 거부; 31로 같은 draft ID 전달.",
    "30,31",
  ],
  [
    50,
    "AI 요금 추천 이유",
    "host",
    "추천/현재 요금·근거·산정시각·샘플수·모드·불확실성을 보여주고 명시적 적용 버튼을 제공한다. 근거 없는 예약률 상승 수치는 표시하지 않는다.",
    "GET /api/host/vehicles/:id/pricing-recommendation → recommendationId,amount,factors,modelVersion,mode; POST /api/host/vehicles/:id/pricing-recommendation/apply {recommendationId,version}.",
    "차량 분석/추천 스냅샷, vehicles.daily_price. 개발 규칙 기반이면 AI 실모델로 가장하지 않는다. 적용 시 소유권/만료/가격 검증.",
    "조회만으로 요금 변경 없음; 만료 추천/타인 적용 거부; 적용 후 33과 신규 견적 갱신; 기존 예약 요금 유지.",
    "32,33",
  ],
  [
    51,
    "게스트 매너 및 이전 평가",
    "host",
    "현재 예약 게스트의 공개 닉네임·인증 요약·매너온도·완료 이용수·평점·후기를 페이지로 보여주고 요청 상세로 복귀한다.",
    "GET /api/host/bookings/:id/guest-profile?cursor=&limit= → publicProfile,reviewSummary,reviews. 예약 소유 호스트 관계 확인 후 공개 평가만 제공.",
    "bookings 관계, users의 공개 프로필, reviews, 검증 요약. 전화/이메일/원문 면허/다른 예약 상세 미노출.",
    "예약 관계 없는 호스트 거부; 후기 0개 평균 처리; 실제 평가수/완료 이용수 일치; 35 복귀 ID 유지.",
    "24,35",
  ],
];

const pages = rows.map(
  ([number, title, group, frontend, api, database, acceptance, related]) => ({
    number,
    id: String(number).padStart(2, "0"),
    title,
    group,
    frontend,
    api,
    database,
    acceptance,
    related: related.split(",").map(Number),
  }),
);
const originals = (await readdir(root))
  .filter((name) => /^\d{2}-.*\.svg$/.test(name))
  .sort();
if (
  originals.length !== 52 ||
  pages.length !== 52 ||
  new Set(pages.map((p) => p.number)).size !== 52
) {
  throw new Error("Expected 52 unique screens and 52 source SVG files.");
}
await mkdir(path.join(root, "docs", "pages"), { recursive: true });

const decode = (value) =>
  value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
    };
    if (named[entity]) return named[entity];
    return String.fromCodePoint(
      entity.startsWith("&#x")
        ? parseInt(entity.slice(3, -1), 16)
        : Number(entity.slice(2, -1)),
    );
  });

for (const page of pages) {
  const matches = originals.filter((name) => name.startsWith(`${page.id}-`));
  if (matches.length !== 1) throw new Error(`Source mismatch for ${page.id}`);
  page.source = matches[0];
  page.file = `${page.id}_${page.source.slice(3, -4)}.txt`;
  const svg = await readFile(path.join(root, page.source), "utf8");
  const labels = [...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs)].map((m) =>
    decode(m[1].replace(/<[^>]+>/g, "")),
  );
  const group = groups[page.group];
  const stage = implemented.get(page.number);
  const content = `근차 화면 ${page.id}: ${page.title}
구분: ${group.label}
상태: ${stage ? "UI·API·MariaDB 구현 / 외부 공급자 미연동은 별도 표시" : "PRD/구현 프롬프트 작성 / 앱 기능 미구현"}
원본: ../../${page.source}
권장 화면 경로: /screens/${page.id} (리소스 ID는 경로 또는 검색 파라미터로 전달)

1. 목적 및 범위
${page.frontend}
기능 기준은 원본 분류표, 화면 구조는 위 SVG, 공통 업무 정책은 ../01_PRD.txt를 따른다. 49번은 분류표 누락 보완 화면이다.

2. 프론트엔드 요구사항
${page.frontend}
390px 모바일 SVG를 참고해 반응형으로 구현한다. SVG 전체를 이미지로 붙여 기능을 대체하지 않는다. 입력 label/키보드/오류 안내를 제공하고 loading/empty/error/success 상태를 구별한다.
관련 화면: ${page.related.map((n) => String(n).padStart(2, "0")).join(", ")}. 해당 리소스 ID와 되돌아갈 경로를 보존한다.

3. 백엔드 및 API 계약
${page.api}
성공 응답은 {data,meta?}, 오류는 {error:{code,message,fields?,requestId}} 형식으로 통일한다. 예: 400 입력 오류, 401 미로그인, 403 권한 부족, 404 미존재/비공개, 409 중복/상태 충돌, 429 횟수 제한, 503 공급자 미설정.
새 API는 packages/contracts의 요청·응답 schema를 먼저 정의한다. 계약에 없는 클라이언트 금액/사용자ID/검증성공 입력은 신뢰하지 않는다. 위 API는 제안 계약이며 실제 구현 후 확정 경로와 예제를 기록한다.

4. MariaDB 및 권한
${page.database}
../03_MariaDB_설계.txt의 타입/FK/인덱스/트랜잭션 기준을 적용한다. 사용자별 요청은 세션 사용자와 리소스 소유자/예약 참여자 관계를 서버에서 확인한다. 날짜 UTC 저장·서울 표시, SQL 매개변수 바인딩을 사용한다.

5. 완료 조건과 검증
${page.acceptance}
단순 버튼 이동 이외에 저장 후 재조회, 직접 URL/새로고침, 실패 응답을 확인한다. 외부 연동이 필요하면 개발 adapter와 실제 미연동 상태를 구별해 검증한다. 실행 명령과 실제 결과를 기능 README에 적는다.

6. 순차 구현용 프롬프트
docs/00_전체_구현_프롬프트.txt 및 공통 명세를 읽고 화면 ${page.id} '${page.title}'를 구현하라. 이전 화면 코드를 보존하면서 이 문서 2~5절을 만족시켜라.
먼저 API schema와 서버 권한/업무 규칙, 필요한 migration/repository/service를 작성하라. 이후 프론트엔드를 실제 API에 연결하라. 의존 서비스가 이미 있으면 재사용하고 구현이 없으면 화면 번호와 별개인 선행 기반 작업으로 기록하라.
초기 개별 화면 파일 제안 대신 현재는 기능별 pages 컴포넌트로 구현했다. 실제 소스 위치: ${stage ? stage.files.join(", ") : "구현 전"}. 공유 입력 계약은 packages/contracts/index.ts, 관계형 스키마는 database/migrations/를 따른다.
SOLID는 책임·의존 방향, KISS는 단순한 흐름, YAGNI는 요구 범위 유지로 각각 설명하라. 실제 변경 파일과 핵심 함수, API/DB, 검증, 외부 미연동을 ../README_${group.name}.txt와 ../07_구현기록.txt에 추가하라. 검증되지 않은 기능을 완료로 표시하지 마라.

7. 구현 기록
${
  stage
    ? `실제 단계: [${stage.number}] ${stage.title} / 최초 기능 커밋 ${stage.commit}
실제 소스: ${stage.files.join(", ")}
API/DB 적용: 서버 라우터·공유 contracts와 database/migrations 적용. 위 3절은 초기 제안 계약이며 실제 경로/입출력은 ../09_API_실행계약.txt 및 소스를 기준으로 한다.
실행 검증: 타입 검사/빌드, 요금·상태·암호화 단위 테스트 및 별도 MariaDB *_test DB의 통합 시나리오. 브라우저 최종 검증 결과는 ../08_실제구현.txt에 기록.
SOLID/KISS/YAGNI: 책임별 모듈/공급자 주입, 명시적 트랜잭션·공통 컴포넌트, 미요구 기능 제외. 상세는 ../04_SOLID_KISS_YAGNI.txt와 실제 구현 이력을 참조.
외부 공급자 설정: 개발 인증/개발 결제/개발 외관 예시/규칙 기반 추천을 실제 공급자와 구분. ../implementation-status.json의 limitations 및 ../08_실제구현.txt 참조.`
    : "실제 앱 소스·검증: 미구현/미실행"
}

8. SVG에서 추출한 화면 문구 (참고용, 실데이터 아님)
${labels.map((label) => `- ${label}`).join("\n")}

위 문구의 예시 차량/날짜/금액/인증/AI 판정은 UI 참고 자료다. 실제 서버 상태와 일치하도록 바꾸고 미연동 성공을 가장하지 않는다. 배치·색상·이미지는 원본 SVG를 직접 확인한다.
`;
  await writeFile(path.join(root, "docs", "pages", page.file), content, "utf8");
}

for (const [key, group] of Object.entries(groups)) {
  const selected = pages.filter((page) => page.group === key);
  const cross =
    key === "guest"
      ? "공용 20~24의 인수/반납/비교/정산/후기도 게스트 이용 흐름에 포함된다. README_공용.txt와 해당 화면 문서를 함께 읽는다."
      : key === "shared"
        ? "20~24는 게스트 이용 흐름과 중복되며 수행자는 단계마다 구별한다. 기본 제출자는 게스트, 열람/확인은 예약 참여자 양쪽이다."
        : key === "host"
          ? "49는 원본 기능 분류표에 누락되어 있지만 SVG가 있으므로 차량 등록 저장 확인 화면으로 포함했다. 47은 공용 프로필과 UI/API를 재사용한다."
          : "가입 전 동의·역할 선택과 가입 후 인증을 이어서 처리한다. 인증 입력 저장을 실제 공급자 인증 성공으로 대신하지 않는다.";
  const content = `근차 ${group.label} README
상태: UI·API·MariaDB 구현 / 외부 공급자 미연동 별도 표시

1. 역할 및 범위
${group.responsibility}
화면: ${selected.map((p) => p.id).join(", ")}
${cross}

2. 읽는 순서
00_전체_구현_프롬프트.txt → 01_PRD.txt → 02_구현순서.txt → 03_MariaDB_설계.txt → 아래 화면별 문서.
화면 구현은 전체 00~51 번호순, 공통 서비스/DB는 선행 작성 가능. 아래 목록은 이 구분 내의 순서다.

3. 화면별 PRD 및 구현 순서
${selected.map((p) => `${p.id}. ${p.title}\n+  문서: pages/${p.file}\n+  원본: ../${p.source}\n+  프론트엔드: ${p.frontend}\n+  API: ${p.api}\n+  DB/권한: ${p.database}\n+  완료 검증: ${p.acceptance}`).join("\n\n")}

4. 소스코드 설명 기준
구현 후 각 화면의 실제 파일과 핵심 함수를 이 문서에 기록한다. 예정 경로: apps/web/src/pages, apps/api/src/modules/${group.module}, packages/contracts, database/migrations.
실제 소스와 단계별 커밋은 implementation-status.json 및 08_실제구현.txt에서 관리한다. 원래 예정 경로 대신 기능별 pages/Auth.tsx, Guest.tsx, Shared.tsx, Host.tsx와 API 책임별 모듈로 구현했다. ../scripts/generate-docs.mjs는 원본 PRD와 실제 구현 상태를 결합해 이 TXT와 화면별 TXT를 생성한다. ../scripts/check-docs.mjs는 52개 정본·실제 소스 존재·참조를 검사한다.
문서 생성기를 다시 실행하면 화면별 TXT 및 이 README TXT를 재생성하므로 실제 구현 이력은 07_구현기록.txt에 먼저 남긴다. 구현 시 생성기 명세에도 이력 반영 방식을 추가하거나 이 문서의 관리를 수동으로 전환하고 재생성 정책을 갱신한다.

5. SOLID / KISS / YAGNI
SOLID: 컨트롤러/업무 서비스/저장소/화면 책임을 구별하고 외부 provider만 필요한 경계에서 주입한다.
KISS: 공통 상태 전이/요금 계산/DTO를 재사용하고 같은 규칙을 여러 화면에 복제하지 않는다.
YAGNI: 위 화면에 필요한 기능만 구현한다. 미요구 운영자 UI·쿠폰·포인트 등을 선제 추가하지 않는다.
적용 기준 전문: 04_SOLID_KISS_YAGNI.txt. 실제 적용 여부는 코드와 검증으로 기록한다.

6. 실제 구현 기록
앱 소스: ${[...new Set(selected.map((p) => implemented.get(p.number)).filter(Boolean))].map((stage) => `[${stage.number}] ${stage.title} (${stage.commit})`).join(" / ")}
실제 파일: ${[...new Set(selected.flatMap((p) => implemented.get(p.number)?.files ?? []))].join(", ")}
MariaDB migration: 001_initial.sql / 002_chat_and_setup.sql 적용
검증: 실제 결과·환경·테스트 명령은 08_실제구현.txt 및 저장소 README 참조
외부 공급자: ${implementation.limitations.join("; ")}
구현 이력 정본: 08_실제구현.txt / API 정본: 09_API_실행계약.txt
향후 기록: 화면번호 / 구현 순서 / 실제 소스파일 / 핵심 함수와 호출 흐름 / API·DB / 원칙별 적용 / 검증명령·결과 / 미연동.

7. 사용 도구
문서 작업에 실제 사용한 도구와 앱 도입 후보는 06_사용도구.txt를 참조한다. 기능 구현 시 정확한 버전과 사용 위치를 그 문서에 추가한다.
`;
  await writeFile(
    path.join(root, "docs", `README_${group.name}.txt`),
    content,
    "utf8",
  );
}

await writeFile(
  path.join(root, "docs", "screen-manifest.json"),
  `${JSON.stringify(
    pages.map(({ number, id, title, group, source, file, related }) => ({
      number,
      id,
      title,
      group,
      source,
      document: `pages/${file}`,
      related,
    })),
    null,
    2,
  )}\n`,
);
console.log(
  "Generated 52 screen PRD/prompts, 4 category README TXT files, and screen-manifest.json.",
);
const readme = `# 근차 (geuncha)

동네 차량 공유 앱의 **00~51 화면을 React·TypeScript + Node.js·Express·TypeScript + MariaDB로 구현한 개발 버전**입니다. 실제 카카오·PASS·면허·PG·보험·외관 AI·계좌 지급 공급자는 미연동이며, 개발 인증/결제/등급 예시와 규칙 기반 요금 추천을 명시적으로 구분합니다. AWS 배포는 수행하지 않았습니다.

## 실행

다른 Windows PC에는 [Windows 설치 안내](docs/12_Windows_설치파일.txt)에 따라 releases/Geuncha-Setup-0.1.0-win-x64.exe 하나를 전달합니다. 설치 EXE에는 Node.js·MariaDB·빌드한 앱이 포함되며 별도 개발 도구 설치가 필요 없습니다. 설치본은 시작 메뉴의 Geuncha로 실행합니다. 아래 명령은 소스에서 개발할 때의 실행법입니다.

Node.js 22.12 이상이 필요합니다. Windows에서는 [start.cmd](start.cmd)를 더블클릭합니다. 최초 의존성 설치, 무작위 개발 DB 비밀번호 생성, 공식 MariaDB 개발용 압축본 다운로드·SHA256 확인, 마이그레이션·시드 후 웹과 API를 실행합니다. 다운로드는 약 87MB이며 .runtime에만 저장합니다. 기존 .env와 DB 데이터는 재실행해도 보존합니다. 웹/API 준비를 확인한 후 기본 브라우저를 자동으로 엽니다. 이미 정상 실행 중이면 기존 앱을 재사용합니다. 오류 기록은 .runtime/startup.log에 저장하며 비밀번호·토큰은 제거합니다. 실행 중인 터미널 창은 유지하세요.

- 웹: http://127.0.0.1:5173 / API 상태: http://127.0.0.1:3001/api/health
- 실제 휴대폰: PC와 같은 공유기의 Wi-Fi에 연결한 뒤 [start-mobile.cmd](start-mobile.cmd)를 실행하고 콘솔의 PHONE URL에 접속합니다. [모바일 테스트 안내](docs/11_모바일_테스트.txt)를 참고하세요. 일반 LAN HTTP에서는 GPS 위치 인증에 제한이 있습니다.
- 개발 게스트: guestdemo / 호스트: hostdemo / 비밀번호: Geuncha123!
- 종료: 실행 터미널에서 Ctrl+C. 개발 DB는 계속 실행되며 데이터를 보존합니다.
- Docker MariaDB: node scripts/start.mjs --db docker
- 기존 MariaDB: .env 접속값을 설정하고 node scripts/start.mjs --db existing
- Ubuntu 개발 실행: sh start.sh --db docker 또는 sh start.sh --db existing. Ubuntu 실기동은 아직 검증하지 않았습니다.
- 준비 작업만: node scripts/start.mjs --setup-only --db portable (Windows).

새 사용자는 00 약관→02 역할→04 가입→05~07 개발 인증 후 예약할 수 있습니다. 16은 예약 요청, 35에서 호스트 승인 후 18에서 개발 결제하면 확정됩니다. 인수는 시작 30분 전부터 가능하며, 8방향+계기판 증빙을 제출합니다. 반납 후 양측이 22에서 확인해야 23 정산을 진행할 수 있습니다.

## 단계별 커밋

| 단계 | 최초 기능 커밋 | 기준과 구현 내용 |
| --- | --- | --- |
${implementation.stages.map((stage) => `| ${stage.number} | ${stage.commit} | ${stage.screens.length ? "화면 " + stage.screens.map((n) => String(n).padStart(2, "0")).join("·") : "공통 기반"}: ${stage.title} |`).join("\n")}

이후 커밋은 [단계번호][기준 화면 또는 공통 기능] 변경 내용 형식을 사용합니다. 실제 작업 순서와 검증 결과는 [실제 구현 이력](docs/08_실제구현.txt)에 기록합니다. 화면 번호순 PRD를 기준으로 공통 서비스를 먼저 만들고, 의존 기능 45·48 및 공용 프로필 47은 사용하는 단계에 함께 구현했습니다.

## 기능별 README와 PRD

- [회원가입·로그인 README TXT](docs/README_회원가입_로그인.txt): 00~07.
- [게스트 README TXT](docs/README_게스트.txt): 08~18·45·48. 이용 과정 20~24는 공용 문서 참조.
- [공용 README TXT](docs/README_공용.txt): 19~24·37~44·46.
- [호스트 README TXT](docs/README_호스트.txt): 25~36·47·49~51. 49는 SVG를 근거로 기능 분류표 누락을 보완했습니다.
- [화면별 PRD·프롬프트 52개](docs/pages), [마스터 구현 프롬프트](docs/00_전체_구현_프롬프트.txt), [제품 PRD](docs/01_PRD.txt), [실제 API 계약](docs/09_API_실행계약.txt).
- 원본: [앱 전체 기능 분류.txt](앱%20전체%20기능%20분류.txt), [DB 설계 초안](DB%28마리아%29.txt), 루트 52개 SVG. 원본 예시 날짜·금액을 실제 데이터로 고정하지 않습니다.

## 소스코드와 설계 원칙

- [공유 contracts](packages/contracts/index.ts): Zod 입력 검증과 TypeScript DTO.
- [API 초기화](apps/api/src/app.ts): 세션·요청 보호·오류 응답·모듈 조립. [예약 서비스](apps/api/src/modules/bookings/service.ts)는 차량 행 잠금, 요금 스냅샷, 승인/개발 결제·취소/환불을 처리합니다.
- [가격 도메인](apps/api/src/domain/pricing.ts): 이용일수·보험·게스트 수수료·호스트 순수익·주행료·상태 전이를 한곳에서 계산합니다. 68,000+18,000+6,800=92,800원입니다.
- [외부 공급자 경계](apps/api/src/providers/index.ts): 결제·인증·차량 분석 interface와 개발/미설정 구현. 운영에서 개발 공급자로 시작하면 거부합니다.
- [인증](apps/api/src/modules/auth/routes.ts), [차량 검색](apps/api/src/modules/vehicles/routes.ts), [공용 기능](apps/api/src/modules/shared), [호스트 기능](apps/api/src/modules/host/routes.ts)은 각 업무 책임을 담당합니다.
- 프론트엔드는 [Auth](apps/web/src/pages/Auth.tsx), [Guest](apps/web/src/pages/Guest.tsx), [Shared](apps/web/src/pages/Shared.tsx), [Host](apps/web/src/pages/Host.tsx) 및 공통 폼·파일·지도 컴포넌트로 구성합니다. URL에 차량/예약/기간을 보존하며 실제 API를 사용합니다.
- SOLID: 업무·저장소·공급자 책임과 의존 방향 구분. KISS: 단일 서버·DB, 명시적 SQL 트랜잭션과 공통 컴포넌트. YAGNI: 미요구 쿠폰·포인트·관리자 웹·마이크로서비스 제외. [상세 적용 기준](docs/04_SOLID_KISS_YAGNI.txt).
- [MariaDB 스키마](database/migrations/001_initial.sql), [마이그레이션](apps/api/src/database/migrate.ts), [시드](apps/api/src/database/seed.ts), [DB 설계 설명](docs/03_MariaDB_설계.txt). migration checksum·DB 잠금과 개발 전용 중복 방지 시드를 사용합니다.

## 검증 및 문서 관리

npm run typecheck, npm test, npm run test:integration, npm run build, npm run test:e2e로 검사합니다. 통합 테스트는 루트 자격으로 별도 *_test DB를 준비하며 운영 모드에서는 실행하지 않습니다. 브라우저 테스트는 Windows 설치 Chrome을 사용하고 Linux에서는 Playwright Chromium 설치가 필요합니다. 최신 실제 결과는 [구현 이력](docs/08_실제구현.txt)에 기록합니다.

node scripts/generate-docs.mjs는 원본 화면 명세와 [구현 상태](docs/implementation-status.json)를 결합하여 화면별/기능별 TXT 및 이 README를 생성합니다. node scripts/check-docs.mjs는 52개 화면·실제 소스·분류·참조를 검사합니다. [문서검증.cmd](문서검증.cmd)는 이 문서 작업 전용이며 앱은 start.cmd로 실행합니다. 수동 이력은 생성기로 덮어쓰지 않는 08_실제구현.txt에 남깁니다.

[사용 도구·버전·공식 참고 자료](docs/06_사용도구.txt), [최초 실행 명세](docs/05_최초실행_명세.txt), [Ubuntu 준비](docs/10_Ubuntu_운영준비.txt)를 참고하세요. 미연동 상세: ${implementation.limitations.join("; ")}.
`;
await writeFile(path.join(root, "README.md"), readme, "utf8");
