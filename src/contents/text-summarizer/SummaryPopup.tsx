import { useState, useEffect, useRef, useCallback } from 'react';
import type { Position } from './useTextSelection';

interface SummaryPopupProps {
    position: Position;
    summary: string;
    isLoading: boolean;
    isStreaming: boolean;
    error: string | null;
    onClose: () => void;
}

export function SummaryPopup({
    position,
    summary,
    isLoading,
    isStreaming,
    error,
    onClose,
}: SummaryPopupProps) {
    const [copied, setCopied] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    // Calculate position to keep popup in viewport
    const getAdjustedPosition = useCallback(() => {
        const padding = 16;
        const popupWidth = 380;
        const popupHeight = 300;

        let adjustedX = position.x;
        let adjustedY = position.y + 40; // Below the button

        // Adjust horizontal position
        if (adjustedX + popupWidth > window.innerWidth - padding) {
            adjustedX = window.innerWidth - popupWidth - padding;
        }
        if (adjustedX < padding) {
            adjustedX = padding;
        }

        // Adjust vertical position
        if (adjustedY + popupHeight > window.innerHeight + window.scrollY - padding) {
            adjustedY = position.y - popupHeight - 8; // Above the selection
        }

        return { x: adjustedX, y: adjustedY };
    }, [position.x, position.y]);

    const adjustedPos = getAdjustedPosition();

    // Handle copy to clipboard
    const handleCopy = async (e: React.MouseEvent) => {
        // Prevent event from bubbling up and triggering click outside handler
        e.stopPropagation();
        e.preventDefault();

        try {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Silently fail - button will just not change state
        }
    };

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        // Handle escape key
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <>
            <div
                ref={popupRef}
                className="summary-popup"
                style={{
                    left: `${adjustedPos.x}px`,
                    top: `${adjustedPos.y}px`,
                }}
            >
                {/* Header */}
                <div className="summary-popup__header">
                    <h2 className="summary-popup__title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
                        </svg>
                        Summary
                    </h2>
                    <button
                        className="summary-popup__close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                {isLoading && !summary ? (
                    <div className="summary-popup__loading">
                        <div className="summary-popup__shimmer">
                            <div className="summary-popup__shimmer-line" />
                            <div className="summary-popup__shimmer-line" />
                            <div className="summary-popup__shimmer-line" />
                            <div className="summary-popup__shimmer-line" />
                        </div>
                    </div>
                ) : error ? (
                    <div className="summary-popup__content">
                        <div className="summary-popup__error">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    </div>
                ) : (
                    <div className="summary-popup__content">
                        <p className="summary-popup__text">
                            {summary}
                            {isStreaming && <span className="summary-popup__cursor">▊</span>}
                        </p>
                    </div>
                )}

                {/* Actions - only show when we have summary */}
                {summary && !error && (
                    <div className="summary-popup__actions">
                        <button
                            className={`summary-popup__action-button ${copied ? 'summary-popup__action-button--success' : ''}`}
                            onClick={handleCopy}
                            onMouseDown={(e) => e.stopPropagation()}
                            disabled={isStreaming || copied}
                        >
                            {copied ? (
                                <>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" />
                                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                    </svg>
                                    Copy
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
