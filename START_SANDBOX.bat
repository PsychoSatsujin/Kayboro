@echo off
rem Starts Kayboro in the tester sandbox: a separate profile in .sandbox\userData (or KAYBORO_SANDBOX_DIR),
rem Tester tools in Profile, and Kayboro's own Steam achievements never unlock. Your real save is untouched.
setlocal EnableExtensions
cd /d "%~dp0"
title Kayboro (Sandbox)
call "%~dp0tools\local\kb-prelude.cmd" "%~nx0" || goto :end
set "KAYBORO_SANDBOX=1"
set "KAYBORO_TEST="
if defined KAYBORO_SANDBOX_DIR (echo Sandbox profile: %KAYBORO_SANDBOX_DIR%) else (echo Sandbox profile: %~dp0.sandbox\userData)
echo Starting Kayboro in the tester sandbox. Close its window to finish.
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
