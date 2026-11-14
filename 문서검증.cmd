@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js and run this file again.
  pause
  exit /b 1
)
node scripts/generate-docs.mjs
if errorlevel 1 goto failed
node scripts/check-docs.mjs
if errorlevel 1 goto failed
echo Documentation generated and validated. See README.md and docs.
pause
exit /b 0
:failed
echo Documentation check failed. See the error above.
pause
exit /b 1
