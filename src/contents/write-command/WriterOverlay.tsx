/**
 * Writer Overlay Component
 * Floating panel for the /write command with input, output, and controls
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WritingAnimation } from './WritingAnimation';
import { WriterAttachmentPreview } from './WriterAttachmentPreview';
import { useWriterAttachment } from './useWriterAttachment';
import { getAcceptedFileTypes } from './writerAttachmentUtils';
import { ToolsToggle } from '../shared/ToolsToggle';
import { getWriteCommandSettings, updateWriteCommandSetting } from '@/utils/settings';
import type { WritePosition, WriteAttachmentPayload } from '@/types';

interface WriterOverlayProps {
    position: WritePosition;
    onGenerate: (
        prompt: string,
        toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean; enableSupermemorySearch: boolean },
        attachment?: WriteAttachmentPayload
    ) => void;
    onInsert: () => void;
    onClose: () => void;
    isGenerating: boolean;
    generatedText: string;
    error?: string | null;
    /** Whether there's an insertion target (editable field). When false, Insert button is hidden. */
    hasInsertionTarget?: boolean;
    /** Initial prompt text (e.g., from context menu selection) */
    initialPrompt?: string;
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

const PaperclipIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
            strokeLinecap="round" strokeLinejoin="round" />
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
    hasInsertionTarget = true,
    initialPrompt,
}: WriterOverlayProps) {
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [overlayPosition, setOverlayPosition] = useState(position);
    const [copied, setCopied] = useState(false);
    const [maxOutputHeight, setMaxOutputHeight] = useState(300);

    // Tool settings state
    const [enableUrlContext, setEnableUrlContext] = useState(false);
    const [enableGoogleSearch, setEnableGoogleSearch] = useState(false);
    const [enableSupermemorySearch, setEnableSupermemorySearch] = useState(false);
    const [supermemoryConfigured, setSupermemoryConfigured] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Attachment hook
    const {
        attachment,
        isProcessing,
        fileInputRef,
        handleFileChange,
        handleFileDrop: onFileDrop,
        handlePaste,
        clearAttachment,
        openFilePicker,
        getAttachmentForApi,
    } = useWriterAttachment({
        onError: (message) => {
            // Could integrate with existing error state if needed
            console.warn('[WriterOverlay] Attachment error:', message);
        },
    });

    // Drag state for file drop
    const [isFileDragOver, setIsFileDragOver] = useState(false);

    // Load tool settings on mount
    useEffect(() => {
        // Load write command settings
        getWriteCommandSettings().then((settings) => {
            setEnableUrlContext(settings.enableUrlContext);
            setEnableGoogleSearch(settings.enableGoogleSearch);
            setEnableSupermemorySearch(settings.enableSupermemorySearch);
        }).catch(() => {
            // Use defaults on error
        });

        // Check if Supermemory is configured
        // This is done via message to background since content scripts can't access storage directly
        chrome.runtime.sendMessage({ type: 'CHECK_SUPERMEMORY_READY' }, (response) => {
            if (chrome.runtime.lastError) {
                // Fallback to not configured
                setSupermemoryConfigured(false);
                return;
            }
            setSupermemoryConfigured(response?.ready ?? false);
        });
    }, []);

    // Handle tool setting changes
    const handleUrlContextChange = useCallback((enabled: boolean) => {
        setEnableUrlContext(enabled);
        void updateWriteCommandSetting('enableUrlContext', enabled);
    }, []);

    const handleGoogleSearchChange = useCallback((enabled: boolean) => {
        setEnableGoogleSearch(enabled);
        void updateWriteCommandSetting('enableGoogleSearch', enabled);
    }, []);

    const handleSupermemorySearchChange = useCallback((enabled: boolean) => {
        // Only allow enabling if Supermemory is configured
        if (enabled && !supermemoryConfigured) return;
        setEnableSupermemorySearch(enabled);
        void updateWriteCommandSetting('enableSupermemorySearch', enabled);
    }, [supermemoryConfigured]);

    // Update position when prop changes and constrain to viewport
    useEffect(() => {
        setOverlayPosition(position);
    }, [position]);

    // Update prompt when initialPrompt changes (e.g., from context menu)
    useEffect(() => {
        if (initialPrompt !== undefined) {
            setPrompt(initialPrompt);
        }
    }, [initialPrompt]);

    // Constrain overlay to viewport and calculate dynamic output height
    useEffect(() => {
        const constrainToViewport = () => {
            if (!overlayRef.current) return;

            const overlay = overlayRef.current;
            const rect = overlay.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const padding = 16; // Padding from viewport edges

            let newX = overlayPosition.x;
            let newY = overlayPosition.y;

            // Constrain horizontally
            if (rect.right > viewportWidth - padding) {
                newX = viewportWidth - rect.width - padding;
            }
            if (newX < padding) {
                newX = padding;
            }

            // Constrain vertically
            if (rect.bottom > viewportHeight - padding) {
                newY = viewportHeight - rect.height - padding;
            }
            if (newY < padding) {
                newY = padding;
            }

            // Update position if constrained
            if (newX !== overlayPosition.x || newY !== overlayPosition.y) {
                setOverlayPosition({ x: newX, y: newY });
            }

            // Calculate available space for output area
            // Base height (header + input + tools + actions) is approximately 180px
            const baseOverlayHeight = 180;
            const availableHeight = viewportHeight - newY - padding - baseOverlayHeight;
            const newMaxHeight = Math.max(100, Math.min(400, availableHeight));
            setMaxOutputHeight(newMaxHeight);
        };

        // Run after render to get accurate measurements
        const timer = requestAnimationFrame(constrainToViewport);

        // Also handle window resize
        window.addEventListener('resize', constrainToViewport);

        return () => {
            cancelAnimationFrame(timer);
            window.removeEventListener('resize', constrainToViewport);
        };
    }, [overlayPosition.x, overlayPosition.y, generatedText]);

    // Auto-focus on mount
    useEffect(() => {
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Paste listener for images
    useEffect(() => {
        const inputEl = inputRef.current;
        if (!inputEl) return;

        const handlePasteEvent = (e: ClipboardEvent) => {
            // Check if there are files in clipboard
            if (e.clipboardData?.files?.length) {
                handlePaste(e);
            }
        };

        inputEl.addEventListener('paste', handlePasteEvent);
        return () => inputEl.removeEventListener('paste', handlePasteEvent);
    }, [handlePaste]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if overlay is focused
            if (!overlayRef.current?.contains(document.activeElement)) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if ((prompt.trim() || attachment) && !isGenerating) {
                    onGenerate(
                        prompt,
                        { enableUrlContext, enableGoogleSearch, enableSupermemorySearch },
                        getAttachmentForApi()
                    );
                    clearAttachment();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [prompt, attachment, isGenerating, onGenerate, onClose, enableUrlContext, enableGoogleSearch, enableSupermemorySearch, getAttachmentForApi, clearAttachment]);

    // Handle click outside - check if click target is part of the overlay
    // Uses composedPath() to properly traverse Shadow DOM boundaries (Plasmo renders in shadow DOM)
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // Don't close if we're in the middle of dragging
            if (isDragging) return;

            const target = e.target as HTMLElement;

            // Use composedPath() to traverse through Shadow DOM boundaries
            // This is critical because Plasmo content scripts render inside a Shadow DOM (plasmo-csui)
            const path = e.composedPath();

            // Check if any element in the path is our overlay
            const isInsideOverlay = path.some((el) => {
                if (el instanceof HTMLElement) {
                    // Check by ref
                    if (el === overlayRef.current) return true;
                    // Check by class (works inside shadow DOM)
                    if (el.classList?.contains('writer-overlay')) return true;
                    // Check if it's a plasmo container (shadow host)
                    if (el.tagName === 'PLASMO-CSUI') return true;
                }
                return false;
            });

            if (isInsideOverlay) {
                return; // Click is inside overlay, don't close
            }

            // Fallback: Also check the direct target for non-shadow DOM contexts
            if (target.closest?.('.writer-overlay')) {
                return;
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
            onGenerate(prompt, { enableUrlContext, enableGoogleSearch, enableSupermemorySearch });
        }
    };

    // Handle submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if ((prompt.trim() || attachment) && !isGenerating) {
            onGenerate(
                prompt,
                { enableUrlContext, enableGoogleSearch, enableSupermemorySearch },
                getAttachmentForApi()
            );
            clearAttachment();
        }
    };

    // Handle button click with propagation stop
    const handleSendClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if ((prompt.trim() || attachment) && !isGenerating) {
            onGenerate(
                prompt,
                { enableUrlContext, enableGoogleSearch, enableSupermemorySearch },
                getAttachmentForApi()
            );
            clearAttachment();
        }
    };

    // Handle file drag events
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsFileDragOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsFileDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        setIsFileDragOver(false);
        onFileDrop(e);
    }, [onFileDrop]);

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
            onMouseDown={(e) => e.stopPropagation()}
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

            {/* Attachment Preview */}
            {attachment && (
                <WriterAttachmentPreview
                    attachment={attachment}
                    onRemove={clearAttachment}
                    disabled={isGenerating}
                />
            )}

            {/* Input Row */}
            <form
                className={`writer-input-row${attachment ? ' writer-input-row--has-attachment' : ''}${isFileDragOver ? ' writer-input-row--dragover' : ''}`}
                onSubmit={handleSubmit}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className="writer-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={attachment ? "Describe what to write..." : "What would you like me to write?"}
                    disabled={isGenerating}
                    autoComplete="off"
                />
                <button
                    type="button"
                    className={`writer-attach-button ${attachment ? 'writer-attach-button--active' : ''}`}
                    onClick={openFilePicker}
                    disabled={isGenerating || isProcessing}
                    title="Attach file (image or PDF)"
                    aria-label="Attach file"
                >
                    <PaperclipIcon />
                </button>
                <button
                    type="button"
                    className="writer-send-button"
                    onClick={handleSendClick}
                    disabled={(!prompt.trim() && !attachment) || isGenerating}
                    title="Generate (Enter)"
                >
                    <SendIcon />
                </button>
            </form>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept={getAcceptedFileTypes()}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                aria-hidden="true"
            />

            {/* Processing indicator */}
            {isProcessing && (
                <div className="writer-processing">Processing file...</div>
            )}

            {/* Tools Toggle - Inline Settings */}
            <div className="writer-tools-row">
                <ToolsToggle
                    enableUrlContext={enableUrlContext}
                    enableGoogleSearch={enableGoogleSearch}
                    enableSupermemorySearch={enableSupermemorySearch}
                    onUrlContextChange={handleUrlContextChange}
                    onGoogleSearchChange={handleGoogleSearchChange}
                    onSupermemorySearchChange={handleSupermemorySearchChange}
                    supermemoryConfigured={supermemoryConfigured}
                    disabled={isGenerating}
                />
            </div>

            {/* Loading State - Skeleton Animation */}
            {isGenerating && !generatedText && (
                <div className="writer-loading">
                    <WritingAnimation />
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
                <div
                    className="writer-output"
                    style={{ maxHeight: `${maxOutputHeight}px` }}
                >
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
                    {hasInsertionTarget && (
                        <button
                            className="writer-action-button writer-action-button--primary"
                            onClick={onInsert}
                        >
                            Insert
                        </button>
                    )}
                </div>
            )}

        </div>
    );
}
