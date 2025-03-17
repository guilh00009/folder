@echo off
echo Starting React app, backend server, and Cloudflare Tunnels...

REM Start React app
start cmd /k "npm start"

REM Start backend server
start cmd /k "cd server && npm start"

echo Waiting for services to start...
timeout /t 10 /nobreak

REM Create tunnel for backend server
start cmd /k "echo Creating public link for backend server... && C:\Users\kelle\AppData\Roaming\npm\cloudflared.cmd tunnel --url http://localhost:3001 && pause"

echo Waiting for backend tunnel to initialize...
timeout /t 5 /nobreak

REM Create tunnel for frontend app
echo Creating public link for frontend app...
C:\Users\kelle\AppData\Roaming\npm\cloudflared.cmd tunnel --url http://localhost:3000

echo Both tunnels are now running. Check the console windows for the URLs. 