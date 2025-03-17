@echo off
echo Starting Cloudflare Tunnel for backend server...
echo This will create a public URL for your local server running on port 3001
echo.
echo Press Ctrl+C to stop the tunnel when you're done
echo.

C:\Users\kelle\AppData\Roaming\npm\cloudflared.cmd tunnel --url http://localhost:3001

echo Tunnel stopped. 