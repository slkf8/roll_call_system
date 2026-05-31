#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Package the already-built PyInstaller bundle into a portable Windows folder.

.DESCRIPTION
  Windows mirror of scripts/package_release.sh.

  Output:
    release\RollCall_Portable_Windows\
      啟動 RollCall.bat       (Explorer 雙擊入口；UTF-8 中文檔名)
      README.txt              (繁中說明)
      roll_call_backend\      (PyInstaller bundle 整個複製)
        roll_call_backend.exe
        _internal\
        data\                 (空；首次啟動自動建 app.db)

  Prerequisite:
    scripts\build_binary.ps1 must have produced
      backend\dist\roll_call_backend\roll_call_backend.exe
  The script fails fast if the binary is missing -- it never invokes
  PyInstaller itself.

.PARAMETER Zip
  Also create release\RollCall_Portable_Windows.zip via Compress-Archive.

.EXAMPLE
  .\scripts\package_release.ps1
  .\scripts\package_release.ps1 -Zip

.NOTES
  Strips any seeded app.db / journal / WAL / SHM from the copied bundle so
  the release ships in a clean state. Generated .bat and .txt files are
  written as UTF-8 WITHOUT BOM -- a UTF-8 BOM on a .bat file makes cmd see
  garbage bytes before @echo off and fail.
#>

