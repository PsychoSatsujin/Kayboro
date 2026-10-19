@echo off
rem Shared start of the root .bat launchers. The caller has already done: cd /d "%~dp0"
rem   call "%~dp0tools\local\kb-prelude.cmd" "%~nx0"        checks Node/npm, runs npm ci when node_modules is missing
rem   call "%~dp0tools\local\kb-prelude.cmd" "%~nx0" soft   only warns: for the launchers that work without Node
rem Sets KB_DBL=1 when the launcher was double-clicked in Explorer, so it can pause at the end.
rem KAYBORO_NO_PAUSE=1 turns every pause off, for scripts and CI.
set "KB_DBL="
setlocal EnableDelayedExpansion
set "KB_C=!cmdcmdline!"
rem Explorer starts a .bat as: cmd.exe /c ""<path>\NAME.bat" "  (a terminal or PowerShell doesn't add the last " ")
set "KB_T=!KB_C:%~1" "=!"
if not "!KB_T!"=="!KB_C!" (endlocal & set "KB_DBL=1") else endlocal
if "%KAYBORO_NO_PAUSE%"=="1" set "KB_DBL="

where node >nul 2>nul
if errorlevel 1 goto :no_node
where npm >nul 2>nul
if errorlevel 1 goto :no_node
set "KB_NODE_MAJOR=0"
for /f "tokens=1 delims=v." %%v in ('node --version') do set "KB_NODE_MAJOR=%%v"
if %KB_NODE_MAJOR% LSS 18 goto :old_node
if /i "%~2"=="soft" exit /b 0
if exist "node_modules\" exit /b 0
echo node_modules is missing: running npm ci. This takes a minute or two...
call npm ci
if errorlevel 1 goto :npm_failed
exit /b 0

:no_node
echo Node.js and npm were not found. Install Node 22 LTS from https://nodejs.org, then run this again.
if /i "%~2"=="soft" exit /b 0
exit /b 1

:old_node
echo Node %KB_NODE_MAJOR% is too old. Kayboro needs Node 18 or newer; Node 22 LTS is recommended: https://nodejs.org
if /i "%~2"=="soft" exit /b 0
exit /b 1

:npm_failed
echo npm ci failed. Check your internet connection and the messages above, then run this again.
exit /b 1
