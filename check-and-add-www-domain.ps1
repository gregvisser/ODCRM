# Script to check DNS propagation and add www.odcrm.bidlow.co.uk to Azure
# Run this script periodically to check if DNS has propagated

Write-Host "Checking DNS propagation for www.odcrm.bidlow.co.uk..." -ForegroundColor Cyan

# Check DNS using Google's DNS server
$dnsResult = nslookup www.odcrm.bidlow.co.uk 8.8.8.8 2>&1 | Out-String

if ($dnsResult -match "happy-sand-0fc981903\.2\.azurestaticapps\.net") {
    Write-Host "✅ DNS has propagated successfully!" -ForegroundColor Green
    Write-Host "Adding custom domain to Azure Static Web App..." -ForegroundColor Cyan
    
    az staticwebapp hostname set --name odcrm-frontend --hostname www.odcrm.bidlow.co.uk
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SUCCESS! www.odcrm.bidlow.co.uk has been added to Azure!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now access your site at:" -ForegroundColor Green
        Write-Host "  - https://odcrm.bidlow.co.uk" -ForegroundColor Yellow
        Write-Host "  - https://www.odcrm.bidlow.co.uk" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed to add domain to Azure. Please try again manually." -ForegroundColor Red
    }
} else {
    Write-Host "⏳ DNS has not propagated yet." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Current DNS status:" -ForegroundColor White
    Write-Host $dnsResult
    Write-Host ""
    Write-Host "Please wait a few more minutes and run this script again." -ForegroundColor Yellow
    Write-Host "DNS propagation can take 15-60 minutes." -ForegroundColor Gray
}
