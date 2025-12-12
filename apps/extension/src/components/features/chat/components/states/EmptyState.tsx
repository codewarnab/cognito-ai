import React, { useEffect, useState } from 'react';

import { getTimeBasedGreeting } from '@/utils/ui';

import { TIPS } from './tips';

interface EmptyStateProps {
    isLocalMode?: boolean;
    onConfigureApiKey?: () => void;
}

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
        <div
            className="copilot-empty-state flex flex-col items-start justify-start h-full w-full"
            style={{ padding: '10px 0px' }}
        >
            <h1
                className="font-semibold leading-tight mb-2 text-left w-full max-w-full whitespace-pre-line"
                style={{
                    fontSize: '1.38rem',
                    color: 'var(--text-primary)',
                }}
            >
                {greeting}
            </h1>

            {currentTip && (
                <div
                    className="leading-normal mb-5 text-left w-full"
                    style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-secondary)',
                    }}
                >
                    Tip: {currentTip}
                </div>
            )}

            {isLocalMode && onConfigureApiKey && (
                <div
                    className="flex flex-wrap items-center gap-1.5 px-4 py-3 text-sm rounded-lg"
                    style={{
                        color: 'var(--text-secondary)',
                        backgroundColor: 'rgba(255, 152, 0, 0.08)',
                        border: '1px solid rgba(255, 152, 0, 0.2)',
                    }}
                >
                    <span className="text-sm">⚠️</span>
                    <span>Local mode has limited functionality.</span>
                    <button
                        onClick={onConfigureApiKey}
                        className="bg-transparent border-none cursor-pointer underline p-0 text-[inherit] font-medium hover:opacity-80"
                        style={{ color: '#4a6fa5' }}
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
