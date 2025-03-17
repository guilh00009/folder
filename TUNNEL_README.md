# Public Links for Voice Assistant App

This guide explains how to create public links for both your Voice Assistant app frontend and backend server using Cloudflare Tunnel.

## Prerequisites

1. Install Cloudflare Tunnel CLI:
   ```
   npm install -g cloudflared
   ```

## Step 1: Create Public URLs

### Option 1: Using the Batch Script (Windows)

1. Run the batch file:
   ```
   .\start-with-tunnels.bat
   ```

2. The script will:
   - Start your React app
   - Start your backend server
   - Create public links for both using Cloudflare Tunnel
   - Open separate console windows for each service

3. Look for URLs like `https://something-random.trycloudflare.com` in the console outputs.
   - Note the URL for your backend server (the one running on port 3001)

### Option 2: Using the PowerShell Script (Windows)

1. Run the PowerShell script:
   ```
   .\start-with-tunnels.ps1
   ```

2. The script will:
   - Start your React app
   - Start your backend server
   - Create public links for both using Cloudflare Tunnel
   - Open separate console windows for each service

3. Look for URLs like `https://something-random.trycloudflare.com` in the console outputs.
   - Note the URL for your backend server (the one running on port 3001)

### Option 3: Manual Setup

1. Start your React app:
   ```
   npm start
   ```

2. Start your backend server:
   ```
   cd server && npm start
   ```

3. In separate terminals, create tunnels for each:
   ```
   # For backend server
   cloudflared tunnel --url http://localhost:3001
   
   # For frontend app
   cloudflared tunnel --url http://localhost:3000
   ```

## Step 2: Update Configuration with Backend URL

After you have your public URLs, you need to update the app configuration to use the backend URL:

1. Run the update script with your backend URL:
   ```
   node update-public-urls.js https://your-backend-url.trycloudflare.com
   ```

2. This will update the `src/config.js` file with your backend URL.

3. Restart your React app if it's already running.

## Step 3: Access Your App

1. Open the frontend URL in your browser (the one for port 3000)
2. Your app should now be working with the public backend URL
3. You can share this URL with others to access your app from any device

## Notes

- The public URLs are temporary and will change each time you restart the tunnels
- The connections are secure (HTTPS)
- No account or login is required
- Works on mobile devices including iOS
- The tunnels will close when you close the terminal windows

## Troubleshooting

- If you get a "command not found" error, make sure cloudflared is installed globally
- If the tunnels fail to connect, make sure your services are running on the correct ports
- If the app can't connect to the backend, check that you've updated the config with the correct URL
- If you're getting CORS errors, make sure your backend server allows requests from your frontend URL 