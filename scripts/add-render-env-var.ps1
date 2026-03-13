# Legacy helper for adding a Render env var without committing a secret.
# Do not place real API keys in this file.

param(
    [string]$RenderApiToken = "",
    [string]$ServiceId = "srv-d5ldkn4mrvns73edi4rg",
    [string]$Key = "GOOGLE_GEMINI_API_KEY",
    [string]$Value = ""
)

if (-not $RenderApiToken -or -not $Value) {
    Write-Host "❌ Render API token required. Please:"
    Write-Host "1. Get your API token from: https://dashboard.render.com/account/api-keys"
    Write-Host "2. Run: .\add-render-env-var.ps1 -RenderApiToken 'your-token' -Value 'your-rotated-key'"
    Write-Host ""
    Write-Host "OR add manually in Render dashboard:"
    Write-Host "   Key: $Key"
    Write-Host "   Value: <rotated-secret>"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $RenderApiToken"
    "Content-Type" = "application/json"
}

$body = @{
    key = $Key
    value = $Value
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId/env-vars" -Method Post -Headers $headers -Body $body
    Write-Host "✅ Successfully added $Key to Render service $ServiceId"
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)"
    Write-Host "Response: $($_.Exception.Response)"
    exit 1
}
