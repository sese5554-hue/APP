@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer first.
  pause
  exit /b 1
)
node scripts/start.mjs --db portable --lan --open --screen-test %*
set "GEUNCHA_EXIT=%ERRORLEVEL%"
if not "%GEUNCHA_EXIT%"=="0" (
  echo Screen test startup failed. See .runtime\startup.log.
  pause
)
exit /b %GEUNCHA_EXIT%
