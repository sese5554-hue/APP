@echo off
setlocal
cd /d "%~dp0.."
call npm.cmd run mobile:apk
set "GEUNCHA_EXIT=%ERRORLEVEL%"
if "%GEUNCHA_EXIT%"=="0" (
  echo APK: releases\Geuncha-android-debug.apk
) else (
  echo APK build failed. Check the error above.
)
pause
exit /b %GEUNCHA_EXIT%
