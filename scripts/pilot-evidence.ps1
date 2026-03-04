# Pilot Release evidence script: parity + smoke, then PASS/FAIL summary.
# Non-invasive; uses existing prod-check.cjs and npm run test:pilot-release-smoke only.
# Run from repo root (e.g. npm run pilot:evidence).

$ErrorActionPreference = "Stop"
$repoRoot = if ($PSScriptRoot) { (Resolve-Path (Join-Path $PSScriptRoot "..")).Path } else { Get-Location }
Set-Location $repoRoot

Write-Host "=== Pilot evidence (parity + smoke) ===" -ForegroundColor Cyan
Write-Host ""

# 1. origin/main SHA
& git fetch origin 2>&1 | Out-Null
$expectedSha = & git rev-parse origin/main 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: could not get origin/main SHA" -ForegroundColor Red
    exit 1
}
Write-Host "origin/main SHA: $expectedSha"
Write-Host ""

# 2. Prod parity polling
$env:EXPECT_SHA = $expectedSha
$parityOk = $false
for ($i = 1; $i -le 40; $i++) {
    Write-Host "Parity poll $i/40..."
    & node scripts/prod-check.cjs 2>&1
    if ($LASTEXITCODE -eq 0) {
        $parityOk = $true
        break
    }
    if ($i -lt 40) { Start-Sleep -Seconds 30 }
}
if (-not $parityOk) {
    Write-Host ""
    Write-Host "FAIL: prod parity did not pass within polling window" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Pilot smoke
Write-Host "Running npm run test:pilot-release-smoke..."
& npm run test:pilot-release-smoke 2>&1
$smokeOk = ($LASTEXITCODE -eq 0)
Write-Host ""

# 4. Summary
if ($parityOk -and $smokeOk) {
    Write-Host "=== PASS: parity + smoke OK ===" -ForegroundColor Green
    exit 0
} else {
    Write-Host "=== FAIL: parity=$parityOk smoke=$smokeOk ===" -ForegroundColor Red
    exit 1
}
