import axios from 'axios';
import config from '../config';

// API configuration - using our proxy server
const GPT_API_BASE_URL = `${config.SERVER_URL}/gpt-api`;
const TTS_API_BASE_URL = config.TTS_API_URL;

// Create axios instances for each API
const gptApi = axios.create({
  baseURL: GPT_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const ttsApi = axios.create({
  baseURL: TTS_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Test the TTS API connection on startup
(async function testTtsConnection() {
  try {
    const response = await ttsApi.get('/api/info');
    console.log('TTS API connection successful:', response.data);
    console.log('Using TTS API URL:', TTS_API_BASE_URL);
  } catch (error) {
    console.error('TTS API connection failed:', error);
    console.error('Failed TTS API URL:', TTS_API_BASE_URL);
  }
})();

export const apiService = {
  /**
   * Get AI response from GPT-3.5-Turbo
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Promise<Object>} - AI response
   */
  async getAIResponse(messages) {
    try {
      console.log('Sending request to GPT API:', messages);
      const response = await axios.post(`${GPT_API_BASE_URL}/chat/completions`, {
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      console.log('GPT API response:', response.data);
      return {
        content: response.data.choices[0].message.content,
        role: 'assistant',
      };
    } catch (error) {
      console.error('Error getting AI response:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw new Error('Failed to get AI response');
    }
  },
  
  /**
   * Generate speech without context
   * @param {string} text - Text to convert to speech
   * @param {number} speaker - Speaker ID for voice consistency
   * @returns {Promise<Object>} - Audio response with URL
   */
  async generateSpeech(text, speaker = 0) {
    // Maximum number of retry attempts
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`Generating speech for text (attempt ${retryCount + 1}/${maxRetries}):`);
        console.log('Text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        console.log('Using speaker ID:', speaker);
        
        // Check if the text is too long, which might cause issues
        if (text.length > 500) {
          console.warn('⚠️ Text is very long (' + text.length + ' chars), which might cause issues with the TTS API');
          // Truncate very long text to avoid API issues
          if (text.length > 1000) {
            const originalLength = text.length;
            text = text.substring(0, 1000);
            console.warn(`⚠️ Text truncated from ${originalLength} to 1000 characters to avoid API issues`);
          }
        }
        
        // Direct call to TTS API without voice prompts
        try {
          const response = await axios.post(`${TTS_API_BASE_URL}/api/tts/generate`, {
            text,
            speaker,
            max_audio_length_ms: 30000,
            temperature: 0.8,
            return_format: 'url',
          });
          
          console.log('TTS API response:', response.data);
          
          // The TTS API returns a relative URL like "/api/audio/filename.wav"
          // We need to prepend our proxy URL to make it a full URL
          const audioUrl = `${TTS_API_BASE_URL}${response.data.audio_url}`;
          
          console.log('Final audio URL:', audioUrl);
          
          return {
            audio_url: audioUrl,
            sample_rate: response.data.sample_rate,
          };
        } catch (error) {
          console.error('❌ Error in TTS API call:', error);
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
            
            if (error.response.status === 500) {
              console.error('❌ Server error (500). This might be due to:');
              console.error('  - Text being too long or complex');
              console.error('  - Server-side processing issues');
              
              // If text is long, try with a shorter version
              if (text.length > 200) {
                console.log('⚠️ Trying again with shorter text...');
                const shorterText = text.split('.')[0] + '.'; // Just the first sentence
                
                // Recursive call with shorter text
                return this.generateSpeech(shorterText, speaker);
              }
            }
          }
          
          // Throw the error to be caught by the outer try-catch
          throw new Error('Failed to generate speech: ' + (error.message || 'Unknown error'));
        }
      } catch (error) {
        retryCount++;
        console.error(`Error generating speech (attempt ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, retryCount) * 500; // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // If we're retrying, try with a shorter text
          if (text.length > 200) {
            const sentences = text.split('.');
            if (sentences.length > 1) {
              // Use fewer sentences in each retry
              const numSentences = Math.max(1, sentences.length - retryCount);
              text = sentences.slice(0, numSentences).join('.') + '.';
              console.log(`Shortened text for retry to ${text.length} chars:`, 
                text.substring(0, 100) + (text.length > 100 ? '...' : ''));
            }
          }
        } else {
          console.error('Max retries reached, giving up');
          throw error;
        }
      }
    }
    
    // This should never be reached due to the throw in the catch block
    // but added as a fallback
    throw new Error('Failed to generate speech after maximum retries');
  },
  
  /**
   * Generate speech with context for more natural conversation flow
   * @param {string} text - Text to convert to speech
   * @param {Array} context - Array of previous utterances with text, speaker, and audio
   * @param {number} speaker - Speaker ID for voice consistency
   * @returns {Promise<Object>} - Audio response with URL
   */
  async generateSpeechWithContext(text, context, speaker = 0) {
    // Maximum number of retry attempts
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // If no context, use the simpler endpoint
        if (!context || context.length === 0) {
          console.log('No context provided, using generateSpeech instead');
          return this.generateSpeech(text, speaker);
        }
        
        // Filter out context items without audio data
        const validContext = context.filter(item => item.audio_base64 && item.audio_base64.length > 0);
        
        if (validContext.length === 0) {
          console.log('No valid context items with audio data, using generateSpeech instead');
          return this.generateSpeech(text, speaker);
        }
        
        console.log(`Generating speech with context (attempt ${retryCount + 1}/${maxRetries}):`);
        console.log('Text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        console.log('Original context length:', context.length);
        console.log('Valid context items with audio:', validContext.length);
        console.log('Using speaker ID:', speaker);
        
        // Format context for the CSM model
        // Each context item should have text, speaker, and audio_base64
        const formattedContext = validContext.map(item => {
          // Ensure the audio_base64 doesn't have any data URL prefix
          let audioBase64 = item.audio_base64;
          if (typeof audioBase64 === 'string' && audioBase64.includes('base64,')) {
            audioBase64 = audioBase64.split('base64,')[1];
          }
          
          // Validate that the base64 string is valid
          try {
            // Test decode a small portion to verify it's valid base64
            atob(audioBase64.substring(0, 10));
          } catch (e) {
            console.error('Invalid base64 data detected:', e);
            return null;
          }
          
          return {
            text: item.text,
            speaker: item.speaker,
            audio_base64: audioBase64
          };
        }).filter(Boolean); // Remove any null items
        
        if (formattedContext.length === 0) {
          console.log('No valid context items after format validation, using generateSpeech instead');
          return this.generateSpeech(text, speaker);
        }
        
        // Log audio data presence
        console.log('Context items with audio data:', formattedContext.map(item => ({
          text_length: item.text.length,
          speaker: item.speaker,
          has_audio: !!item.audio_base64,
          audio_base64_length: item.audio_base64 ? item.audio_base64.length : 0
        })));
        
        // Limit context to just one item to prevent payload size issues
        // For the Samantha voice, we only need the one context item
        const limitedContext = formattedContext.slice(-1);
        console.log(`Using limited context (last item):`, limitedContext.length);
        console.log('Context speakers sequence:', limitedContext.map(item => item.speaker).join(' → '));
        
        // Log detailed context information for debugging
        console.log('Detailed context being sent to API:');
        limitedContext.forEach((item, index) => {
          console.log(`Context item ${index + 1}:`, {
            text_preview: item.text.substring(0, 30) + (item.text.length > 30 ? '...' : ''),
            speaker: item.speaker,
            audio_length: item.audio_base64 ? item.audio_base64.length : 0
          });
        });
        
        // Check if the text is too long, which might cause issues
        if (text.length > 500) {
          console.warn('⚠️ Text is very long (' + text.length + ' chars), which might cause issues with the TTS API');
          
          // For retries, we might truncate the text
          if (retryCount > 0 && text.length > 500) {
            const originalLength = text.length;
            // Truncate more aggressively with each retry
            const maxLength = 1000 - (retryCount * 250);
            text = text.substring(0, maxLength);
            console.warn(`⚠️ Text truncated from ${originalLength} to ${text.length} characters for retry ${retryCount}`);
          }
        }
        
        // Check if any audio data is very large (over 2MB)
        const largeAudioItems = limitedContext.filter(item => item.audio_base64 && item.audio_base64.length > 2000000);
        if (largeAudioItems.length > 0) {
          console.warn('⚠️ Some audio data is very large, which might cause issues with the TTS API');
          console.warn('Large audio items:', largeAudioItems.map(item => ({
            text_preview: item.text.substring(0, 20) + '...',
            audio_length: item.audio_base64.length
          })));
          
          // For the first attempt, try with the large audio
          // For retries, remove large audio items
          if (retryCount > 0) {
            console.warn('⚠️ Retry attempt - removing large audio items to prevent API issues');
            const filteredContext = limitedContext.filter(item => 
              !item.audio_base64 || item.audio_base64.length <= 2000000
            );
            
            // If we still have valid items, use the filtered context
            if (filteredContext.length > 0) {
              console.log('Using filtered context without large audio items:', filteredContext.length);
              limitedContext = filteredContext;
            } else {
              // If all items were filtered out, fall back to context-free generation
              console.log('All context items were too large, falling back to context-free generation');
              return this.generateSpeech(text, speaker);
            }
          }
        }
        
        try {
          // For any retry after the first, try using the standard endpoint
          if (retryCount > 1) {
            console.log('Multiple retry attempts failed, trying without context as fallback');
            return this.generateSpeech(text, speaker);
          }
          
          const response = await axios.post(`${TTS_API_BASE_URL}/api/tts/generate_with_context`, {
            text,
            speaker,
            context: limitedContext,
            max_audio_length_ms: 30000,
            temperature: 0.8,
            return_format: 'url',
          });
          
          console.log('TTS with context API response:', response.data);
          
          // The TTS API returns a relative URL like "/api/audio/filename.wav"
          // We need to prepend our proxy URL to make it a full URL
          const audioUrl = `${TTS_API_BASE_URL}${response.data.audio_url}`;
          
          console.log('Final audio URL with context:', audioUrl);
          
          return {
            audio_url: audioUrl,
            sample_rate: response.data.sample_rate,
          };
        } catch (error) {
          console.error('❌ Error in TTS API call with context:', error);
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
            
            if (error.response.status === 500) {
              console.error('❌ Server error (500) when using context. This might be due to:');
              console.error('  - Context data being too large');
              console.error('  - Invalid audio data format');
              console.error('  - Server-side processing issues');
              
              // If this is the last retry, fall back to context-free generation
              if (retryCount === maxRetries - 1) {
                console.log('Last retry failed, falling back to context-free generation');
                return this.generateSpeech(text, speaker);
              }
            }
          }
          
          // Throw the error to be caught by the outer try-catch
          throw error;
        }
      } catch (error) {
        retryCount++;
        console.error(`Error generating speech with context (attempt ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, retryCount) * 500; // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // If we're retrying, try with a shorter text
          if (text.length > 200) {
            const sentences = text.split('.');
            if (sentences.length > 1) {
              // Use fewer sentences in each retry
              const numSentences = Math.max(1, sentences.length - retryCount);
              text = sentences.slice(0, numSentences).join('.') + '.';
              console.log(`Shortened text for retry to ${text.length} chars:`, 
                text.substring(0, 100) + (text.length > 100 ? '...' : ''));
            }
          }
        } else {
          console.log('Max retries reached, falling back to context-free generation');
          return this.generateSpeech(text, speaker);
        }
      }
    }
    
    // This should never be reached due to the fallback in the catch block
    // but added as a fallback
    return this.generateSpeech(text, speaker);
  },
  
  /**
   * Get information about the TTS model
   * @returns {Promise<Object>} - TTS model information
   */
  async getTTSInfo() {
    try {
      const response = await axios.get(`${TTS_API_BASE_URL}/api/info`);
      return response.data;
    } catch (error) {
      console.error('Error getting TTS info:', error);
      throw new Error('Failed to get TTS information');
    }
  },
}; 