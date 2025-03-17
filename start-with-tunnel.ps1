Write-Host "Starting React app and Cloudflare Tunnel..." -ForegroundColor Green

# Start React app in a new window
Start-Process powershell -ArgumentList "npm start"

Write-Host "Waiting for React app to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Creating public link with Cloudflare Tunnel..." -ForegroundColor Cyan
cloudflared tunnel --url http://localhost:3000 