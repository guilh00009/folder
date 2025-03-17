@echo off
echo Starting React app and Cloudflare Tunnel...

start cmd /k "npm start"

echo Waiting for React app to start...
timeout /t 10 /nobreak

echo Creating public link with Cloudflare Tunnel...
cloudflared tunnel --url http://localhost:3000 