@echo off
REM Bootstrap the source repo and launch the backend production runner on Windows.
REM Mirrors scripts/start.sh. NOTE: not yet validated on a real Windows host.
REM Logic:
REM   1. Ensure backend\.venv exists.
REM   2. Install backend deps from requirements.txt via the venv python.
REM   3. Ensure frontend\node_modules exists.
REM   4. Build frontend on every launch.
REM   5. Run backend\run.py via the venv python.

setlocal

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.." >nul

REM 1. Python
echo.
echo ==^> Checking Python...
where py >nul 2>&1
if not errorlevel 1 (
  set "PYBOOT=py -3"
) else (
  where python >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Python 3.12+ not found. Install from python.org.
    popd
    exit /b 1
  )
  set "PYBOOT=python"
)

REM 2. Backend venv
set "VENV=backend\.venv"
set "PY=%VENV%\Scripts\python.exe"
if not exist "%VENV%" (
  echo.
  echo ==^> Creating backend venv at %VENV%...
  %PYBOOT% -m venv "%VENV%" || (popd & exit /b 1)
  "%PY%" -m pip install --quiet --upgrade pip
)

REM 3. Backend dependencies
echo.
echo ==^> Installing backend dependencies...
"%PY%" -m pip install --quiet -r backend\requirements.txt || (popd & exit /b 1)

REM 4. npm
echo.
echo ==^> Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found. Install Node.js 24+ from nodejs.org.
  popd
  exit /b 1
)

REM 5. Frontend dependencies (only when node_modules is missing).
if not exist "frontend\node_modules" (
  echo.
  echo ==^> Installing frontend dependencies...
  call npm install --prefix frontend || (popd & exit /b 1)
) else (
  echo.
  echo ==^> Frontend node_modules present; skipping npm install.
)

REM 6. Build frontend every launch.
echo.
echo ==^> Building frontend...
call npm run build --prefix frontend || (popd & exit /b 1)

REM 7. Launch backend production runner.
if "%ROLL_CALL_PORT%"=="" set "ROLL_CALL_PORT=8000"
echo.
echo ==^> Starting Roll Call backend on http://127.0.0.1:%ROLL_CALL_PORT%
echo Open the URL above in your browser. Press Ctrl+C to stop.
echo.
"%PY%" backend\run.py
set "EXITCODE=%ERRORLEVEL%"
popd
endlocal & exit /b %EXITCODE%
