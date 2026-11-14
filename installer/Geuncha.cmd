@echo off
setlocal
cd /d "%~dp0"
"%~dp0runtime\node.exe" "%~dp0scripts\installed-start.mjs" --open %*
set "GEUNCHA_EXIT=%ERRORLEVEL%"
if not "%GEUNCHA_EXIT%"=="0" (
  echo Geuncha failed to start. See .runtime\startup.log.
  pause
)
exit /b %GEUNCHA_EXIT%
