@echo off
rem Read-only check of this PC for Kayboro testing (tools\local\check-environment.ps1).
rem Writes test\local\out\environment-<timestamp>.txt and prints a summary.
setlocal EnableExtensions
cd /d "%~dp0"
title Kayboro environment check
call "%~dp0tools\local\kb-prelude.cmd" "%~nx0" soft
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\check-environment.ps1" %*

:end
set "KB_RC=%errorlevel%"
if "%KAYBORO_NO_PAUSE%"=="1" exit /b %KB_RC%
if not "%KB_RC%"=="0" (
  echo.
  echo Something went wrong: exit code %KB_RC%. Read the messages above.
  pause
) else if defined KB_DBL pause
exit /b %KB_RC%
