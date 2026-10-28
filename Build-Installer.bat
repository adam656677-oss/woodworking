@echo off
rem Builds "A&A Woodworking Studio Setup.exe" into the dist folder.
rem Needs Node.js LTS installed (https://nodejs.org). Run from this folder.
cd /d "%~dp0"
call npm ci || goto :fail
call npm run dist || goto :fail
echo.
echo Done. The installer is in the "dist" folder.
pause
exit /b 0
:fail
echo.
echo The build failed. Copy the messages above and send them to Claude.
pause
exit /b 1
