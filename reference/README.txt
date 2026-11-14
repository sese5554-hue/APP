근차 원본 자료 분류

screens/: 화면 00~51의 원본 SVG 52개.
requirements/: 앱 전체 기능 분류.txt와 DB(마리아).txt 설계 초안.

앱 실행에 직접 사용하지 않는 기획·화면 참고 자료를 이곳에 모았습니다.
원본 내용은 변경하지 않았으며 scripts/generate-docs.mjs가 화면 자료를 읽어
docs/pages와 기능별 README, 화면 목록을 생성합니다.
실제 DB 실행 스키마는 database/migrations에 있습니다.

실행 파일은 프로젝트 루트의 start.cmd와 start-mobile.cmd입니다.
다른 Windows PC에 전달할 설치파일은 releases 폴더에 있습니다.
