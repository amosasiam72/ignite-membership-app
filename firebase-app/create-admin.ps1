Write-Host "Creating admin user..."
Write-Host ""

$apiKey = "AIzaSyB3t8hT8mnXh8bqw5QsO1rYDaO3-MfX8fE"
$email = "admin@ignitechapel.com"
$securePass = Read-Host "Enter admin password for $email" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
$password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

if (-not $password -or $password.Length -lt 6) {
    Write-Host "Password must be at least 6 characters." -ForegroundColor Red
    exit 1
}

$body = @"
{
  "email": "$email",
  "password": "$password",
  "returnSecureToken": true
}
"@

try {
    $response = Invoke-RestMethod -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$apiKey" -Method POST -ContentType "application/json" -Body $body
    Write-Host ""
    Write-Host "Admin user created!" -ForegroundColor Green
    Write-Host "Email: $email" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now log in at http://localhost:3000" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "Failed: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure Email/Password auth is enabled in Firebase Console:" -ForegroundColor Yellow
    Write-Host "https://console.firebase.google.com/project/ignite-chapel-membership-app/authentication/providers" -ForegroundColor Yellow
}
