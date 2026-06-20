@echo off
REM Helmsman - one-command launcher for Windows.
REM Installs dependencies, builds the app, and starts it at http://localhost:3001
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required. Install it from https://nodejs.org and re-run this script.
  exit /b 1
)

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo Created .env from .env.example - edit it to set a strong JWT_SECRET for production.
)

echo Installing dependencies...
call npm run setup
if errorlevel 1 exit /b 1
echo Building and starting Helmsman...
call npm run serve
