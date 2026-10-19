@echo off
rem Removes the local test build of the Kayboro Virtual Screen Driver and the "Kayboro Driver Test"
rem certificate that scripts\dev-install.cmd trusted. Run as administrator.
setlocal EnableExtensions
net session >nul 2>&1 || (echo Run this from an administrator command prompt. & pause & exit /b 1)
set "ROOT=%~dp0.."
set "CN=Kayboro Driver Test"

if exist "%ROOT%\build\Release\package\kbvdd-setup.exe" "%ROOT%\build\Release\package\kbvdd-setup.exe" uninstall
certutil -delstore TrustedPublisher "%CN%" >nul 2>&1
certutil -delstore Root "%CN%" >nul 2>&1
certutil -user -delstore My "%CN%" >nul 2>&1
echo The test driver and its certificate are removed.
pause