[CmdletBinding()]
param(
  [switch]$Zip
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
Set-Location $RepoRoot

$BundleSrc = Join-Path $RepoRoot "backend\dist\roll_call_backend"
$BinarySrc = Join-Path $BundleSrc "roll_call_backend.exe"
$ReleaseRoot = Join-Path $RepoRoot "release"
$ReleaseName = "RollCall_Portable_Windows"
$ReleaseDir = Join-Path $ReleaseRoot $ReleaseName

function Log {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message"
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  # Use the .NET API directly so we get consistent UTF-8 no-BOM behavior
  # across PowerShell 5.1 (Windows default) and PowerShell 7+. The
  # built-in Out-File / Set-Content -Encoding utf8 semantics differ
  # between versions (5.1 writes BOM, 7+ does not).
  [System.IO.File]::WriteAllText(
    $Path,
    $Content,
    [System.Text.UTF8Encoding]::new($false)
  )
}

# ---------- Preflight ----------
if (-not (Test-Path $BinarySrc)) {
  Write-Host "ERROR: PyInstaller binary not found at:" -ForegroundColor Red
  Write-Host "  $BinarySrc" -ForegroundColor Red
  Write-Host "Run .\scripts\build_binary.ps1 first." -ForegroundColor Red
  exit 1
}

# ---------- (Re)create release folder ----------
Log "Preparing release folder: $ReleaseDir"
if (-not (Test-Path $ReleaseRoot)) {
  New-Item -ItemType Directory -Path $ReleaseRoot | Out-Null
}
if (Test-Path $ReleaseDir) {
  Remove-Item -Recurse -Force $ReleaseDir
}
New-Item -ItemType Directory -Path $ReleaseDir | Out-Null

# ---------- Copy bundle ----------
Log "Copying PyInstaller bundle..."
Copy-Item -Recurse $BundleSrc (Join-Path $ReleaseDir "roll_call_backend")

# Strip any seeded DB. The source bundle may contain a development /
# acceptance DB from prior runs; the release ships clean so end users see
# an empty system on first launch. Keep the data\ directory so first
# launch only has to write app.db, not also mkdir.
$DestDataDir = Join-Path $ReleaseDir "roll_call_backend\data"
if (-not (Test-Path $DestDataDir)) {
  New-Item -ItemType Directory -Path $DestDataDir | Out-Null
}
$RemovedAny = $false
foreach ($f in @("app.db", "app.db-journal", "app.db-wal", "app.db-shm")) {
  $Candidate = Join-Path $DestDataDir $f
  if (Test-Path $Candidate) {
    Remove-Item -Force $Candidate
    $RemovedAny = $true
  }
}
if ($RemovedAny) {
  Write-Host "  (removed seeded DB artifacts; release is clean)"
}

# ---------- Generate launcher (.bat) ----------
Log "Generating launcher..."
$LauncherPath = Join-Path $ReleaseDir "啟動 RollCall.bat"
# Single-quoted here-string: $ / % stay literal so they reach cmd verbatim.
$LauncherContent = @'
@echo off
chcp 65001 >nul
REM 出席點名系統 — Portable Launcher (Windows)
REM 雙擊本檔即可啟動，按 Ctrl+C 停止。
REM Honors ROLL_CALL_PORT (default 8000). 用法：
REM   set ROLL_CALL_PORT=8001
REM   啟動 RollCall.bat

setlocal

REM 1. 切到自身所在資料夾（雙擊時 cwd 不確定）。
cd /d "%~dp0"

if "%ROLL_CALL_PORT%"=="" set "ROLL_CALL_PORT=8000"
set "URL=http://127.0.0.1:%ROLL_CALL_PORT%/"

echo.
echo ================================================
echo  出席點名系統 — Portable
echo ------------------------------------------------
echo  網址：%URL%
echo  停止：按 Ctrl+C
echo ================================================
echo.

REM 2. 背景輪詢 /health；OK 後再開瀏覽器（無固定 sleep）。
REM    PowerShell 子行程；最多 60 x 500ms ~= 30 秒，逾時放棄。
REM    內部全部用單引號，避免 cmd 與 powershell 雙重引號解析衝突。
start "" /B powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=$env:ROLL_CALL_PORT; if(-not $p){$p='8000'}; for($i=0;$i -lt 60;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 ('http://127.0.0.1:'+$p+'/health'); if($r.StatusCode -eq 200){ Start-Process ('http://127.0.0.1:'+$p+'/'); exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }"

REM 3. 前景執行 exe（Ctrl+C 直達 uvicorn）。
"roll_call_backend\roll_call_backend.exe"

echo.
echo 程式已結束。按任意鍵關閉視窗…
pause >nul
endlocal
'@
Write-Utf8NoBom -Path $LauncherPath -Content $LauncherContent

# ---------- Generate README.txt ----------
Log "Generating README.txt..."
$ReadmePath = Join-Path $ReleaseDir "README.txt"
$ReadmeContent = @'
出席點名系統 — Portable (Windows)
==================================

這是出席點名系統的可攜帶版本。
整個資料夾就是「程式 + 資料」，搬到哪裡都能用，
不會寫入 Windows 系統的使用者資料夾。

————————————————————————————————————————
一、如何啟動
————————————————————————————————————————
方法 A（推薦）：
  在檔案總管雙擊「啟動 RollCall.bat」。
  cmd 視窗會自動打開，程式開好之後會自動跳出瀏覽器。

方法 B（手動）：
  打開 cmd 或 PowerShell，cd 到本資料夾，執行：
    roll_call_backend\roll_call_backend.exe

————————————————————————————————————————
二、瀏覽器網址
————————————————————————————————————————
  http://127.0.0.1:8000

  若用 ROLL_CALL_PORT=8001 啟動，網址會改成
    http://127.0.0.1:8001
  （啟動視窗最上方會印出實際網址，照貼即可。）

————————————————————————————————————————
三、如何停止
————————————————————————————————————————
  在 cmd 視窗按 Ctrl+C；或直接關閉視窗強制停止。

————————————————————————————————————————
四、資料位置
————————————————————————————————————————
  roll_call_backend\data\app.db

  這個檔案就是你所有的學生 / 排程 / 出席紀錄。
  首次啟動時會自動建立空白資料庫。

————————————————————————————————————————
五、如何備份
————————————————————————————————————————
  - 最簡單：複製整個 RollCall_Portable_Windows 資料夾。
  - 最小：至少備份 roll_call_backend\data\app.db。

————————————————————————————————————————
六、如何搬移 / 換電腦
————————————————————————————————————————
  整個 RollCall_Portable_Windows 資料夾搬到新位置即可，
  資料會跟著資料夾走，不需要任何匯入步驟。

————————————————————————————————————————
七、Port 8000 被佔用怎麼辦
————————————————————————————————————————
  打開 cmd，cd 到本資料夾後執行：
    set ROLL_CALL_PORT=8001
    "啟動 RollCall.bat"
  或：
    set ROLL_CALL_PORT=8001
    roll_call_backend\roll_call_backend.exe

————————————————————————————————————————
八、Windows SmartScreen 提示（重要）
————————————————————————————————————————
  首次雙擊「啟動 RollCall.bat」或 roll_call_backend.exe 時，
  Windows 可能會跳出「Windows 已保護您的電腦」的藍色視窗。

  解法：
    點視窗中的「其他資訊」→ 再點「仍要執行」即可。

  之後就能正常雙擊。
  （本版本尚未進行 Authenticode 簽章。）

————————————————————————————————————————
九、注意事項
————————————————————————————————————————
  - 請勿刪除 roll_call_backend\data\app.db（除非你要清空所有資料）。
  - 本程式不會寫入 %APPDATA%、%LOCALAPPDATA% 或其他系統資料夾。
  - 如要清空全部資料：先備份，再刪掉 data\app.db，
    下次啟動會自動產生空白資料庫。

————————————————————————————————————————
十、疑難排解
————————————————————————————————————————
  - API 文件：http://127.0.0.1:8000/docs
  - 健康檢查：http://127.0.0.1:8000/health
  - 啟動失敗時，請把 cmd 視窗中紅色錯誤訊息整段截圖回報。
'@
Write-Utf8NoBom -Path $ReadmePath -Content $ReadmeContent

# ---------- Summary ----------
Log "Release folder ready:"
Write-Host "  $ReleaseDir"
Write-Host ""
Write-Host "Contents:"
Get-ChildItem $ReleaseDir | Sort-Object Name | ForEach-Object {
  if ($_.PSIsContainer) {
    Write-Host "  $($_.Name)\"
  } else {
    Write-Host "  $($_.Name)"
  }
}
$BackendDir = Join-Path $ReleaseDir "roll_call_backend"
if (Test-Path $BackendDir) {
  Get-ChildItem $BackendDir | Sort-Object Name | ForEach-Object {
    if ($_.PSIsContainer) {
      Write-Host "  roll_call_backend\$($_.Name)\"
    } else {
      Write-Host "  roll_call_backend\$($_.Name)"
    }
  }
}

# ---------- Optional zip ----------
if ($Zip) {
  Log "Creating zip archive..."
  $ZipPath = Join-Path $ReleaseRoot "$ReleaseName.zip"
  if (Test-Path $ZipPath) {
    Remove-Item -Force $ZipPath
  }
  Compress-Archive -Path $ReleaseDir -DestinationPath $ZipPath -Force
  $ZipSizeMB = [Math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
  Write-Host "  $ZipPath (${ZipSizeMB} MB)"
}

Write-Host ""
Write-Host "Done."
