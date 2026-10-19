@echo off
rem Builds the unpacked Windows app (npm run dist:dir) and runs dist\win-unpacked\Kayboro.exe --self-test.
rem The self-test uses its own sandbox profile (.sandbox\selftest-userData): your real save is untouched.
rem   BUILD_FOR_TESTING.bat nobuild   skips the build and only runs the self-test
setlocal EnableExtensions
cd /d "%~dp0"
title Kayboro build for testing
call "%~dp0tools\local\kb-prelude.cmd" "%~nx0" || goto :end
if /i "%~1"=="nobuild" goto :selftest
echo Building dist\win-unpacked. This takes a few minutes...
call npm run dist:dir
if errorlevel 1 (
  echo.
  echo The build failed. If npm says "Missing script: dist:dir", the packaging scripts are not in package.json yet.
  goto :end
)
:selftest
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local\self-test.ps1" -Exe "%~dp0dist\win-unpacked\Kayboro.exe"
if errorlevel 1 (echo FAIL & cmd /c exit 1) else echo PASS

:end
set "KB_RC=%errorlevel%"
if "%KAYBORO_NO_PAUSE%"=="1" exit /b %KB_RC%
if not "%KB_RC%"=="0" (
  echo.
  echo Something went wrong: exit code %KB_RC%. Read the messages above.
  pause
) else if defined KB_DBL pause
exit /b %KB_RC%
