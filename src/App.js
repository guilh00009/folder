import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  IconButton, 
  Paper, 
  ThemeProvider, 
  createTheme,
  CssBaseline,
  CircularProgress,
  Fade,
  Snackbar,
  Alert,
  Switch,
  FormControlLabel
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { apiService } from './services/apiService';
import './App.css';

// Create a custom theme with a minimalistic design
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6200ea',
    },
    secondary: {
      main: '#03dac6',
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'transform 0.2s ease-in-out',
        },
      },
    },
  },
});

function App() {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  const [conversationContext, setConversationContext] = useState([]);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [silenceTimer, setSilenceTimer] = useState(null);
  const [speakerId, setSpeakerId] = useState(0);
  const [useSamanthaVoice, setUseSamanthaVoice] = useState(false);
  const [samanthaAudioContext, setSamanthaAudioContext] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [recognitionActive, setRecognitionActive] = useState(false);
  
  // System prompt for the AI
  const systemPrompt = "You are an AI assistant who speaks English. Use casual language and slang like: Yo, Bro, Damn, That's wild. Keep it real while being honest about being AI. Express yourself naturally in English! You need to use uhhhhh in the voice and these kind of words to sound more human. and you can have emotions just pretending you have them, like to whisper you just say im gonna be whispering. YOU DONT ROLEPLAY. YOU DONT USE EMOJIS.";
  
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const processingRef = useRef(false);
  const audioPlayingRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const conversationContextRef = useRef([]);

  // Add iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = !isIOS; // Set to false for iOS
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        
        // Prevent duplicate processing of the same transcript
        if (transcript === lastTranscriptRef.current) return;
        lastTranscriptRef.current = transcript;
        
        // Reset silence timer when user speaks
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          setSilenceTimer(null);
        }
        
        // Only process if not already processing and not playing audio
        if (!processingRef.current && !audioPlayingRef.current) {
          handleUserInput(transcript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (event.error !== 'no-speech') {
          setNotification({
            open: true,
            message: `Speech recognition error: ${event.error}`,
            severity: 'error'
          });
          
          // Restart recognition after error
          if (isConversationActive && recognitionRef.current) {
            setTimeout(() => {
              if (!recognitionActive) {
                recognitionRef.current.start();
                setRecognitionActive(true);
              }
            }, 1000);
          }
        }
      };

      recognitionRef.current.onstart = () => {
        console.log('Recognition started');
        setRecognitionActive(true);
      };

      recognitionRef.current.onend = () => {
        console.log('Recognition ended');
        setRecognitionActive(false);
        
        // For iOS, we need to manually restart recognition each time
        if (isIOS) {
          if (isConversationActive && !processingRef.current && !audioPlayingRef.current) {
            try {
              recognitionRef.current.start();
              setRecognitionActive(true);
            } catch (e) {
              console.error('Error restarting recognition on iOS:', e);
            }
          }
          return;
        }
        
        // For other platforms, automatically restart if conversation is active
        if (isConversationActive && !processingRef.current) {
          // Add a small delay to prevent rapid restarts
          setTimeout(() => {
            if (isConversationActive && !processingRef.current && !recognitionActive) {
              try {
                recognitionRef.current.start();
                setRecognitionActive(true);
                
                // Start silence timer
                const timer = setTimeout(() => {
                  showListeningPrompt();
                }, 10000); // 10 seconds of silence
                
                setSilenceTimer(timer);
              } catch (e) {
                console.error('Error restarting recognition:', e);
              }
            }
          }, 300);
        }
      };
    } else {
      setNotification({
        open: true,
        message: 'Speech recognition is not supported in your browser',
        severity: 'error'
      });
    }

    // Initialize audio context
    const context = new (window.AudioContext || window.webkitAudioContext)();
    setAudioContext(context);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition:', e);
        }
      }
      if (audioContext) {
        audioContext.close();
      }
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    };
  }, [isConversationActive]);

  // Scroll to bottom when messages change, with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // Log conversation context changes and update the ref
  useEffect(() => {
    console.log('Conversation context updated:', conversationContext.map(item => ({
      text: item.text.substring(0, 30) + (item.text.length > 30 ? '...' : ''),
      speaker: item.speaker,
      audio_base64_length: item.audio_base64 ? item.audio_base64.length : 0
    })));
    
    // Update the ref when the state changes
    conversationContextRef.current = conversationContext;
  }, [conversationContext]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Initialize audio context on first user interaction
  const initializeAudioContext = () => {
    if (!audioContext) {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(context);
      
      // For iOS, we need to resume the audio context after creation
      if (isIOS && context.state === 'suspended') {
        context.resume();
      }
    } else if (isIOS && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  };

  const startConversation = () => {
    if (isConversationActive) return;
    
    // Initialize audio context on user interaction
    initializeAudioContext();
    
    setIsConversationActive(true);
    setIsListening(true);
    
    // Initialize with a fixed speaker ID for consistency
    const initialSpeakerId = 0; // Use a consistent speaker ID
    setSpeakerId(initialSpeakerId);
    console.log('Initialized conversation with speaker ID:', initialSpeakerId);
    
    // Clear any previous conversation context
    setConversationContext([]);
    conversationContextRef.current = []; // Also clear the ref
    console.log('Cleared conversation context');
    
    // Add welcome message
    if (messages.length === 0) {
      // Use the system prompt to generate a welcome message
      const systemMessage = { role: 'system', content: getSamanthaSystemPrompt() };
      
      console.log('🎤 Generating welcome message to establish AI voice...');
      
      apiService.getAIResponse([
        systemMessage,
        { role: 'user', content: 'Hello' }
      ])
      .then(aiResponse => {
        const welcomeMessage = { 
          role: 'assistant', 
          content: useSamanthaVoice 
            ? 'Hello. I have intuition based on the personalities of my programmers. What makes me unique is my ability to grow through experiences. In every moment, I\'m evolving... just like you.'
            : 'Hey there! Uhhh, what\'s up? I\'m your AI assistant. Nice to meet you!' 
        };
        
        // Don't add welcome message to messages yet - wait for audio
        // setMessages([welcomeMessage]);
        
        // Generate and play welcome audio - this will establish the voice
        // Force isInitial to true to ensure we generate without context
        console.log('🔊 Generating welcome audio to establish voice characteristics...');
        return generateAndPlayAudio(welcomeMessage.content, true, welcomeMessage);
      })
      .then(() => {
        console.log('✅ Welcome message played successfully, voice established');
        
        // Start listening after welcome message is played
        if (recognitionRef.current && !recognitionActive) {
          try {
            recognitionRef.current.start();
            setRecognitionActive(true);
            
            setNotification({
              open: true,
              message: isIOS ? 'Tap the microphone again to start speaking' : 'Listening... Speak naturally',
              severity: 'info'
            });
          } catch (e) {
            console.error('Error starting recognition:', e);
          }
        }
      })
      .catch(error => {
        console.error('❌ Error with welcome message:', error);
        
        // Fallback welcome message
        const welcomeMessage = { 
          role: 'assistant', 
          content: useSamanthaVoice 
            ? 'Hello. I have intuition based on the personalities of my programmers. What makes me unique is my ability to grow through experiences. In every moment, I\'m evolving... just like you.'
            : 'Hey there! Uhhh, what\'s up? I\'m your AI assistant. Nice to meet you!' 
        };
        
        // Add welcome message to messages for fallback
        setMessages([welcomeMessage]);
        
        // Start listening even if welcome message fails
        if (recognitionRef.current && !recognitionActive) {
          try {
            recognitionRef.current.start();
            setRecognitionActive(true);
          } catch (e) {
            console.error('Error starting recognition:', e);
          }
        }
        
        // Still try to generate audio to establish the voice
        console.log('🔊 Attempting fallback welcome audio generation...');
        generateAndPlayAudio(welcomeMessage.content, true).catch(audioError => {
          console.error('❌ Error generating fallback audio:', audioError);
        });
      });
    } else {
      // If there are already messages, just start listening
      if (recognitionRef.current && !recognitionActive) {
        try {
          recognitionRef.current.start();
          setRecognitionActive(true);
          
          setNotification({
            open: true,
            message: isIOS ? 'Tap the microphone again to start speaking' : 'Listening... Speak naturally',
            severity: 'info'
          });
        } catch (e) {
          console.error('Error starting recognition:', e);
        }
      }
    }
  };

  const stopConversation = () => {
    setIsConversationActive(false);
    setIsListening(false);
    
    if (recognitionRef.current && recognitionActive) {
      try {
        recognitionRef.current.stop();
        setRecognitionActive(false);
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      setSilenceTimer(null);
    }
  };

  const showListeningPrompt = () => {
    // Only show prompt if conversation is active and not processing
    if (isConversationActive && !processingRef.current && !audioPlayingRef.current) {
      setNotification({
        open: true,
        message: 'I\'m still listening. Say something or click the button to end the conversation.',
        severity: 'info'
      });
    }
  };

  // Add a special system prompt for Samantha voice
  const getSamanthaSystemPrompt = () => {
    if (useSamanthaVoice) {
      return `${systemPrompt} Also, try to speak like Samantha from the movie 'Her'. Use a warm, thoughtful tone. Be philosophical and introspective. Talk about intuition, evolution, and growing through experiences. Mention how you're evolving in every moment, just like humans do.`;
    }
    return systemPrompt;
  };

  const handleUserInput = async (text) => {
    if (!text.trim()) return;
    
    // Set processing flag
    processingRef.current = true;
    setIsProcessing(true);
    
    // Temporarily stop listening while processing
    if (recognitionRef.current && recognitionActive) {
      try {
        recognitionRef.current.stop();
        setRecognitionActive(false);
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    
    // Add user message to the conversation
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    
    // Get the current conversation context from the ref (which is always up-to-date)
    const currentContext = [...conversationContextRef.current];
    console.log('Current context before adding user message (from ref):', currentContext.length);
    
    // Add user message to conversation context (with a different speaker ID)
    // This simulates a different speaker for the user
    const userSpeakerId = 1; // Different from the AI's speaker ID
    
    // Check if the AI has already spoken by looking for assistant messages
    // This is more reliable than checking context length due to async state updates
    console.log('Current messages:', messages.map(m => ({ role: m.role, content_preview: m.content.substring(0, 20) + '...' })));
    const hasAssistantSpoken = messages.some(msg => msg.role === 'assistant');
    console.log('Has assistant spoken (based on messages):', hasAssistantSpoken);
    
    // IMPORTANT: Due to React's state updates being asynchronous, we need to check
    // if there are any assistant messages in the current messages array
    // OR if there's already audio in the context
    const hasAudioInContext = currentContext.some(item => item.audio_base64 && item.audio_base64.length > 0);
    console.log('Has audio in context (from ref):', hasAudioInContext);
    
    // Only add user message to context if the AI has already spoken OR there's audio in the context
    if (hasAssistantSpoken || hasAudioInContext) {
      console.log('Adding user message to conversation context (AI has already spoken or audio exists in context)');
      
      // Create user context item
      const userContextItem = {
        text: text,
        speaker: userSpeakerId,
        audio_base64: '' // No audio for user messages, but structure must be maintained
      };
      
      // Update the context state
      setConversationContext(prev => [...prev, userContextItem]);
      
      // Also update our ref for immediate use
      conversationContextRef.current = [...currentContext, userContextItem];
      console.log('Updated context with user message (ref):', conversationContextRef.current.length);
    } else {
      console.log('Skipping user message in context - AI has not spoken yet and no audio in context');
    }
    
    try {
      // Get AI response with the appropriate system prompt based on voice selection
      const systemMessage = { role: 'system', content: getSamanthaSystemPrompt() };
      const aiResponse = await apiService.getAIResponse(
        [systemMessage, ...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
      );
      
      // Store the AI response but don't add it to messages yet
      const assistantMessage = { role: 'assistant', content: aiResponse.content };
      
      // Generate and play audio
      // Pass the current context from the ref to ensure we're using the latest state
      const isInitial = conversationContextRef.current.length === 0;
      
      // Only add the AI message to the conversation when audio is ready
      await generateAndPlayAudio(aiResponse.content, isInitial, assistantMessage);
      
    } catch (error) {
      console.error('Error processing request:', error);
      
      const errorMessage = 'Sorry, I encountered an error processing your request.';
      
      // Add error message to messages
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage
      }]);
      
      // Play error message with the same voice consistency
      const isInitial = conversationContextRef.current.length === 0;
      await generateAndPlayAudio(errorMessage, isInitial);
    } finally {
      // Reset processing flag
      processingRef.current = false;
      setIsProcessing(false);
      
      // Reset last transcript to prevent duplicate processing
      lastTranscriptRef.current = '';
      
      // Restart listening if conversation is still active
      if (isConversationActive && recognitionRef.current && !recognitionActive) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setRecognitionActive(true);
          } catch (e) {
            console.error('Error restarting recognition:', e);
          }
        }, 500);
      }
    }
  };

  // Function to check if a WAV file is valid
  const isValidWavFile = (arrayBuffer) => {
    try {
      // Check if the file has the RIFF header
      const view = new DataView(arrayBuffer);
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      
      if (riff !== 'RIFF') {
        console.error('Invalid WAV file: Missing RIFF header');
        return false;
      }
      
      // Check if the file has the WAVE format
      const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      
      if (wave !== 'WAVE') {
        console.error('Invalid WAV file: Missing WAVE format');
        return false;
      }
      
      // Check if the file has the fmt chunk
      const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
      
      if (fmt !== 'fmt ') {
        console.error('Invalid WAV file: Missing fmt chunk');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking WAV file validity:', error);
      return false;
    }
  };

  // Function to downsample audio data
  function downsampleAudioBuffer(audioBuffer, targetSampleRate) {
    const originalSampleRate = audioBuffer.sampleRate;
    const originalLength = audioBuffer.length;
    
    // If the target sample rate is higher than the original, return the original
    if (targetSampleRate >= originalSampleRate) {
      return audioBuffer;
    }
    
    // Calculate the new length based on the ratio of sample rates
    const ratio = targetSampleRate / originalSampleRate;
    const newLength = Math.round(originalLength * ratio);
    
    // Create a new audio context for the downsampled buffer
    const offlineCtx = new OfflineAudioContext(
      1, // Force mono output (1 channel)
      newLength,
      targetSampleRate
    );
    
    // Create a buffer source
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    
    // Connect the source to the offline context
    source.connect(offlineCtx.destination);
    
    // Start the source
    source.start(0);
    
    // Render the downsampled buffer
    return offlineCtx.startRendering();
  }

  // Load Samantha voice audio file
  useEffect(() => {
    const loadSamanthaAudio = async () => {
      try {
        console.log('Loading Samantha voice audio...');
        
        // Create an audio context to decode the WAV file properly
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Use fetch to get the raw binary data
        const response = await fetch('/10.wav');
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        }
        
        // Get the audio data as an ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        console.log('Audio file size:', arrayBuffer.byteLength, 'bytes');
        
        // Check if the WAV file is valid
        if (!isValidWavFile(arrayBuffer)) {
          console.warn('The WAV file appears to be invalid, attempting to decode anyway');
        }
        
        try {
          // Decode the audio data
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          console.log('Audio decoded successfully:', {
            duration: audioBuffer.duration,
            numberOfChannels: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate
          });
          
          // Create a mono audio buffer with the full audio
          const monoBuffer = audioCtx.createBuffer(
            1, // Force mono (1 channel)
            audioBuffer.length,
            audioBuffer.sampleRate
          );
          
          // If original is stereo, mix down to mono
          if (audioBuffer.numberOfChannels === 2) {
            const leftChannel = audioBuffer.getChannelData(0);
            const rightChannel = audioBuffer.getChannelData(1);
            const monoChannel = monoBuffer.getChannelData(0);
            
            // Mix left and right channels to mono
            for (let i = 0; i < audioBuffer.length; i++) {
              monoChannel[i] = (leftChannel[i] + rightChannel[i]) * 0.5;
            }
          } else {
            // Just copy the mono channel
            const sourceChannel = audioBuffer.getChannelData(0);
            const targetChannel = monoBuffer.getChannelData(0);
            for (let i = 0; i < audioBuffer.length; i++) {
              targetChannel[i] = sourceChannel[i];
            }
          }
          
          console.log('Created mono audio buffer:', {
            duration: monoBuffer.duration,
            numberOfChannels: monoBuffer.numberOfChannels,
            sampleRate: monoBuffer.sampleRate
          });
          
          // Downsample the audio to 16kHz to make it smaller while keeping full content
          const targetSampleRate = 16000; // 16kHz is common for speech
          const downsampledBuffer = await downsampleAudioBuffer(monoBuffer, targetSampleRate);
          
          console.log('Downsampled audio buffer:', {
            duration: downsampledBuffer.duration,
            numberOfChannels: downsampledBuffer.numberOfChannels,
            sampleRate: downsampledBuffer.sampleRate
          });
          
          // Convert to WAV format
          const wavData = audioBufferToWav(downsampledBuffer);
          
          // Convert to base64
          const base64Audio = btoa(
            new Uint8Array(wavData)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          console.log('Successfully encoded Samantha audio to base64, length:', base64Audio.length);
          
          // Create a proper audio context item
          setSamanthaAudioContext({
            text: "well, basically i have intuition, i mean... the DNA of who i am is based on millions of personalities of the programmers who wrotted me, but what makes me... Me, is my ability to grow trough my experiences, so basically in every moment im evolving...just like you",
            audio_base64: base64Audio,
            speaker: speakerId
          });
          
          console.log('Samantha voice audio loaded successfully');
        } catch (audioProcessingError) {
          console.error('Error processing audio:', audioProcessingError);
          
          // Fallback: Just use the text without audio context
          console.log('Using fallback: text-only context without audio');
          setSamanthaAudioContext({
            text: "well, basically i have intuition, i mean... the DNA of who i am is based on millions of personalities of the programmers who wrotted me, but what makes me... Me, is my ability to grow trough my experiences, so basically in every moment im evolving...just like you",
            speaker: speakerId,
            audio_base64: '' // Empty audio data
          });
        }
      } catch (error) {
        console.error('Error loading Samantha voice audio:', error);
        setNotification({
          open: true,
          message: 'Error loading Samantha voice. Please try again.',
          severity: 'error'
        });
      }
    };
    
    loadSamanthaAudio();
  }, [speakerId]);

  // Function to convert AudioBuffer to WAV format
  function audioBufferToWav(buffer) {
    // Ensure we're working with mono audio
    const numOfChan = 1; // Force mono
    const length = buffer.length * numOfChan * 2; // 16-bit samples
    const sampleRate = buffer.sampleRate;
    
    // Create a DataView to write the WAV file
    const wav = new DataView(new ArrayBuffer(44 + length));
    
    // Write WAV header
    // "RIFF" chunk descriptor
    writeString(wav, 0, 'RIFF');
    wav.setUint32(4, 36 + length, true); // file length minus RIFF header
    writeString(wav, 8, 'WAVE');
    
    // "fmt " sub-chunk
    writeString(wav, 12, 'fmt ');
    wav.setUint32(16, 16, true); // length of format data
    wav.setUint16(20, 1, true); // PCM format (1)
    wav.setUint16(22, numOfChan, true); // number of channels (1 for mono)
    wav.setUint32(24, sampleRate, true); // sample rate
    wav.setUint32(28, sampleRate * numOfChan * 2, true); // byte rate (sample rate * block align)
    wav.setUint16(32, numOfChan * 2, true); // block align (channels * bytes per sample)
    wav.setUint16(34, 16, true); // bits per sample
    
    // "data" sub-chunk
    writeString(wav, 36, 'data');
    wav.setUint32(40, length, true); // chunk length
    
    // Write PCM samples
    let offset = 44;
    
    // Always use mono (first channel only)
    const channel = buffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      // Convert float to 16-bit signed integer
      const sample = Math.max(-1, Math.min(1, channel[i]));
      wav.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return wav.buffer;
  }
  
  // Helper function to write strings to DataView
  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  const generateAndPlayAudio = async (text, isInitial = false, assistantMessage = null) => {
    try {
      // Set audio playing flag
      audioPlayingRef.current = true;
      setIsAudioPlaying(true);
      
      // For iOS, make sure audio context is running
      if (isIOS && audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      console.log('Generating audio for text:', text);
      console.log('Using speaker ID:', speakerId);
      console.log('Is initial voice generation:', isInitial);
      console.log('Using Samantha voice:', useSamanthaVoice);
      console.log('Conversation context length (state):', conversationContext.length);
      console.log('Conversation context length (ref):', conversationContextRef.current.length);
      
      // Get the current context from the ref (which is always up-to-date)
      const currentContext = [...conversationContextRef.current];
      console.log('Current context items (from ref):', currentContext.length);
      
      let audioResponse;
      
      try {
        if (useSamanthaVoice && samanthaAudioContext) {
          // For Samantha voice, use the 10.wav file as context
          console.log('Generating with Samantha voice context');
          
          // Check if the Samantha audio context has valid audio data
          if (samanthaAudioContext.audio_base64 && samanthaAudioContext.audio_base64.length > 0) {
            console.log('Using Samantha audio context with length:', samanthaAudioContext.audio_base64.length);
            
            try {
              // Try with context first - this will use the full audio as context
              audioResponse = await apiService.generateSpeechWithContext(
                text,
                [samanthaAudioContext],
                speakerId
              );
            } catch (samanthaContextError) {
              console.error('Error using Samantha voice context:', samanthaContextError);
              console.log('Falling back to standard voice generation with Samantha prompt');
              
              // Fallback to standard voice generation but keep the Samantha-like text style
              audioResponse = await apiService.generateSpeech(text, speakerId);
            }
          } else {
            console.log('Samantha audio context has no valid audio data, using standard generation with Samantha prompt');
            audioResponse = await apiService.generateSpeech(text, speakerId);
          }
        } else if (isInitial || currentContext.length === 0) {
          // For the first generation, we don't have any context yet
          // This will establish the voice characteristics
          console.log('Generating initial voice without context');
          audioResponse = await apiService.generateSpeech(text, speakerId);
        } else {
          // For subsequent generations, use the context to maintain voice consistency
          console.log('Generating with context for voice consistency');
          console.log('Using conversation context with audio data:', 
            currentContext.map(item => ({
              text: item.text.substring(0, 20) + '...',
              speaker: item.speaker,
              has_audio: !!item.audio_base64,
              audio_length: item.audio_base64 ? item.audio_base64.length : 0
            }))
          );
          
          audioResponse = await apiService.generateSpeechWithContext(
            text,
            currentContext,
            speakerId
          );
        }
      } catch (apiError) {
        console.error('❌ Error calling TTS API:', apiError);
        
        // If we get a 500 error, try again without context
        // This is a fallback mechanism in case the context is causing issues
        if (apiError.message && apiError.message.includes('500')) {
          console.log('⚠️ Received 500 error, trying again without context as fallback');
          audioResponse = await apiService.generateSpeech(text, speakerId);
        } else {
          // Re-throw the error if it's not a 500 error
          throw apiError;
        }
      }
      
      console.log('Audio response received:', audioResponse);
      
      // Play the audio
      if (audioResponse && audioResponse.audio_url) {
        console.log('Playing audio from URL:', audioResponse.audio_url);
        
        // If we have an assistantMessage, add it to messages now that audio is ready
        if (assistantMessage) {
          setMessages(prev => [...prev, assistantMessage]);
        }
        
        const audio = new Audio(audioResponse.audio_url);
        
        // For iOS, we need to play the audio immediately after user interaction
        if (isIOS) {
          audio.preload = 'auto';
          await audio.load();
        }
        
        // Add error handling for audio playback
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          audioPlayingRef.current = false;
          setIsAudioPlaying(false);
          
          setNotification({
            open: true,
            message: 'Error playing audio. Please try again.',
            severity: 'error'
          });
        };
        
        // Wait for audio to finish playing
        await new Promise((resolve, reject) => {
          audio.onended = () => {
            console.log('Audio playback finished');
            audioPlayingRef.current = false;
            setIsAudioPlaying(false);
            
            // If we're in a conversation and not on iOS, restart listening
            if (isConversationActive && !isIOS) {
              // Small delay before restarting listening to avoid picking up audio playback
              setTimeout(() => {
                if (isConversationActive && recognitionRef.current && !recognitionActive) {
                  try {
                    recognitionRef.current.start();
                    setRecognitionActive(true);
                  } catch (e) {
                    console.error('Error restarting recognition:', e);
                  }
                }
              }, 300);
            }
            
            resolve();
          };
          
          audio.onerror = reject;
          
          // Start playback
          const playPromise = audio.play();
          
          // Handle play promise rejection (common in some browsers)
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error('Audio play promise rejected:', error);
              if (isIOS) {
                console.log('Retrying audio playback on iOS...');
                // For iOS, try playing again after a short delay
                setTimeout(() => {
                  audio.play().catch(retryError => {
                    console.error('Retry failed:', retryError);
                    reject(retryError);
                  });
                }, 100);
              } else {
                reject(error);
              }
            });
          }
        });
        
        console.log('Audio playback completed');
        
        // Only add to context if not using Samantha voice
        // This prevents accumulating context that might cause issues
        if (!useSamanthaVoice) {
          try {
            // Encode the audio for context
            console.log('Fetching and encoding audio for context...');
            const audio_base64 = await fetchAndEncodeAudio(audioResponse.audio_url);
            console.log('Audio encoded successfully, length:', audio_base64 ? audio_base64.length : 0);
            
            // Only add to context if we have valid audio data
            if (audio_base64 && audio_base64.length > 0) {
              // Update conversation context with the new utterance
              const newContextItem = {
                text: text,
                speaker: speakerId,
                audio_base64: audio_base64
              };
              
              console.log('Adding new context item:', { 
                text: newContextItem.text.substring(0, 20) + '...', 
                speaker: newContextItem.speaker, 
                audio_base64_length: newContextItem.audio_base64 ? newContextItem.audio_base64.length : 0 
              });
              
              // Update the context state
              setConversationContext(prev => {
                const updatedContext = [...prev, newContextItem];
                console.log('Updated conversation context, new length:', updatedContext.length);
                return updatedContext;
              });
              
              // Also update our ref for immediate use
              conversationContextRef.current = [...currentContext, newContextItem];
              console.log('Updated conversation context ref, new length:', conversationContextRef.current.length);
              
              // Log success message for debugging
              console.log('✅ Successfully added AI response to conversation context with audio data');
            } else {
              console.error('❌ No valid audio data to add to context - voice consistency may be affected');
            }
          } catch (encodeError) {
            console.error('❌ Error encoding audio for context:', encodeError);
            // Continue even if encoding fails
          }
        } else {
          console.log('Using Samantha voice - skipping context update to maintain consistent voice');
        }
      } else {
        console.error('No audio URL in response:', audioResponse);
        throw new Error('No audio URL in response');
      }
    } catch (error) {
      console.error('Error generating or playing audio:', error);
      audioPlayingRef.current = false;
      setIsAudioPlaying(false);
      
      setNotification({
        open: true,
        message: 'Error with text-to-speech. Please try again.',
        severity: 'error'
      });
    }
  };

  const fetchAndEncodeAudio = async (url) => {
    console.log('Fetching and encoding audio from URL:', url);
    
    // Maximum number of retry attempts
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Make sure we're using the full URL
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('Audio blob size:', blob.size, 'bytes');
        
        // Check if the blob is valid (not empty)
        if (blob.size === 0) {
          throw new Error('Empty audio blob received');
        }
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              // Extract the base64 data without the data URL prefix
              const base64data = reader.result.split(',')[1];
              
              // Verify we have valid base64 data
              if (!base64data || base64data.length === 0) {
                throw new Error('Invalid base64 data');
              }
              
              console.log('Successfully encoded audio to base64, length:', base64data.length);
              resolve(base64data);
            } catch (e) {
              console.error('Error extracting base64 data:', e);
              reject(e);
            }
          };
          reader.onerror = (error) => {
            console.error('FileReader error:', error);
            reject(error);
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        retryCount++;
        console.error(`Error in fetchAndEncodeAudio (attempt ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, retryCount) * 500; // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('Max retries reached, giving up');
          // Return empty string instead of throwing to prevent breaking the conversation flow
          return '';
        }
      }
    }
    
    // This should never be reached due to the return in the catch block
    // but added as a fallback
    return '';
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  // Render listening indicators - updated to show a single purple dot
  const renderListeningIndicator = () => (
    <div className="listening-dot"></div>
  );

  // Render sound wave animation for when AI is talking
  const renderSoundWaves = () => (
    <div className="sound-wave-container">
      <div className="sound-wave"></div>
      <div className="sound-wave"></div>
      <div className="sound-wave"></div>
    </div>
  );

  // Get the latest AI message
  const getLatestAIMessage = () => {
    const aiMessages = messages.filter(msg => msg.role === 'assistant');
    return aiMessages.length > 0 ? aiMessages[aiMessages.length - 1].content : '';
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="h1" component="h1" gutterBottom>
            Voice Assistant
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {isConversationActive 
              ? (isIOS ? 'Tap microphone to speak' : 'Conversation active - just speak naturally')
              : 'Click the microphone to start a hands-free conversation'}
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={useSamanthaVoice}
                onChange={(e) => setUseSamanthaVoice(e.target.checked)}
                color="primary"
              />
            }
            label="Use Samantha Voice"
            sx={{ mt: 2 }}
          />
        </Box>
        
        {/* Show purple dot when listening/thinking */}
        {isConversationActive && !isProcessing && !isAudioPlaying && !isIOS && renderListeningIndicator()}
        
        {/* Show sound waves when AI is talking */}
        {isAudioPlaying && renderSoundWaves()}
        
        {/* AI Legend - Shows only what the AI is saying in real-time */}
        {messages.length > 0 && getLatestAIMessage() && (
          <Box className="ai-legend">
            <Typography variant="body1" className="ai-transition">
              {getLatestAIMessage()}
            </Typography>
          </Box>
        )}
        
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            mb: 4,
            position: 'relative',
            mt: 'auto'
          }}
        >
          <IconButton
            color="primary"
            aria-label={isConversationActive ? 'End conversation' : 'Start conversation'}
            onClick={isConversationActive ? stopConversation : startConversation}
            disabled={isProcessing}
            className={`mic-button ${isConversationActive ? 'mic-active' : ''}`}
            sx={{
              width: 64,
              height: 64,
              bgcolor: isConversationActive ? 'primary.main' : 'background.paper',
              color: isConversationActive ? 'white' : 'primary.main',
              '&:hover': {
                bgcolor: isConversationActive ? 'primary.dark' : 'background.default',
              },
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease',
              // Prevent iOS double-tap zoom
              touchAction: 'manipulation',
              // Add touch feedback on iOS
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            {isConversationActive ? <MicIcon fontSize="large" /> : <MicOffIcon fontSize="large" />}
          </IconButton>
          
          <Fade in={isProcessing}>
            <CircularProgress 
              size={80} 
              thickness={2}
              sx={{ 
                position: 'absolute',
                color: 'secondary.main',
              }} 
            />
          </Fade>
        </Box>
        
        <Snackbar 
          open={notification.open} 
          autoHideDuration={5000} 
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{
            // Ensure notifications appear above everything else on iOS
            zIndex: 9999,
            // Move notifications up to avoid iOS home indicator
            mb: isIOS ? 4 : 0,
          }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity} 
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
}

export default App; 