# build-zip.ps1
# Bygger Hotprevue som en bærbar zip-distribusjon.
# Krever: node + npm i PATH (for frontend-bygg)
#
# Bruk:
#   powershell -ExecutionPolicy Bypass -File "\\wsl$\Ubuntu-22.04\home\kjell\hotprevue\build-zip.ps1"

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$Version     = "0.1.0"
$ZipName     = "Hotprevue-$Version.zip"
$BuildDir    = "C:\hotprevue-zip"
$OutputZip   = Join-Path $ProjectRoot $ZipName

Write-Host ""
Write-Host "=== Hotprevue Zip Build ===" -ForegroundColor Cyan
Write-Host "Prosjektrot : $ProjectRoot"
Write-Host "Output      : $OutputZip"
Write-Host ""

# ─── Steg 1: Sjekk ferdigbygd frontend ──────────────────────────────────────

$FrontendDist = Join-Path $ProjectRoot "frontend\dist"
if (-not (Test-Path $FrontendDist)) {
    Write-Host "FEIL: frontend/dist mangler." -ForegroundColor Red
    Write-Host "Kjor foerst fra WSL:  make build-web" -ForegroundColor Yellow
    exit 1
}
Write-Host "[1/3] Frontend funnet: $FrontendDist" -ForegroundColor Green
Write-Host ""

# ─── Steg 2: Klargjor innhold ────────────────────────────────────────────────

Write-Host "[2/3] Klargjor zip-innhold..." -ForegroundColor Yellow
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Force $BuildDir | Out-Null

# Backend-kildekode (uten virtuelle miljoer, byggartefakter og dev-filer)
robocopy "$ProjectRoot\backend" "$BuildDir\backend" /e `
    /xd .venv .venv-win dist build __pycache__ .pytest_cache tests | Out-Null

# Fjern filer som ikke trengs i distribusjon
Remove-Item -Force "$BuildDir\backend\.dockerignore" -ErrorAction SilentlyContinue
Remove-Item -Force "$BuildDir\backend\Dockerfile" -ErrorAction SilentlyContinue
Remove-Item -Force "$BuildDir\backend\hotprevue.spec" -ErrorAction SilentlyContinue
Remove-Item -Force "$BuildDir\backend\.env" -ErrorAction SilentlyContinue

# Ferdigbygd frontend (fra dist/)
robocopy "$ProjectRoot\frontend\dist" "$BuildDir\frontend" /e | Out-Null

# Startskript
Copy-Item "$ProjectRoot\Hotprevue.bat" "$BuildDir\Hotprevue.bat"

# uv.exe (finn i PATH)
$uvCmd = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uvCmd) { throw "uv ikke funnet i PATH. Installer uv og prøv igjen." }
Copy-Item $uvCmd.Source "$BuildDir\uv.exe"

Write-Host "[2/3] Innhold klart." -ForegroundColor Green
Write-Host ""

# ─── Steg 3: Pakk zip ────────────────────────────────────────────────────────

Write-Host "[3/3] Pakker zip..." -ForegroundColor Yellow
if (Test-Path $OutputZip) { Remove-Item $OutputZip }
Compress-Archive -Path "$BuildDir\*" -DestinationPath $OutputZip
Write-Host "[3/3] Zip ferdig." -ForegroundColor Green

# ─── Ferdig ──────────────────────────────────────────────────────────────────

$SizeMB = [math]::Round((Get-Item $OutputZip).Length / 1MB, 1)
Write-Host ""
Write-Host "=== Ferdig! ===" -ForegroundColor Green
Write-Host "Fil  : $OutputZip" -ForegroundColor Cyan
Write-Host "Strl : $SizeMB MB"
Write-Host ""
