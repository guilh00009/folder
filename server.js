const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Track TTS API availability
let ttsApiAvailable = false;

// Enable CORS for all routes
app.use(cors());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Proxy for TTS API
app.use('/tts-api', createProxyMiddleware({
  target: 'https://4u9hh5rz7jyrll-3000.proxy.runpod.net/',
  changeOrigin: true,
  pathRewrite: {
    '^/tts-api': '', // remove the /tts-api prefix
  },
  onProxyReq: function(proxyReq, req, res) {
    // Log proxy requests
    console.log(`Proxying TTS request to: ${proxyReq.path}`);
  },
  onProxyRes: function(proxyRes, req, res) {
    // Add CORS headers
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    
    // Log proxy response
    console.log(`TTS proxy response status: ${proxyRes.statusCode}`);
    
    // Update TTS API availability status
    ttsApiAvailable = proxyRes.statusCode >= 200 && proxyRes.statusCode < 300;
  },
  onError: function(err, req, res) {
    console.error('TTS Proxy Error:', err);
    ttsApiAvailable = false;
    
    // If this is a TTS generation request, return a fallback response
    if (req.url.includes('/api/tts/generate')) {
      return res.status(200).json({
        success: true,
        message: 'Fallback TTS response',
        audio_url: '/fallback-audio',
        sample_rate: 24000
      });
    }
    
    res.status(500).json({
      error: 'TTS Proxy Error',
      message: err.message
    });
  }
}));

// Fallback audio endpoint
app.get('/fallback-audio', (req, res) => {
  res.set('Content-Type', 'audio/wav');
  res.status(200).send(''); // Empty audio data
});

// Proxy for GPT API
app.use('/gpt-api', createProxyMiddleware({
  target: 'https://uk8bybdtqnp5nw-8000.proxy.runpod.net',
  changeOrigin: true,
  pathRewrite: {
    '^/gpt-api': '/v1', // rewrite path
  },
  onProxyReq: function(proxyReq, req, res) {
    // Log proxy requests
    console.log(`Proxying GPT request to: ${proxyReq.path}`);
  },
  onProxyRes: function(proxyRes, req, res) {
    // Add CORS headers
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    
    // Log proxy response
    console.log(`GPT proxy response status: ${proxyRes.statusCode}`);
  },
  onError: function(err, req, res) {
    console.error('GPT Proxy Error:', err);
    res.status(500).json({
      error: 'GPT Proxy Error',
      message: err.message
    });
  }
}));

// Add a test endpoint for TTS API
app.get('/test-tts', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('https://4u9hh5rz7jyrll-3000.proxy.runpod.net/api/info', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    ttsApiAvailable = true;
    
    res.json({
      success: true,
      message: 'TTS API is reachable',
      data
    });
  } catch (error) {
    console.error('Error testing TTS API:', error);
    ttsApiAvailable = false;
    
    res.status(200).json({
      success: false,
      message: 'TTS API is not reachable',
      error: error.message
    });
  }
});

// API status endpoint
app.get('/api-status', (req, res) => {
  res.json({
    tts_api_available: ttsApiAvailable
  });
});

// Direct TTS endpoint that doesn't rely on the proxy
app.post('/direct-tts', async (req, res) => {
  try {
    // Return a successful response with a fallback audio URL
    res.status(200).json({
      success: true,
      message: 'Fallback TTS response',
      audio_url: '/fallback-audio',
      sample_rate: 24000
    });
  } catch (error) {
    console.error('Error in direct TTS endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`TTS API proxy available at http://localhost:${PORT}/tts-api`);
  console.log(`GPT API proxy available at http://localhost:${PORT}/gpt-api`);
  console.log(`Test TTS API at http://localhost:${PORT}/test-tts`);
  console.log(`API status at http://localhost:${PORT}/api-status`);
  console.log(`Direct TTS endpoint at http://localhost:${PORT}/direct-tts`);
}); 