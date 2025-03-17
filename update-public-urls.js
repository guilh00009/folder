/**
 * Script to update the config.js file with public URLs from Cloudflare Tunnel
 * Run this script with: node update-public-urls.js <backend-url>
 */

const fs = require('fs');
const path = require('path');

// Get the backend URL from command line arguments
const backendUrl = process.argv[2];

if (!backendUrl) {
  console.error('Error: Backend URL is required');
  console.error('Usage: node update-public-urls.js <backend-url>');
  console.error('Example: node update-public-urls.js https://some-random-name.trycloudflare.com');
  process.exit(1);
}

// Validate URL format
if (!backendUrl.startsWith('http')) {
  console.error('Error: Backend URL must start with http:// or https://');
  process.exit(1);
}

// Remove trailing slash if present
const cleanBackendUrl = backendUrl.endsWith('/') 
  ? backendUrl.slice(0, -1) 
  : backendUrl;

// Path to config file
const configPath = path.join(__dirname, 'src', 'config.js');

// Read the current config file
fs.readFile(configPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading config file:', err);
    process.exit(1);
  }

  // Update the SERVER_URL in the config
  const updatedConfig = data.replace(
    /SERVER_URL:.*?,/,
    `SERVER_URL: '${cleanBackendUrl}',`
  );

  // Write the updated config back to the file
  fs.writeFile(configPath, updatedConfig, 'utf8', (err) => {
    if (err) {
      console.error('Error writing config file:', err);
      process.exit(1);
    }

    console.log('✅ Configuration updated successfully!');
    console.log(`Backend URL set to: ${cleanBackendUrl}`);
    console.log(`TTS API URL will be: ${cleanBackendUrl}/tts-api`);
    console.log('\nYou can now start your app with: npm start');
  });
}); 