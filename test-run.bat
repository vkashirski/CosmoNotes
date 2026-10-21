@echo off
cd /d "%~dp0"
title CosmoNotes - test run
echo.
echo   Starting CosmoNotes straight from this folder (test)...
echo   If your notes appear, Windows trusts Electron's original program file.
echo   Close this window when you're done testing (that also closes the test app).
echo.
call npx electron .
echo.
echo   CosmoNotes closed (or was blocked). You can close this window.
pause
