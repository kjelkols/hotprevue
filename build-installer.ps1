# build-installer.ps1
# Kjoeres fra Windows PowerShell.
# Bygger backend-binaer med PyInstaller og pakker Electron-installer med NSIS.
#
# Bruk:
#   powershell -ExecutionPolicy Bypass -File "\\wsl$\Ubuntu-22.04\home\kjell\hotprevue\build-installer.ps1"

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$BuildDir    = "C:\hotprevue-build"

Write-Host ""
Write-Host "=== Hotprevue Installer Build ===" -ForegroundColor Cyan
Write-Host "Prosjektrot : $ProjectRoot"
Write-Host "Byggkatalog : $BuildDir"
Write-Host ""

# ─── Steg 1: Bygg backend-binaer ─────────────────────────────────────────────

Write-Host "[1/3] Bygger backend (PyInstaller)..." -ForegroundColor Yellow
Push-Location $BackendDir
try {
    $env:UV_PROJECT_ENVIRONMENT = ".venv-win"
    uv run --python 3.12 --with pyinstaller pyinstaller hotprevue.spec
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller feilet (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}
Write-Host "[1/3] Backend-binaer ferdig." -ForegroundColor Green
Write-Host ""

# ─── Steg 2: Klargjor byggkatalog ────────────────────────────────────────────

Write-Host "[2/3] Klargjor byggkatalog..." -ForegroundColor Yellow
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Force "$BuildDir\frontend" | Out-Null
New-Item -ItemType Directory -Force "$BuildDir\backend"  | Out-Null

# Kopier frontend uten node_modules og byggartefakter
robocopy "$FrontendDir" "$BuildDir\frontend" /e /xd node_modules dist out dist-installer | Out-Null

# Kopier PyInstaller-output
robocopy "$BackendDir\dist" "$BuildDir\backend\dist" /e | Out-Null

Write-Host "[2/3] Kopiering ferdig." -ForegroundColor Green
Write-Host ""

# ─── Steg 3: Bygg Electron-installer ─────────────────────────────────────────

Write-Host "[3/3] Bygger Electron-installer..." -ForegroundColor Yellow
Push-Location "$BuildDir\frontend"
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install feilet (exit $LASTEXITCODE)" }
    npm run dist
    if ($LASTEXITCODE -ne 0) { throw "npm run dist feilet (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

# ─── Ferdig ───────────────────────────────────────────────────────────────────

Write-Host ""
$InstallerDir = "$BuildDir\frontend\dist-installer"
$Installer = Get-ChildItem $InstallerDir -Filter "*.exe" `
    | Where-Object { $_.Name -notlike "*uninstaller*" } `
    | Select-Object -First 1

if ($Installer) {
    Write-Host "=== Ferdig! ===" -ForegroundColor Green
    Write-Host "Installer : $($Installer.FullName)" -ForegroundColor Cyan
} else {
    Write-Host "Advarsel: Fant ikke installer i $InstallerDir" -ForegroundColor Red
}
Write-Host ""
