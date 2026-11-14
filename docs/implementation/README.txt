근차 00~51 화면별 실제 구현 설명 목록

총 52개 화면. 각 TXT는 기획 프롬프트 대신 현재 코드의 동작·API·DB·코드 발췌·설계 원칙·확인 방법·한계를 설명한다.
화면 명세/요구사항은 ../pages, 실제 구현 설명은 이 폴더로 구분한다.
먼저 화면을 고른 다음 해당 컴포넌트와 API 소스를 따라 읽는다. 여러 화면이 하나의 컴포넌트를 공유할 수 있다.

00. [회원가입·로그인] 약관 및 권한 동의
    00_consent-permissions.txt

01. [회원가입·로그인] 홈 둘러보기
    01_welcome.txt

02. [회원가입·로그인] 이용 유형 선택
    02_role-select.txt

03. [회원가입·로그인] 로그인
    03_login.txt

04. [회원가입·로그인] 회원가입
    04_signup.txt

05. [회원가입·로그인] 본인 확인
    05_identity-check.txt

06. [회원가입·로그인] 동네 인증
    06_neighborhood-check.txt

07. [회원가입·로그인] 면허 정보 입력
    07_license-entry.txt

08. [게스트] 게스트 홈
    08_guest-home.txt

09. [게스트] 지도에서 차량 찾기
    09_map-expanded.txt

10. [게스트] 차량 검색 결과
    10_search-results.txt

11. [게스트] 검색 필터
    11_search-filter.txt

12. [게스트] 차량 상세
    12_vehicle-detail.txt

13. [게스트] 차량 세부 정보
    13_vehicle-specs.txt

14. [게스트] 대여 일정
    14_date-selection.txt

15. [게스트] 예약 확인
    15_booking-summary.txt

16. [게스트] 결제 수단 및 예약 요청
    16_payment.txt

17. [게스트] 예약 요청 및 완료
    17_booking-complete.txt

18. [게스트] 예약 상세
    18_booking-detail.txt

19. [공용] 예약 채팅방
    19_chat.txt

20. [공용] 인수 전 차량 상태
    20_pickup-inspection.txt

21. [공용] 반납 후 차량 상태
    21_return-inspection.txt

22. [공용] 외관 및 계기판 비교
    22_condition-comparison.txt

23. [공용] 최종 정산 및 추가 결제
    23_final-settlement.txt

24. [공용] 이용 후기 작성
    24_review.txt

25. [호스트] 호스트 홈
    25_host-home.txt

26. [호스트] 호스트 차량 목록
    26_host-vehicles.txt

27. [호스트] 차량 정보 수정 및 삭제
    27_host-vehicle-edit.txt

28. [호스트] 차량 기본 정보 입력
    28_vehicle-information.txt

29. [호스트] 차량 종류와 사양 입력
    29_vehicle-category.txt

30. [호스트] 차량 세부사항 입력
    30_vehicle-details.txt

31. [호스트] 차량 외관 사진 등록
    31_vehicle-photos.txt

32. [호스트] AI 외관 등급
    32_ai-grade.txt

33. [호스트] 대여 가능 일정과 요금
    33_availability-pricing.txt

34. [호스트] 호스트 예약 목록
    34_host-reservations.txt

35. [호스트] 예약 요청 상세 및 관리
    35_host-reservation-detail.txt

36. [호스트] 호스트 수익 대시보드
    36_host-earnings.txt

37. [공용] 게스트 마이페이지
    37_my-page.txt

38. [공용] 개인정보 수정
    38_personal-information.txt

39. [공용] 면허 관리
    39_license-management.txt

40. [공용] 결제수단 관리
    40_payment-methods.txt

41. [공용] 알림 설정
    41_notification-settings.txt

42. [공용] 고객센터
    42_customer-center.txt

43. [공용] 1:1 문의 접수
    43_inquiry-form.txt

44. [공용] 채팅 목록
    44_chat-list.txt

45. [게스트] 게스트 예약 목록
    45_guest-bookings.txt

46. [공용] 결제수단 추가
    46_payment-method-add.txt

47. [호스트] 호스트 마이페이지
    47_host-my-page.txt

48. [게스트] 보험 선택
    48_insurance.txt

49. [호스트] 차량 세부사항 저장 완료
    49_vehicle-details-saved.txt

50. [호스트] AI 요금 추천 이유
    50_ai-pricing-reason.txt

51. [호스트] 게스트 매너 및 이전 평가
    51_guest-profile-reviews.txt

갱신: scripts/screen-implementation-data.mjs의 화면 설명을 실제 코드에 맞게 수정한 뒤 node scripts/generate-docs.mjs 실행.
검사: node scripts/check-docs.mjs. 경로·함수 앵커·API 등록·테이블 존재와 생성 결과의 최신성을 확인한다.
소스 줄은 재생성 시점 기준이며 설명의 업무 의미는 코드 변경 시 함께 검토해야 한다.
사용 도구: Node.js fs/path/assert 기반 생성·검사, PowerShell/rg 소스 대조, Prettier 형식 정리. 새 패키지나 외부 서비스는 도입하지 않았다.
