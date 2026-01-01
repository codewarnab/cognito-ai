import React, { useEffect, useState } from 'react';

import { getTimeBasedGreeting } from '@/utils/ui';
import { useCodeModeStore } from '@/stores/codeMode/codeModeStore';

import { TIPS, CODE_MODE_TIPS } from './tips';

interface EmptyStateProps {
    isLocalMode?: boolean;
    onConfigureApiKey?: () => void;
}

// Regex to match URLs (including chrome:// URLs)
const URL_REGEX = /(https?:\/\/[^\s]+?(?=[.,;:!?)}\]]*(?:\s|$))|chrome:\/\/[^\s]+?(?=[.,;:!?)}\]]*(?:\s|$)))/g;

// Parse tip text and convert URLs to clickable elements
const renderTipWithLinks = (tip: string): React.ReactNode => {
    const parts = tip.split(URL_REGEX);
    const matches: string[] = tip.match(URL_REGEX) ?? [];

    if (matches.length === 0) {
        return tip;
    }

    const result: React.ReactNode[] = [];

    parts.forEach((part, index) => {
        if (part && matches.includes(part)) {
            result.push(
                <button
                    key={`link-${index}`}
                    onClick={() => {
                        if (part.startsWith('chrome://')) {
                            // Chrome internal URLs need to be opened via chrome.tabs API
                            chrome.tabs.create({ url: part });
                        } else {
                            window.open(part, '_blank', 'noopener,noreferrer');
                        }
                    }}
                    className="bg-transparent border-none cursor-pointer underline p-0 text-[inherit] font-medium hover:opacity-80 inline"
                    style={{ color: '#4a9eff' }}
                >
                    {part}
                </button>
            );
        } else if (part) {
            result.push(<span key={`text-${index}`}>{part}</span>);
        }
    });

    return result;
};

export const EmptyState: React.FC<EmptyStateProps> = ({ isLocalMode, onConfigureApiKey }) => {
    const [currentTip, setCurrentTip] = useState<string>('');
    const [greeting, setGreeting] = useState<string>('');
    const bridgeStatus = useCodeModeStore((s) => s.bridgeStatus);

    // Determine which tips array to use based on code mode
    const isCodeMode = bridgeStatus === 'connected';
    const tipsArray = isCodeMode ? CODE_MODE_TIPS : TIPS;
    const storageKey = isCodeMode ? 'codeModeTipIndex' : 'tipIndex';

    useEffect(() => {
        // Set time-based greeting
        setGreeting(getTimeBasedGreeting(isCodeMode));

        // Get and increment tip index from storage
        chrome.storage.local.get([storageKey], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Failed to get tip index:', chrome.runtime.lastError);
                setCurrentTip(tipsArray[0] ?? '');
                return;
            }
            const currentIndex = result[storageKey] || 0;
            const nextIndex = (currentIndex + 1) % tipsArray.length;

            setCurrentTip(tipsArray[currentIndex] ?? tipsArray[0] ?? '');

            // Store next index for next thread
            chrome.storage.local.set({ [storageKey]: nextIndex }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to set tip index:', chrome.runtime.lastError);
                }
            });
        });
    }, [isCodeMode, tipsArray, storageKey]);

    return (
        <div
            className="flex flex-col items-start justify-start h-full w-full"
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
                    💡 {renderTipWithLinks(currentTip)}
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
