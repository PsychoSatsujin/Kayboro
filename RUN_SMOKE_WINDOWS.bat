@echo off
rem Runs the real end-to-end smoke test like CI's Windows job (tools\local\smoke-windows.ps1).
rem It moves windows, briefly confines the mouse and shows an always-on-top overlay for about a minute.
rem Extra arguments go to the script, e.g.  RUN_SMOKE_WINDOWS.bat -Yes -Only app-load
setlocal EnableExtensions
cd /d "%~dp0"
title Kayboro smoke test
call "%~dp0tools\local\kb-prelude.cmd" "%~nx0" || goto :end
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\smoke-windows.ps1" %*

:end
set "KB_RC=%errorlevel%"
if "%KAYBORO_NO_PAUSE%"=="1" exit /b %KB_RC%
if not "%KB_RC%"=="0" (
  echo.
  echo Something went wrong: exit code %KB_RC%. Read the messages above.
  pause
) else if defined KB_DBL pause
exit /b %KB_RC%
