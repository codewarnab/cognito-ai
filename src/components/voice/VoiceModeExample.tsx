/**
 * VoiceModeUI Usage Example
 * 
 * This file demonstrates how to integrate the VoiceModeUI component
 * into your Chrome extension side panel.
 */

import React, { useState } from 'react';
import { VoiceModeUI } from './VoiceModeUI';

/**
 * Example integration showing mode toggle between text and voice
 */
export const ExampleIntegration: React.FC = () => {
    const [mode, setMode] = useState<'text' | 'voice'>('text');
    const [apiKey, setApiKey] = useState('YOUR_GEMINI_API_KEY');

    const systemInstruction = `You are an intelligent AI assistant integrated into a Chrome browser extension.

You can help users with:
- Browser navigation and tab management
- Web page interaction (clicking, scrolling, filling forms)
- Information retrieval from the current page
- Managing browser history and bookmarks
- Setting reminders
- Remembering important information

Current context:
- Browser: Chrome
- Active tab: ${document.title}
- URL: ${window.location.href}

You have access to tools to perform these actions. When users ask you to do something, use the appropriate tools. Always confirm actions before executing them.

Be conversational, friendly, and helpful. Keep responses concise since this is a voice conversation.`;

    return (
        <div className="extension-container">
            {/* Mode Toggle */}
            <div className="mode-toggle">
                <button
                    className={mode === 'text' ? 'active' : ''}
                    onClick={() => setMode('text')}
                >
                    💬 Text
                </button>
                <button
                    className={mode === 'voice' ? 'active' : ''}
                    onClick={() => setMode('voice')}
                >
                    🎤 Voice
                </button>
            </div>

            {/* Conditional Rendering */}
            {mode === 'text' ? (
                <div className="text-mode">
                    {/* Your existing text chat component */}
                    <p>Text chat mode (existing implementation)</p>
                </div>
            ) : (
                <VoiceModeUI
                    apiKey={apiKey}
                    systemInstruction={systemInstruction}
                    onBack={() => setMode('text')}
                />
            )}
        </div>
    );
};

/**
 * Minimal example - Just voice mode
 */
export const MinimalExample: React.FC = () => {
    const apiKey = 'YOUR_GEMINI_API_KEY';

    return (
        <VoiceModeUI
            apiKey={apiKey}
            systemInstruction="You are a helpful voice assistant."
        />
    );
};

/**
 * Advanced example with API key management
 */
export const AdvancedExample: React.FC = () => {
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        // Load API key from chrome.storage
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            setApiKey(result.geminiApiKey || null);
            setIsLoading(false);
        });
    }, []);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!apiKey) {
        return (
            <div className="api-key-prompt">
                <h2>API Key Required</h2>
                <p>Please configure your Gemini API key in settings.</p>
            </div>
        );
    }

    return (
        <VoiceModeUI
            apiKey={apiKey}
            systemInstruction="You are a helpful voice assistant."
        />
    );
};

export default ExampleIntegration;
