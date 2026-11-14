@echo off
REM Start the React (Vite) dev server against the chosen backend.
REM   start_server.bat         -> local : uses .env.development (http://localhost:8000)
REM   start_server.bat local   -> local : uses .env.development
REM   start_server.bat prod    -> live  : uses .env.production  (https://be.aravindpillai.com)
REM Shared values (paths, version) come from .env in both cases.

setlocal
cd /d "%~dp0"

set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=local"

if /i "%TARGET%"=="local" (
    set "MODE=development"
) else if /i "%TARGET%"=="prod" (
    set "MODE=production"
) else (
    echo Usage: start_server.bat [local^|prod]
    exit /b 1
)

if not exist ".env.%MODE%" (
    echo Missing .env.%MODE%
    exit /b 1
)

if not exist "node_modules" (
    echo node_modules not found - installing dependencies...
    call npm install
    if errorlevel 1 exit /b 1
)

if /i "%TARGET%"=="prod" (
    echo.
    echo  NOTE: this front end will talk to the LIVE backend ^(be.aravindpillai.com^).
)

echo.
echo Starting front end: %TARGET% ^(vite --mode %MODE%^) on http://localhost:3000
call npx vite --mode %MODE%

endlocal
