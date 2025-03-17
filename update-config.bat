@echo off
echo Update Configuration with Backend URL
echo ===================================
echo.

if "%~1"=="" (
  echo ERROR: Please provide the backend URL as a parameter.
  echo.
  echo Usage: update-config.bat https://your-backend-url.trycloudflare.com
  echo.
  echo Example: update-config.bat https://some-random-name.trycloudflare.com
  exit /b 1
)

echo Updating configuration with backend URL: %1
echo.

node update-public-urls.js %1

echo.
echo Configuration updated. You can now start your React app with: npm start
echo. 