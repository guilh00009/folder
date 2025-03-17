/**
 * Application configuration
 * Update these values with your public URLs from Cloudflare Tunnel
 */
const config = {
  // Backend server URL (update this with your Cloudflare Tunnel URL for the backend)
  // Example: 'https://some-random-name.trycloudflare.com'
  // Default fallback to localhost for local development
  SERVER_URL: process.env.REACT_APP_SERVER_URL || 'https://meaning-children-sleeps-prime.trycloudflare.com',
  
  // TTS API URL (this should point to your backend server's TTS endpoint)
  // This will be automatically derived from SERVER_URL
  get TTS_API_URL() {
    return this.SERVER_URL + '/tts-api';
  }
};

export default config; 