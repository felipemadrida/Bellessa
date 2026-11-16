param(
    [string]$OutDir = "backups"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$target = Join-Path $root $OutDir
New-Item -ItemType Directory -Force -Path $target | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (Get-Command docker -ErrorAction SilentlyContinue) {
    $file = Join-Path $target "bellessa-$stamp.sql"
    Write-Host "Respaldando PostgreSQL desde docker compose…"
    & docker compose exec -T db pg_dump -U bellessa -d bellessa --clean --if-exists |
        Out-File -Encoding utf8 $file
    if ($LASTEXITCODE -ne 0) {
        Remove-Item -LiteralPath $file -ErrorAction SilentlyContinue
        throw "pg_dump falló. Revisa que el contenedor db esté corriendo."
    }
    Write-Host "Respaldo listo: $file"
    exit 0
}

$sqlite = Join-Path $root "backend\bellessa.db"
if (Test-Path -LiteralPath $sqlite) {
    $file = Join-Path $target "bellessa-$stamp.db"
    Copy-Item -LiteralPath $sqlite -Destination $file
    Write-Host "Respaldo SQLite listo: $file"
    exit 0
}

throw "No encontré Docker ni backend\bellessa.db. Define cómo respaldar tu base."
