Write-Host "Starting React app, backend server, and Cloudflare Tunnels..." -ForegroundColor Green

# Start React app in a new window
Start-Process powershell -ArgumentList "npm start"

# Start backend server in a new window
Start-Process powershell -ArgumentList "cd server; npm start"

Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Create tunnel for backend server in a new window
$backendTunnelScript = {
    Write-Host "Creating public link for backend server..." -ForegroundColor Cyan
    & "C:\Users\kelle\AppData\Roaming\npm\cloudflared.ps1" tunnel --url http://localhost:3001
}
Start-Process powershell -ArgumentList "-Command", "& {$backendTunnelScript}"

Write-Host "Waiting for backend tunnel to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Create tunnel for frontend app in the current window
Write-Host "Creating public link for frontend app..." -ForegroundColor Cyan
& "C:\Users\kelle\AppData\Roaming\npm\cloudflared.ps1" tunnel --url http://localhost:3000

Write-Host "Both tunnels are now running. Check the console windows for the URLs." -ForegroundColor Green 