#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Build the PyInstaller --onedir Roll Call backend on Windows.

.DESCRIPTION
  Windows mirror of scripts/build_binary.sh. Always re-builds the frontend
  so the bundled dist/ matches the current source.

  Build Python selection (highest priority first):
    1. $env:PYTHON_BIN -- explicit override (e.g.
       $env:PYTHON_BIN = 'C:\Python312\python.exe'). The selected Python
       MUST already have PyInstaller installed; the script fails loudly
       rather than silently falling back.
    2. backend\.venv-build\Scripts\python.exe -- auto-created on first run
       with only the packages in backend\requirements.txt + pyinstaller.
       Keeps the bundle small and reproducible.

  Output:
    backend\dist\roll_call_backend\roll_call_backend.exe

  To rebuild the clean venv from scratch (e.g. after requirements.txt
  changes):
    Remove-Item -Recurse -Force backend\.venv-build
    .\scripts\build_binary.ps1

.NOTES
  Requires Windows 10+ with Python 3.12+ from python.org (provides the `py`
  launcher) and Node.js 24+. Does NOT cross-compile from macOS / Linux --
  PyInstaller is build-where-you-run.
#>

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
Set-Location $RepoRoot

$CleanVenv = Join-Path $RepoRoot "backend\.venv-build"
$VenvPython = Join-Path $CleanVenv "Scripts\python.exe"

function Log {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message"
}

# ---------- Select build Python ----------
if ($env:PYTHON_BIN) {
  $PY = $env:PYTHON_BIN
  Log "Using PYTHON_BIN override: $PY"
  & $PY --version 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Error "PYTHON_BIN=$PY is not executable or not a valid Python."
    exit 1
  }
  & $PY -m PyInstaller --version 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: PyInstaller not installed in $PY." -ForegroundColor Red
    Write-Host "Install it there first, e.g.:" -ForegroundColor Red
    Write-Host "  $PY -m pip install pyinstaller" -ForegroundColor Red
    exit 1
  }
} else {
  if (-not (Test-Path $CleanVenv)) {
    Log "Bootstrapping clean build venv at $CleanVenv..."

    # Detect a Python 3 launcher.
    if (Get-Command "py" -ErrorAction SilentlyContinue) {
      $BootCmd = "py"
      $BootArgs = @("-3")
    } elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
      $BootCmd = "python"
      $BootArgs = @()
    } elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
      $BootCmd = "python3"
      $BootArgs = @()
    } else {
      Write-Error "Python 3.12+ not found. Install Python 3.12+ from python.org."
      exit 1
    }

    & $BootCmd @BootArgs -m venv $CleanVenv
    if ($LASTEXITCODE -ne 0) { exit 1 }

    & $VenvPython -m pip install --quiet --upgrade pip
    if ($LASTEXITCODE -ne 0) { exit 1 }
    & $VenvPython -m pip install --quiet -r (Join-Path $RepoRoot "backend\requirements.txt")
    if ($LASTEXITCODE -ne 0) { exit 1 }
    & $VenvPython -m pip install --quiet pyinstaller
    if ($LASTEXITCODE -ne 0) { exit 1 }
  }
  $PY = $VenvPython
  Log "Using clean build venv: $PY"
}

& $PY --version
& $PY -m PyInstaller --version

# ---------- Frontend build ----------
Log "Checking npm..."
if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
  Write-Error "npm not found. Install Node.js 24+ from nodejs.org."
  exit 1
}

$FrontendDir = Join-Path $RepoRoot "frontend"
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
  Log "Installing frontend dependencies..."
  & npm install --prefix $FrontendDir
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

Log "Building frontend..."
& npm run build --prefix $FrontendDir
if ($LASTEXITCODE -ne 0) { exit 1 }

# ---------- Backend binary ----------
Log "Building backend binary (PyInstaller --onedir)..."
Push-Location (Join-Path $RepoRoot "backend")
try {
  & $PY -m PyInstaller "pyinstaller.spec" --clean --noconfirm
  if ($LASTEXITCODE -ne 0) { exit 1 }
} finally {
  Pop-Location
}

$Binary = Join-Path $RepoRoot "backend\dist\roll_call_backend\roll_call_backend.exe"
if (Test-Path $Binary) {
  Log "Binary ready:"
  Write-Host "  $Binary"
  Write-Host ""
  Write-Host "Run with:"
  Write-Host "  .\backend\dist\roll_call_backend\roll_call_backend.exe"
  Write-Host ""
  Write-Host "Or with a custom port (PowerShell):"
  Write-Host "  `$env:ROLL_CALL_PORT='8001'; .\backend\dist\roll_call_backend\roll_call_backend.exe"
} else {
  Write-Error "expected binary missing at $Binary"
  exit 1
}
