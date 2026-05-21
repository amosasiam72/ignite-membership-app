Write-Host "Creating admin user..."

$apiKey = "AIzaSyB3t8hT8mnXh8bqw5QsO1rYDaO3-MfX8fE"
$body = @"
{
  "email": "admin@ignitechapel.com",
  "password": "IgniteAdmin2026!",
  "returnSecureToken": true
}
"@

try {
    $response = Invoke-RestMethod -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$apiKey" -Method POST -ContentType "application/json" -Body $body
    Write-Host ""
    Write-Host "Admin user created!" -ForegroundColor Green
    Write-Host "Email: admin@ignitechapel.com" -ForegroundColor Green
    Write-Host "Password: IgniteAdmin2026!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now log in at http://localhost:3000" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "Failed: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure Email/Password auth is enabled in Firebase Console:" -ForegroundColor Yellow
    Write-Host "https://console.firebase.google.com/project/ignite-chapel-membership-app/authentication/providers" -ForegroundColor Yellow
}
