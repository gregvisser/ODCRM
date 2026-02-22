# Search for concatenated import corruption (e.g. } from 'react'import {)
# Run when rg is not available. Exit 0 = no corruption found, 1 = matches found.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/search-concatenated-imports.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'src'
if (-not (Test-Path $src)) { Write-Error "src not found: $src"; exit 2 }

# Pattern: closing quote of module path immediately followed by "import" (no newline)
# Matches: from 'react'import {  or  } from "../platform"import {
$patterns = @(
    "react'import",
    "platform'import",
    "icons'import",
    "Context'import",
    "Response'import",
    "}'import",
    ")import"
)
$files = Get-ChildItem -Recurse -Include *.ts,*.tsx -Path $src -File
$matches = @()
foreach ($f in $files) {
    $content = Get-Content -LiteralPath $f.FullName -Raw
    if (-not $content) { continue }
    foreach ($p in $patterns) {
        if ($content -match [regex]::Escape($p)) {
            $matches += "$($f.FullName): $p"
        }
    }
}
# Check for: closing quote then "import " (no newline between path and import)
foreach ($f in $files) {
    $lines = Get-Content -LiteralPath $f.FullName
    $n = 0
    foreach ($line in $lines) {
        $n++
        if ($line -match "from\s+['`"][^'`"]+['`"]import\s") {
            $matches += "$($f.FullName):$n : from '...'import"
        }
    }
}
if ($matches.Count -gt 0) {
    Write-Host "CONCATENATED IMPORT CANDIDATES (fix these):"
    $matches | ForEach-Object { Write-Host $_ }
    exit 1
}
Write-Host "OK: no concatenated-import patterns found in src/"
exit 0
