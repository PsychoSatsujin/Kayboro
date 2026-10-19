@echo off
rem Zips the latest environment report, Kayboro's state files (real and sandbox), the last smoke results
rem and the last self-test into test\local\out\diagnostics-<timestamp>.zip (tools\local\collect-diagnostics.ps1).
rem Mod files and developer form submissions are never included. Add -IncludeScreenshots for the smoke PNGs.
setlocal EnableExtensions
cd /d "%~dp0"
title Kayboro diagnostics
call "%~dp0tools\local\kb-prelude.cmd" "%~nx0" soft
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\collect-diagnostics.ps1" %*
if not errorlevel 1 if exist "test\local\out\" start "" "test\local\out"
cmd /c exit %errorlevel%

:end
set "KB_RC=%errorlevel%"
if "%KAYBORO_NO_PAUSE%"=="1" exit /b %KB_RC%
if not "%KB_RC%"=="0" (
  echo.
  echo Something went wrong: exit code %KB_RC%. Read the messages above.
  pause
) else if defined KB_DBL pause
exit /b %KB_RC%
