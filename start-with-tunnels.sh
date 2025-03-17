#!/bin/bash
echo "Starting React app, backend server, and Cloudflare Tunnels..."

# Start React app in a new terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && npm start"'
else
  # Linux
  gnome-terminal -- bash -c "cd \"$PWD\" && npm start; exec bash" || \
  xterm -e "cd \"$PWD\" && npm start" || \
  x-terminal-emulator -e "cd \"$PWD\" && npm start" || \
  echo "Could not open a new terminal for React app, please start it manually"
fi

# Start backend server in a new terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'/server\" && npm start"'
else
  # Linux
  gnome-terminal -- bash -c "cd \"$PWD/server\" && npm start; exec bash" || \
  xterm -e "cd \"$PWD/server\" && npm start" || \
  x-terminal-emulator -e "cd \"$PWD/server\" && npm start" || \
  echo "Could not open a new terminal for backend server, please start it manually"
fi

echo "Waiting for services to start..."
sleep 10

# Create tunnel for backend server in a new terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && echo \"Creating public link for backend server...\" && cloudflared tunnel --url http://localhost:3001"'
else
  # Linux
  gnome-terminal -- bash -c "cd \"$PWD\" && echo \"Creating public link for backend server...\" && cloudflared tunnel --url http://localhost:3001; exec bash" || \
  xterm -e "cd \"$PWD\" && echo \"Creating public link for backend server...\" && cloudflared tunnel --url http://localhost:3001" || \
  x-terminal-emulator -e "cd \"$PWD\" && echo \"Creating public link for backend server...\" && cloudflared tunnel --url http://localhost:3001" || \
  echo "Could not open a new terminal for backend tunnel, please start it manually"
fi

echo "Waiting for backend tunnel to initialize..."
sleep 5

# Create tunnel for frontend app in the current terminal
echo "Creating public link for frontend app..."
cloudflared tunnel --url http://localhost:3000 