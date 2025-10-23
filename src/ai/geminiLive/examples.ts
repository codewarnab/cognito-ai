/**
 * Example usage of GeminiLiveClient
 * 
 * This file demonstrates how to use the GeminiLiveClient for voice conversations
 * 
 * NOTE: This is for reference only. The actual integration will be in the Voice Mode UI component.
 */

import { GeminiLiveClient, type GeminiLiveClientConfig, LiveAPIError, LiveAPIErrorType } from './index';

/**
 * Example: Basic voice conversation setup
 */
async function exampleBasicUsage() {
    // 1. Create client configuration
    const config: GeminiLiveClientConfig = {
        apiKey: 'YOUR_API_KEY', // Get from chrome.storage.local
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        voiceName: 'Aoede',
        enableTools: true,
        eventHandlers: {
            onStatusChange: (status) => {
                console.log('Status changed:', status);
            },
            onError: (error) => {
                console.error('Error:', error.message);
            },
            onModelSpeaking: (isSpeaking) => {
                console.log('Model speaking:', isSpeaking);
            },
            onUserSpeaking: (isSpeaking) => {
                console.log('User speaking:', isSpeaking);
            },
            onToolCall: (toolName, args) => {
                console.log('Tool called:', toolName, args);
            },
            onToolResult: (toolName, result) => {
                console.log('Tool result:', toolName, result);
            }
        }
    };

    // 2. Create and initialize client
    const client = new GeminiLiveClient(config);

    try {
        await client.initialize();
        console.log('Client initialized');
    } catch (error) {
        if (error instanceof LiveAPIError) {
            if (error.type === LiveAPIErrorType.PERMISSION_DENIED) {
                console.error('Microphone permission denied');
            } else if (error.type === LiveAPIErrorType.INITIALIZATION) {
                console.error('Failed to initialize client');
            }
        }
        throw error;
    }

    // 3. Start session
    try {
        await client.startSession();
        console.log('Session started');
    } catch (error) {
        if (error instanceof LiveAPIError) {
            if (error.type === LiveAPIErrorType.CONNECTION) {
                console.error('Failed to connect to Live API');
            }
        }
        throw error;
    }

    // 4. Start audio capture
    try {
        await client.startCapture();
        console.log('Listening...');
    } catch (error) {
        if (error instanceof LiveAPIError) {
            if (error.type === LiveAPIErrorType.AUDIO_CAPTURE) {
                console.error('Failed to start audio capture');
            }
        }
        throw error;
    }

    // 5. User can now speak and the AI will respond
    // The conversation continues until stopCapture() is called

    // 6. Stop capture (but keep session alive)
    // client.stopCapture();

    // 7. When done, stop session and cleanup
    // await client.stopSession();
    // client.cleanup();

    return client;
}

/**
 * Example: With audio visualization
 */
async function exampleWithVisualization() {
    const client = new GeminiLiveClient({
        apiKey: 'YOUR_API_KEY',
        voiceName: 'Puck'
    });

    await client.initialize();
    await client.startSession();

    // Get audio manager for visualization
    const audioManager = client.getAudioManager();
    const inputAnalyser = audioManager.getInputAnalyser();
    const outputAnalyser = audioManager.getOutputAnalyser();

    // Animation loop for visualization
    function animate() {
        if (inputAnalyser && outputAnalyser) {
            // Update frequency data
            inputAnalyser.update();
            outputAnalyser.update();

            // Get frequency data arrays
            const inputData = inputAnalyser.data; // Uint8Array
            const outputData = outputAnalyser.data; // Uint8Array

            // Use data to update visual (e.g., Three.js orb)
            // updateOrb(inputData, outputData);
        }

        requestAnimationFrame(animate);
    }

    animate();

    await client.startCapture();

    return client;
}

/**
 * Example: Custom system instruction
 */
async function exampleCustomSystemInstruction() {
    const client = new GeminiLiveClient({
        apiKey: 'YOUR_API_KEY',
        systemInstruction: `You are a helpful voice assistant for a Chrome extension.
You can help users navigate the web, manage tabs, and perform browser tasks.
Be concise in your responses since this is a voice conversation.
Always confirm before executing sensitive actions.`,
        voiceName: 'Charon'
    });

    await client.initialize();
    await client.startSession();
    await client.startCapture();

    return client;
}

/**
 * Example: Error handling
 */
async function exampleErrorHandling() {
    const client = new GeminiLiveClient({
        apiKey: 'YOUR_API_KEY',
        eventHandlers: {
            onError: (error) => {
                switch (error.type) {
                    case LiveAPIErrorType.INITIALIZATION:
                        console.error('Failed to initialize:', error.message);
                        // Show error UI
                        break;
                    case LiveAPIErrorType.CONNECTION:
                        console.error('Connection failed:', error.message);
                        // Offer retry
                        break;
                    case LiveAPIErrorType.AUDIO_CAPTURE:
                        console.error('Audio capture failed:', error.message);
                        // Show mic permission prompt
                        break;
                    case LiveAPIErrorType.AUDIO_PLAYBACK:
                        console.error('Audio playback failed:', error.message);
                        // Check speaker settings
                        break;
                    case LiveAPIErrorType.TOOL_EXECUTION:
                        console.error('Tool execution failed:', error.message);
                        // Log and continue
                        break;
                    case LiveAPIErrorType.SESSION_CLOSED:
                        console.error('Session closed:', error.message);
                        // Reconnect or show disconnected UI
                        break;
                    case LiveAPIErrorType.PERMISSION_DENIED:
                        console.error('Permission denied:', error.message);
                        // Show permission instructions
                        break;
                }
            }
        }
    });

    try {
        await client.initialize();
        await client.startSession();
        await client.startCapture();
    } catch (error) {
        console.error('Failed to start voice mode:', error);
        client.cleanup();
        throw error;
    }

    return client;
}

/**
 * Example: Session lifecycle management
 */
async function exampleSessionLifecycle() {
    const client = new GeminiLiveClient({
        apiKey: 'YOUR_API_KEY'
    });

    // Initialize once
    await client.initialize();

    // Start first session
    await client.startSession();
    await client.startCapture();

    // ... conversation happens ...

    // Stop capture but keep session
    client.stopCapture();

    // Resume capture
    await client.startCapture();

    // ... more conversation ...

    // Stop session completely
    await client.stopSession();

    // Start a new session (reuse client)
    await client.startSession();
    await client.startCapture();

    // ... conversation ...

    // Final cleanup
    await client.stopSession();
    client.cleanup();
}

/**
 * Example: Tools disabled
 */
async function exampleWithoutTools() {
    const client = new GeminiLiveClient({
        apiKey: 'YOUR_API_KEY',
        enableTools: false // Disable tool calling
    });

    await client.initialize();
    await client.startSession();
    await client.startCapture();

    // Now AI will only respond with voice, no tool calls

    return client;
}

// Export examples for reference
export {
    exampleBasicUsage,
    exampleWithVisualization,
    exampleCustomSystemInstruction,
    exampleErrorHandling,
    exampleSessionLifecycle,
    exampleWithoutTools
};
