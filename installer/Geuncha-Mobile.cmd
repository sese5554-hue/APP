@echo off
call "%~dp0Geuncha.cmd" --lan --screen-test %*
exit /b %ERRORLEVEL%
