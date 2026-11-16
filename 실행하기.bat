@echo off
setlocal
cd /d "%~dp0"
title Clean Plate Today - Chrome

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  pause
  exit /b 1
)

if not exist node_modules\express (
  echo Installing backend packages...
  call npm.cmd install --cache "%~dp0.npm-cache"
  if errorlevel 1 (
    echo Package installation failed.
    pause
    exit /b 1
  )
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-web.ps1"
if errorlevel 1 pause
