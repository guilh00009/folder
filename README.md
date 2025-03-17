# Voice Interface

A hands-free web interface for voice interaction with AI, using GPT-3.5-Turbo and advanced TTS with context awareness.

## Features

- Hands-free voice interaction
- Uses GPT-3.5-Turbo for AI responses
- Advanced TTS with context awareness (maintains voice consistency across responses)
- Simple and intuitive UI

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the proxy server and React app together:
   ```
   npm run dev
   ```
   This will start:
   - The proxy server on port 3001
   - The React app on port 3000

4. Open your browser to `http://localhost:3000`

## Running in Production

To build and run the application for production:

1. Build the React app:
   ```
   npm run build
   ```

2. Start the server:
   ```
   npm run server
   ```

3. Open your browser to `http://localhost:3001`

## Troubleshooting

If you encounter CORS issues:
- Make sure the proxy server is running
- Check that the API URLs in the .env file are correct
- Verify that the proxy server is correctly forwarding requests to the APIs

## API Configuration

The application uses the following APIs through a proxy server:
- GPT-3.5-Turbo API: https://2riccoqdyhidmd-8000.proxy.runpod.net/v1
- TTS API: https://ae66sof6djvf45-3000.proxy.runpod.net/

## License

MIT 