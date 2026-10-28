@echo off
rem Runs the automated tests (needs Node.js LTS and "npm ci" once).
cd /d "%~dp0"
call npm test
call npm run e2e
pause
