@echo off
rem Renders every catalog shell into .preview\all and opens the contact sheet (sheet.png).
rem   PREVIEW_SHELLS.bat          shells listed in src\catalog\frames-*.json
rem   PREVIEW_SHELLS.bat drafts   plus shells that are drawn but not in the catalog yet
setlocal EnableExtensions
cd /d "%~dp0"
title Kayboro shell preview
call "%~dp0tools\local\kb-prelude.cmd" "%~nx0" || goto :end
set "KB_ARGS="
if /i "%~1"=="drafts" set "KB_ARGS=--drafts"
if /i "%~1"=="--drafts" set "KB_ARGS=--drafts"
node tools\local\preview-shells.cjs %KB_ARGS%
set "KB_PREVIEW_RC=%errorlevel%"
if exist ".preview\all\sheet.png" start "" ".preview\all\sheet.png"
cmd /c exit %KB_PREVIEW_RC%

:end
set "KB_RC=%errorlevel%"
if "%KAYBORO_NO_PAUSE%"=="1" exit /b %KB_RC%
if not "%KB_RC%"=="0" (
  echo.
  echo Something went wrong: exit code %KB_RC%. Read the messages above.
  pause
) else if defined KB_DBL pause
exit /b %KB_RC%
