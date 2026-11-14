@echo off
setlocal
cd /d "%~dp0"
title CosmoNotes - releasing an update
color F0
echo.
echo   ==========================================
echo      CosmoNotes - releasing an update
echo   ==========================================
echo.

rem 1.4.0: sends the version in package.json to everyone who has CosmoNotes. It pushes main and a tag "v<version>";
rem GitHub Actions (.github/workflows/release.yml) then runs the tests, builds the installer and publishes it, and the
rem apps find it by themselves (Settings > About, the tray). Nothing is built or uploaded from this PC.

where git >nul 2>nul
if errorlevel 1 goto :nogit

set "VER="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Get-Content -Raw 'package.json' | ConvertFrom-Json).version"`) do set "VER=%%v"
if "%VER%"=="" goto :nover

set "BRANCH="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
if not "%BRANCH%"=="main" goto :notmain

for /f "delims=" %%s in ('git status --porcelain') do goto :dirty

git rev-parse -q --verify "refs/tags/v%VER%" >nul 2>nul
if not errorlevel 1 goto :tagged
git ls-remote --exit-code --tags origin "refs/tags/v%VER%" >nul 2>nul
if errorlevel 128 goto :offline
if not errorlevel 2 goto :tagged

echo   Version %VER% is ready to send.
echo   Everyone with CosmoNotes will be offered it.
echo.
choice /c YN /n /m "  Release CosmoNotes %VER% now? [Y/N] "
if errorlevel 2 goto :cancelled

echo.
echo   Sending your commits...
git push origin main
if errorlevel 1 goto :pushfail
git tag -a "v%VER%" -m "CosmoNotes %VER%"
if errorlevel 1 goto :fail
git push origin "v%VER%"
if errorlevel 1 goto :tagfail

echo.
echo   ==========================================
echo      Sent! GitHub is building %VER% now.
echo   ==========================================
echo.
echo   It takes about 10 minutes. The page that opens shows how it goes.
echo   - A green tick: done. The apps find the update by themselves
echo     (or press Check for updates in Settings ^> About).
echo   - A red cross: a test or the build failed, and nothing was released.
echo     Fix it, raise the version, commit, and run release.bat again.
echo.
start "" "https://github.com/vkashirski/CosmoNotes/actions"
pause
exit /b 0


:nogit
echo   Git is not installed on this device (or not in PATH).
echo   Install it from https://git-scm.com and try again.
goto :end
:nover
echo   Couldn't read the version from package.json.
goto :end
:notmain
echo   You are on the branch "%BRANCH%". Releases are made from main.
echo   Switch to main (and merge your work) first.
goto :end
:dirty
echo   There are changes that are not committed yet:
echo.
git status --short
echo.
echo   Commit them first (or undo them), then run release.bat again.
goto :end
:tagged
echo   Version %VER% was released already.
echo   Raise the version in package.json (and CHANGELOG.md), commit, and try again.
goto :end
:offline
echo   Couldn't reach GitHub. Check the internet connection and try again.
goto :end
:cancelled
echo.
echo   Nothing was sent.
goto :end
:pushfail
echo.
echo   Couldn't push main (see above). If GitHub has commits you don't have,
echo   pull them first. Nothing was released.
goto :end
:tagfail
git tag -d "v%VER%" >nul 2>nul
echo.
echo   Couldn't push the release tag (see above). Nothing was released.
goto :end
:fail
echo.
echo   Something went wrong (see above). Nothing was released.
goto :end

:end
echo.
pause
exit /b 1
