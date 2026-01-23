# Add GOOGLE_GEMINI_API_KEY to Render via API
# Service ID: srv-d5ldkn4mrvns73edi4rg

param(
    [Parameter(Mandatory=$true)]
    [string]$RenderApiToken
)

$serviceId = "srv-d5ldkn4mrvns73edi4rg"
$key = "GOOGLE_GEMINI_API_KEY"
$value = "AIzaSyDHGQxTnemCQ2yRYx6r0ogXGgo4KPfWQfI"

$headers = @{
    "Authorization" = "Bearer $RenderApiToken"
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

$body = @{
    key = $key
    value = $value
} | ConvertTo-Json -Compress

Write-Host "Adding $key to Render service $serviceId..."

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.render.com/v1/services/$serviceId/env-vars" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "✅ Successfully added $key to Render!" -ForegroundColor Green
    Write-Host "Render will automatically redeploy with the new environment variable."
    return 0
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody = $_.ErrorDetails.Message
    
    Write-Host "❌ Error adding environment variable:" -ForegroundColor Red
    Write-Host "Status: $statusCode"
    Write-Host "Error: $errorBody"
    
    if ($statusCode -eq 401) {
        Write-Host ""
        Write-Host "Authentication failed. Please check your Render API token." -ForegroundColor Yellow
    } elseif ($statusCode -eq 404) {
        Write-Host ""
        Write-Host "Service not found. Please verify the service ID: $serviceId" -ForegroundColor Yellow
    }
    
    return 1
}
