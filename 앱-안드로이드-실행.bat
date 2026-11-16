@echo off
setlocal
cd /d "%~dp0"

where flutter >nul 2>nul
if errorlevel 1 (
  echo Flutter SDK가 PATH에 없습니다.
  pause
  exit /b 1
)

if not exist android\gradlew.bat (
  echo Android 실행 파일을 처음 구성합니다...
  call flutter create --platforms=android --no-pub .
  if errorlevel 1 (
    echo Android 플랫폼 생성에 실패했습니다. Flutter SDK 폴더의 쓰기 권한을 확인하세요.
    pause
    exit /b 1
  )
)

echo 의존성을 가져옵니다...
call flutter pub get
if errorlevel 1 (
  echo Flutter 패키지 설치에 실패했습니다.
  pause
  exit /b 1
)

echo 연결된 Android 에뮬레이터 또는 기기에서 앱을 실행합니다.
call flutter run
pause
