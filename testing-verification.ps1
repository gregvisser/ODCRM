# Testing and Verification Script
# Run these commands to test your Azure migration

Write-Host "=== ODCRM Azure Migration Testing ==="

# Test 1: Check Azure resources
Write-Host "`n1. Checking Azure resources..."
az webapp list --resource-group odcrm-rg --query "[].{Name:name, State:state, URL:defaultHostName}" -o table
az postgres flexible-server list --resource-group odcrm-rg --query "[].{Name:name, State:state}" -o table
az staticwebapp list --resource-group odcrm-rg --query "[].{Name:name, URL:defaultHostname}" -o table

# Test 2: Check DNS propagation
Write-Host "`n2. Testing DNS resolution..."
try {
    $dnsResult = Resolve-DnsName "odcrm.bidlow.co.uk" -ErrorAction Stop
    Write-Host "DNS Resolution: SUCCESS" -ForegroundColor Green
    Write-Host "IP Address: $($dnsResult.IPAddress)"
} catch {
    Write-Host "DNS Resolution: FAILED - Wait for propagation" -ForegroundColor Red
}

# Test 3: Test frontend access
Write-Host "`n3. Testing frontend access..."
try {
    $response = Invoke-WebRequest -Uri "https://odcrm.bidlow.co.uk" -TimeoutSec 30
    if ($response.StatusCode -eq 200) {
        Write-Host "Frontend Access: SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "Frontend Access: FAILED (Status: $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "Frontend Access: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Test API access
Write-Host "`n4. Testing API access..."
try {
    $response = Invoke-WebRequest -Uri "https://odcrm-api.azurewebsites.net/health" -TimeoutSec 30
    if ($response.StatusCode -eq 200) {
        Write-Host "API Access: SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "API Access: FAILED (Status: $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "API Access: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Check GitHub Actions
Write-Host "`n5. Checking GitHub Actions status..."
Write-Host "Go to: https://github.com/yourusername/odcrm/actions"
Write-Host "Verify workflows are ready and secrets are configured"

Write-Host "`n=== Testing Complete ==="
Write-Host "If all tests pass, your migration is successful!"
Write-Host "Next steps:"
Write-Host "1. Test full application functionality"
Write-Host "2. Update DNS records to point to Azure"
Write-Host "3. Decommission old services (Vercel, Render, Neon)"
Write-Host "4. Monitor for 7 days"