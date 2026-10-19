@echo off
rem Runs the unit tests (npm test).
setlocal EnableExtensions
cd /d "%~dp0"
title Kayboro tests
call "%~dp0tools\local\kb-prelude.cmd" "%~nx0" || goto :end
call npm test

:end
set "KB_RC=%errorlevel%"
if "%KAYBORO_NO_PAUSE%"=="1" exit /b %KB_RC%
if not "%KB_RC%"=="0" (
  echo.
  echo Something went wrong: exit code %KB_RC%. Read the messages above.
  pause
) else if defined KB_DBL pause
exit /b %KB_RC%
