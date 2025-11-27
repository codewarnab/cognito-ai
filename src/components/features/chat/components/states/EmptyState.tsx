import React, { useEffect, useState } from 'react';
import { getTimeBasedGreeting } from '@/utils/ui';

interface EmptyStateProps {
    isLocalMode?: boolean;
    onConfigureApiKey?: () => void;
}

const TIPS = [
    "I can search and extract information from any webpage",
    "I work best when you give me clear, specific instructions",
    "I can browse the web and gather information from multiple sources",
    "You can copy and paste files directly into the chat input",
    "You can drag and drop files into the chat input",
    "Ask me to organize your tabs for you",
    "I can analyze YouTube videos for you",
    "You can send messages to Cognito by typing 'ai' in the address bar",
    "Set keyboard shortcuts at chrome://extensions/shortcuts for quick access",
    "Customize which AI tools are enabled in Settings → Enabled Tools",
    "Toggle suggested actions on/off in Settings ",
    "Choose between Gemini TTS or Web Native TTS in Settings",
    "Delete all chat history anytime from Settings ",
    "Control Ask AI button visibility per domain in Settings",
    "Enable Supermemory in Settings to let me remember things about you across conversations"
];

export const EmptyState: React.FC<EmptyStateProps> = ({ isLocalMode, onConfigureApiKey }) => {
    const [currentTip, setCurrentTip] = useState<string>('');
    const [greeting, setGreeting] = useState<string>('');

    useEffect(() => {
        // Set time-based greeting
        setGreeting(getTimeBasedGreeting());

        // Get and increment tip index from storage
        chrome.storage.local.get(['tipIndex'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Failed to get tip index:', chrome.runtime.lastError);
                setCurrentTip(TIPS[0] ?? '');
                return;
            }
            const currentIndex = result.tipIndex || 0;
            const nextIndex = (currentIndex + 1) % TIPS.length;

            setCurrentTip(TIPS[currentIndex] ?? TIPS[0] ?? '');

            // Store next index for next thread
            chrome.storage.local.set({ tipIndex: nextIndex }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to set tip index:', chrome.runtime.lastError);
                }
            });
        });
    }, []);

    return (
        <div className="copilot-empty-state" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            padding: '10px 0px',
            height: '100%',
            width: '100%',
        }}>
            <h1 style={{
                fontSize: '1.38rem',
                fontWeight: 600,
                lineHeight: 1.2,
                marginBottom: '8px',
                color: 'var(--text-primary)',
                textAlign: 'left',
                width: '100%',
                maxWidth: '100%',
                whiteSpace: 'pre-line',
            }}>
                {greeting}
            </h1>

            {currentTip && (
                <div style={{
                    fontSize: '0.95rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    marginBottom: '20px',
                    textAlign: 'left',
                    width: '100%',
                }}>
                    Tip: {currentTip}
                </div>
            )}

            {isLocalMode && onConfigureApiKey && (
                <div style={{
                    padding: '12px 16px',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(255, 152, 0, 0.08)',
                    border: '1px solid rgba(255, 152, 0, 0.2)',
                    borderRadius: '8px',
                }}>
                    <span style={{ fontSize: '14px' }}>⚠️</span>
                    <span>Local mode has limited functionality.</span>
                    <button
                        onClick={onConfigureApiKey}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#4a6fa5',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '0',
                            fontSize: 'inherit',
                            fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#5a7fb5';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#4a6fa5';
                        }}
                    >
                        Configure
                    </button>
                    <span>for better performance.</span>
                </div>
            )}
        </div>
    );
};
