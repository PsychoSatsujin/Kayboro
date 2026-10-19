@echo off
rem Starts Kayboro from source (npm start), with your real profile.
setlocal EnableExtensions
cd /d "%~dp0"
title Kayboro
call "%~dp0tools\local\kb-prelude.cmd" "%~nx0" || goto :end
echo Starting Kayboro. Close its window to finish.
call npm start

:end
set "KB_RC=%errorlevel%"
if "%KAYBORO_NO_PAUSE%"=="1" exit /b %KB_RC%
if not "%KB_RC%"=="0" (
  echo.
  echo Something went wrong: exit code %KB_RC%. Read the messages above.
  pause
) else if defined KB_DBL pause
exit /b %KB_RC%
