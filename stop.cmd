@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0runtime\node.exe" (
  "%~dp0runtime\node.exe" "%~dp0scripts\stop.mjs" %*
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js is required. Run this file from the Geuncha project folder.
    pause
    exit /b 1
  )
  node "%~dp0scripts\stop.mjs" %*
)
set "GEUNCHA_EXIT=%ERRORLEVEL%"
if not "%GEUNCHA_EXIT%"=="0" echo Stop failed. Read the message above.
if /I not "%~1"=="--no-pause" pause
exit /b %GEUNCHA_EXIT%
