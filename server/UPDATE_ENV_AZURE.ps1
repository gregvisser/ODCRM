# Script to update .env with Azure credentials
# Run this after you get your Client ID and Client Secret from Azure

Write-Host "Azure Credentials Update" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$clientId = Read-Host "Enter your Azure Client ID (Application ID)"
$clientSecret = Read-Host "Enter your Azure Client Secret (Value, not Secret ID)" -AsSecureString
$clientSecretPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($clientSecret)
)

if ([string]::IsNullOrWhiteSpace($clientId) -or [string]::IsNullOrWhiteSpace($clientSecretPlain)) {
    Write-Host "Error: Client ID and Client Secret are required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Updating .env file..." -ForegroundColor Yellow

$envPath = ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envPath -Raw

# Update Client ID
$envContent = $envContent -replace 'MICROSOFT_CLIENT_ID=.*', "MICROSOFT_CLIENT_ID=$clientId"

# Update Client Secret
$envContent = $envContent -replace 'MICROSOFT_CLIENT_SECRET=.*', "MICROSOFT_CLIENT_SECRET=$clientSecretPlain"

# Ensure other values are set
if ($envContent -notmatch 'MICROSOFT_TENANT_ID=') {
    $envContent = $envContent + "`nMICROSOFT_TENANT_ID=common"
}
if ($envContent -notmatch 'REDIRECT_URI=') {
    $envContent = $envContent + "`nREDIRECT_URI=http://localhost:3001/api/outlook/callback"
}

$envContent | Out-File -FilePath $envPath -Encoding UTF8 -NoNewline

Write-Host "✅ .env file updated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Updated values:" -ForegroundColor Cyan
Write-Host "  MICROSOFT_CLIENT_ID=$clientId" -ForegroundColor White
Write-Host "  MICROSOFT_CLIENT_SECRET=**** (hidden)" -ForegroundColor White
Write-Host ""
Write-Host "Next: Start your server and test OAuth flow!" -ForegroundColor Yellow
