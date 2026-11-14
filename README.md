# 근차 (geuncha)

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
| 01 | ac72535 | 공통 기반: TypeScript 실행 기반·MariaDB·최초실행 |
| 02 | 496f5c1 | 화면 00·02·03·04·05·06·07: 약관·가입·로그인·역할·개발 인증 |
| 03 | 4e7ebe2 | 화면 01·08·09·10·11·12·13·14·15·16·17·18·45·48: 공개 탐색·검색·지도·견적·예약·개발 결제 |
| 04 | 165ff44 | 화면 19·20·21·22·23·24·37·38·39·40·41·42·43·44·46·47: 채팅·점검·정산·후기·공용 계정 |
| 05 | 822bdcc | 화면 25·26·27·28·29·30·31·32·33·34·35·36·49·50·51: 호스트 차량 등록·운영·예약·수익·평가 |
| 06 | f7ce661 | 공통 기반: 00~51 브라우저 검증·실행 재검증·코드 정리·문서·Ubuntu 준비 |
| 07 | 0d96d30 | 공통 기반: Chrome 브라우저 검증 설정 추적 |
| 08 | 8855284 | 공통 기반: 실행 파일 중복 실행·오류 전파·자동 브라우저·진단 로그 보완 |
| 09 | 0def9d8 | 공통 기반: 실제 휴대폰 LAN 실행·주소 선택·접속 안내 |
| 10 | 327afc5 | 공통 기반: 다른 Windows PC용 설치 EXE·번들 런타임·설치/업데이트 검증 |
| 11 | 19363d6 | 공통 기반: 원본 화면·요구사항과 테스트 보고서 폴더 정리 |
| 12 | d338b25 (형식 보완 a1f1103) | 공통 기반: 화면 00~51 실제 소스·API·DB 구현 설명 TXT 작성 |
| 13 | 커밋 이력의 [13] 참조 | 공통 기반: 전체 폴더 구조·파일 역할·실행 데이터 보존 안내 작성 |

이후 커밋은 [단계번호][기준 화면 또는 공통 기능] 변경 내용 형식을 사용합니다. 실제 작업 순서와 검증 결과는 [실제 구현 이력](docs/08_실제구현.txt)에 기록합니다. 화면 번호순 PRD를 기준으로 공통 서비스를 먼저 만들고, 의존 기능 45·48 및 공용 프로필 47은 사용하는 단계에 함께 구현했습니다.

## 기능별 README와 PRD

- [회원가입·로그인 README TXT](docs/README_회원가입_로그인.txt): 00~07.
- [게스트 README TXT](docs/README_게스트.txt): 08~18·45·48. 이용 과정 20~24는 공용 문서 참조.
- [공용 README TXT](docs/README_공용.txt): 19~24·37~44·46.
- [호스트 README TXT](docs/README_호스트.txt): 25~36·47·49~51. 49는 SVG를 근거로 기능 분류표 누락을 보완했습니다.
- [화면별 PRD·프롬프트 52개](docs/pages), [마스터 구현 프롬프트](docs/00_전체_구현_프롬프트.txt), [제품 PRD](docs/01_PRD.txt), [실제 API 계약](docs/09_API_실행계약.txt).
- [00~51 화면별 실제 구현 설명 목록](docs/implementation/README.txt): 화면마다 컴포넌트·API·MariaDB 처리·실제 코드 발췌·설계 원칙·확인 방법·미연동 범위를 별도 TXT로 설명합니다.
- 원본: [앱 전체 기능 분류.txt](reference/requirements/앱%20전체%20기능%20분류.txt), [DB 설계 초안](reference/requirements/DB%28마리아%29.txt), [화면 원본 SVG 52개](reference/screens). 원본 예시 날짜·금액을 실제 데이터로 고정하지 않습니다.

## 폴더 안내

[전체 폴더 구조·주요 파일 역할 설명 TXT](docs/13_전체_폴더_구조.txt)에서 소스·문서·설치파일·실행 데이터의 위치를 확인할 수 있습니다.

- apps / packages / database: 앱 소스코드, 공유 계약, MariaDB 마이그레이션.
- reference: 실행에 직접 사용하지 않는 원본 화면과 요구사항 자료. [분류 안내](reference/README.txt).
- docs: 기능별 README, 화면 PRD, 구현·검증 기록.
- installer / deploy: Windows 설치파일 제작과 Ubuntu 배포 준비 자료.
- releases: 다른 Windows PC에 전달할 설치 EXE.
- .runtime: 실행에 필요한 로컬 DB·업로드·도구와 임시 자료. 테스트 보고서는 .runtime/reports에 모읍니다. DB와 업로드가 있으므로 통째로 삭제하면 안 됩니다.

PC 실행은 루트의 start.cmd, 모바일 테스트는 start-mobile.cmd를 사용합니다.

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

node scripts/generate-docs.mjs는 원본 화면 명세와 [구현 상태](docs/implementation-status.json)를 결합하여 화면별/기능별 TXT 및 이 README를 생성합니다. [화면별 구현 설명 데이터](scripts/screen-implementation-data.mjs)와 실제 소스를 대조해 docs/implementation의 52개 설명과 목록도 생성합니다. node scripts/check-docs.mjs는 화면·분류·참조 및 구현 설명의 실제 API·DB 테이블·코드 발췌 최신성을 검사합니다. [문서검증.cmd](문서검증.cmd)는 이 문서 작업 전용이며 앱은 start.cmd로 실행합니다. 수동 이력은 생성기로 덮어쓰지 않는 08_실제구현.txt에 남깁니다.

[사용 도구·버전·공식 참고 자료](docs/06_사용도구.txt), [최초 실행 명세](docs/05_최초실행_명세.txt), [Ubuntu 준비](docs/10_Ubuntu_운영준비.txt)를 참고하세요. 미연동 상세: 실제 카카오·PASS·문자·면허·GPS 지역 판정 공급자 미연동; PG 카드 등록·실제 결제·환불·계좌 지급 공급자 미연동; 실제 보험 가입/보장 및 통행료 공급자 미연동; 외관 AI 미연동: 개발 B등급 예시/수동 비교 제공; 요금 추천: 비교 차량 평균과 등급을 사용한 개발 규칙, 학습 AI 수요예측 아님; 이메일/기기 푸시 미연동; AWS 배포 및 Ubuntu 실기동 미수행.
