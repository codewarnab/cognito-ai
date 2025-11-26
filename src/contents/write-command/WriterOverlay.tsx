/**
 * Writer Overlay Component
 * Floating panel for the /write command with input, output, and controls
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WritingAnimation } from './WritingAnimation';
import type { WritePosition } from '@/types';

interface WriterOverlayProps {
    position: WritePosition;
    onGenerate: (prompt: string) => void;
    onInsert: () => void;
    onClose: () => void;
    isGenerating: boolean;
    generatedText: string;
    error?: string | null;
}

// SVG Icons as inline components for bundle size
const GripVerticalIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="5" r="1" fill="currentColor" />
        <circle cx="9" cy="12" r="1" fill="currentColor" />
        <circle cx="9" cy="19" r="1" fill="currentColor" />
        <circle cx="15" cy="5" r="1" fill="currentColor" />
        <circle cx="15" cy="12" r="1" fill="currentColor" />
        <circle cx="15" cy="19" r="1" fill="currentColor" />
    </svg>
);

const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SendIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PenLineIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const AlertCircleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CopyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
);

const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const RefreshIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 4v6h6M23 20v-6h-6" />
        <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export function WriterOverlay({
    position,
    onGenerate,
    onInsert,
    onClose,
    isGenerating,
    generatedText,
    error,
}: WriterOverlayProps) {
    const [prompt, setPrompt] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [overlayPosition, setOverlayPosition] = useState(position);
    const [copied, setCopied] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Update position when prop changes
    useEffect(() => {
        setOverlayPosition(position);
    }, [position]);

    // Auto-focus on mount
    useEffect(() => {
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if overlay is focused
            if (!overlayRef.current?.contains(document.activeElement)) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (generatedText && !isGenerating) {
                    onInsert();
                } else if (prompt.trim() && !isGenerating) {
                    onGenerate(prompt);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [prompt, generatedText, isGenerating, onGenerate, onInsert, onClose]);

    // Handle click outside - check if click target is part of the overlay
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // Don't close if we're in the middle of dragging
            if (isDragging) return;

            const target = e.target as HTMLElement;

            // Check if click is on the overlay or any of its children
            // Use closest() to handle clicks on nested elements like SVG icons
            if (target.closest('.writer-overlay')) {
                return; // Click is inside overlay, don't close
            }

            // Also check using the ref as a fallback
            if (overlayRef.current && overlayRef.current.contains(target)) {
                return; // Click is inside overlay, don't close
            }

            // Don't close if generating
            if (!isGenerating) {
                onClose();
            }
        };

        // Delay adding listener to prevent immediate close on mount
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside, true); // Use capture phase
        }, 200);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [isGenerating, isDragging, onClose]);

    // Dragging logic
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - overlayPosition.x,
            y: e.clientY - overlayPosition.y,
        });
    }, [overlayPosition]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            setOverlayPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y,
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    // Handle copy
    const handleCopy = async () => {
        if (!generatedText) return;
        try {
            await navigator.clipboard.writeText(generatedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Silently fail
        }
    };

    // Handle regenerate
    const handleRegenerate = () => {
        if (prompt.trim()) {
            onGenerate(prompt);
        }
    };

    // Handle submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (prompt.trim() && !isGenerating) {
            onGenerate(prompt);
        }
    };

    // Handle button click with propagation stop
    const handleSendClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (prompt.trim() && !isGenerating) {
            onGenerate(prompt);
        }
    };

    return (
        <div
            ref={overlayRef}
            className="writer-overlay"
            style={{
                left: `${overlayPosition.x}px`,
                top: `${overlayPosition.y}px`,
            }}
            role="dialog"
            aria-label="AI Writer"
        >
            {/* Header */}
            <div className="writer-header">
                <div
                    className="writer-drag-handle"
                    onMouseDown={handleDragStart}
                    title="Drag to move"
                >
                    <GripVerticalIcon />
                </div>
                <span className="writer-title">
                    <span className="writer-title-icon"><PenLineIcon /></span>
                    Writer
                </span>
                <button
                    className="writer-close"
                    onClick={onClose}
                    aria-label="Close"
                    title="Close (Esc)"
                >
                    <CloseIcon />
                </button>
            </div>

            {/* Input Row */}
            <form className="writer-input-row" onSubmit={handleSubmit}>
                <input
                    ref={inputRef}
                    type="text"
                    className="writer-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="What would you like me to write?"
                    disabled={isGenerating}
                    autoComplete="off"
                />
                <button
                    type="button"
                    className="writer-send-button"
                    onClick={handleSendClick}
                    disabled={!prompt.trim() || isGenerating}
                    title="Generate (Enter)"
                >
                    <SendIcon />
                </button>
            </form>

            {/* Loading State */}
            {isGenerating && !generatedText && (
                <div className="writer-loading">
                    <WritingAnimation />
                    <span className="writer-loading-text">Writing...</span>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="writer-error">
                    <AlertCircleIcon />
                    <span>{error}</span>
                    <button
                        className="writer-error-retry"
                        onClick={handleRegenerate}
                        disabled={!prompt.trim()}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Output Display */}
            {generatedText && (
                <div className="writer-output">
                    <p className="writer-output-text">
                        {generatedText}
                        {isGenerating && <span className="writer-cursor">▌</span>}
                    </p>
                </div>
            )}

            {/* Hint / Actions */}
            {generatedText && !isGenerating && (
                <div className="writer-actions">
                    <button
                        className="writer-action-button"
                        onClick={handleCopy}
                        disabled={copied}
                    >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                        className="writer-action-button"
                        onClick={handleRegenerate}
                        disabled={!prompt.trim()}
                    >
                        <RefreshIcon />
                        Regenerate
                    </button>
                    <button
                        className="writer-action-button writer-action-button--primary"
                        onClick={onInsert}
                    >
                        Insert
                    </button>
                </div>
            )}

            {/* Keyboard hint when output ready */}
            {generatedText && !isGenerating && (
                <div className="writer-hint">
                    Press <kbd>Enter</kbd> to insert
                </div>
            )}
        </div>
    );
}
