# Local manual QA launcher — does NOT modify application code.
# Loads .env.manual-local so the API uses local MongoDB + Mailpit SMTP.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$EnvFile = Join-Path $Root ".env.manual-local"
if (-not (Test-Path $EnvFile)) {
    Write-Error "Missing .env.manual-local"
}

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    Set-Item -Path ("Env:" + $key) -Value $val
}

Write-Host "Loaded local overrides from .env.manual-local"
Write-Host ("MONGODB_URI=" + $env:MONGODB_URI)
Write-Host ("DB_NAME=" + $env:DB_NAME)
Write-Host ("ENVIRONMENT=" + $env:ENVIRONMENT)
Write-Host ("SMTP_HOST=" + $env:SMTP_HOST)
Write-Host ("LOCAL_DEMO_MODE=" + $env:LOCAL_DEMO_MODE)
$resendSet = [bool]$env:RESEND_API_KEY
Write-Host ("RESEND_API_KEY set? " + $resendSet)
