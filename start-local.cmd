@echo off
REM NISAR Pro - single-click local launcher (Windows)
title NISAR Pro - local
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
echo.
echo Close this window when done.
pause