/**
 * Ask Overlay Component
 * Floating Q&A panel for the /ask command with multi-turn conversation
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AskMessageBubble } from './AskMessageBubble';
import { AskAttachmentPreview } from './AskAttachmentPreview';
import { useAskAttachment } from './useAskAttachment';
import { getAcceptedFileTypes } from './askAttachmentUtils';
import { ToolsToggle } from '../shared/ToolsToggle';
import { getAskCommandSettings, updateAskCommandSetting } from '@/utils/settings';
import { APP_ICON } from '@/constants';
import type { AskPosition, AskMessage, AskAttachmentPayload } from '@/types';

interface AskOverlayProps {
    position: AskPosition;
    messages: AskMessage[];
    currentAnswer: string;
    isGenerating: boolean;
    error: string | null;
    onAsk: (
        question: string,
        toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean; enableSupermemorySearch: boolean },
        attachment?: AskAttachmentPayload
    ) => void;
    onClose: () => void;
    onClearConversation: () => void;
    onCancelGeneration: () => void;
    onRetry?: () => void;
    /** Initial question to pre-fill (e.g., from context menu) */
    initialQuestion?: string;
}

// SVG Icons
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

const MessageCircleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
);

const AlertCircleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PaperclipIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path
            d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3,6 5,6 21,6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
);

const StopIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
);


export function AskOverlay({
    position,
    messages,
    currentAnswer,
    isGenerating,
    error,
    onAsk,
    onClose,
    onClearConversation,
    onCancelGeneration,
    onRetry,
    initialQuestion,
}: AskOverlayProps) {
    const [question, setQuestion] = useState(initialQuestion || '');
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [overlayPosition, setOverlayPosition] = useState(position);
    const [isFileDragOver, setIsFileDragOver] = useState(false);

    // Tool settings state
    const [enableUrlContext, setEnableUrlContext] = useState(false);
    const [enableGoogleSearch, setEnableGoogleSearch] = useState(false);
    const [enableSupermemorySearch, setEnableSupermemorySearch] = useState(false);
    const [supermemoryConfigured, setSupermemoryConfigured] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
    } = useAskAttachment({
        onError: (message) => {
            console.warn('[AskOverlay] Attachment error:', message);
        },
    });

    // Load tool settings on mount
    useEffect(() => {
        getAskCommandSettings()
            .then((settings) => {
                setEnableUrlContext(settings.enableUrlContext);
                setEnableGoogleSearch(settings.enableGoogleSearch);
                setEnableSupermemorySearch(settings.enableSupermemorySearch);
            })
            .catch(() => {
                // Use defaults on error
            });

        // Check if Supermemory is configured
        chrome.runtime.sendMessage({ type: 'CHECK_SUPERMEMORY_READY' }, (response) => {
            if (chrome.runtime.lastError) {
                setSupermemoryConfigured(false);
                return;
            }
            setSupermemoryConfigured(response?.ready ?? false);
        });
    }, []);

    // Handle tool setting changes
    const handleUrlContextChange = useCallback((enabled: boolean) => {
        setEnableUrlContext(enabled);
        void updateAskCommandSetting('enableUrlContext', enabled);
    }, []);

    const handleGoogleSearchChange = useCallback((enabled: boolean) => {
        setEnableGoogleSearch(enabled);
        void updateAskCommandSetting('enableGoogleSearch', enabled);
    }, []);

    const handleSupermemorySearchChange = useCallback((enabled: boolean) => {
        if (enabled && !supermemoryConfigured) return;
        setEnableSupermemorySearch(enabled);
        void updateAskCommandSetting('enableSupermemorySearch', enabled);
    }, [supermemoryConfigured]);

    // Update position when prop changes
    useEffect(() => {
        setOverlayPosition(position);
    }, [position]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentAnswer]);

    // Auto-focus on mount
    useEffect(() => {
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
            if (e.clipboardData?.files?.length) {
                handlePaste(e);
            }
        };

        inputEl.addEventListener('paste', handlePasteEvent);
        return () => inputEl.removeEventListener('paste', handlePasteEvent);
    }, [handlePaste]);

    // Handle submit - defined before keyboard shortcuts useEffect that depends on it
    const handleSubmitQuestion = useCallback(() => {
        if ((!question.trim() && !attachment) || isGenerating) return;

        onAsk(
            question,
            { enableUrlContext, enableGoogleSearch, enableSupermemorySearch },
            getAttachmentForApi()
        );
        setQuestion('');
        clearAttachment();
    }, [
        question,
        attachment,
        isGenerating,
        onAsk,
        enableUrlContext,
        enableGoogleSearch,
        enableSupermemorySearch,
        getAttachmentForApi,
        clearAttachment,
    ]);

    // Handle keyboard shortcuts on input
    const handleInputKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if ((question.trim() || attachment) && !isGenerating) {
                    handleSubmitQuestion();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        },
        [question, attachment, isGenerating, onClose, handleSubmitQuestion]
    );

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isDragging) return;

            const path = e.composedPath();
            const isInsideOverlay = path.some((el) => {
                if (el instanceof HTMLElement) {
                    if (el === overlayRef.current) return true;
                    if (el.classList?.contains('ask-overlay')) return true;
                    if (el.tagName === 'PLASMO-CSUI') return true;
                }
                return false;
            });

            if (isInsideOverlay) return;

            const target = e.target as HTMLElement;
            if (target.closest?.('.ask-overlay')) return;
            if (overlayRef.current?.contains(target)) return;

            if (!isGenerating) {
                onClose();
            }
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside, true);
        }, 200);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [isGenerating, isDragging, onClose]);

    // Dragging logic
    const handleDragStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            setIsDragging(true);
            setDragOffset({
                x: e.clientX - overlayPosition.x,
                y: e.clientY - overlayPosition.y,
            });
        },
        [overlayPosition]
    );

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

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            setIsFileDragOver(false);
            onFileDrop(e);
        },
        [onFileDrop]
    );

    const hasMessages = messages.length > 0 || currentAnswer;

    return (
        <div
            ref={overlayRef}
            className="ask-overlay"
            style={{
                left: `${overlayPosition.x}px`,
                top: `${overlayPosition.y}px`,
            }}
            role="dialog"
            aria-label="AI Ask"
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="ask-header">
                <div className="ask-drag-handle" onMouseDown={handleDragStart} title="Drag to move">
                    <GripVerticalIcon />
                </div>
                <span className="ask-title">
                    <span className="ask-title-icon">
                        <MessageCircleIcon />
                    </span>
                    Ask
                </span>
                <button
                    type="button"
                    className="ask-close"
                    onClick={onClose}
                    aria-label="Close"
                    title="Close (Esc)"
                >
                    <CloseIcon />
                </button>
            </div>

            {/* Messages Container */}
            <div className="ask-messages">
                {!hasMessages && (
                    <div className="ask-empty">
                        <img src={APP_ICON} alt="App logo" className="ask-empty-icon" />
                        <div className="ask-empty-text">Ask me anything</div>
                        <div className="ask-empty-hint">I can help answer questions about this page</div>
                    </div>
                )}

                {messages.map((msg) => (
                    <AskMessageBubble key={msg.id} message={msg} />
                ))}

                {/* Streaming response */}
                {isGenerating && currentAnswer && (
                    <AskMessageBubble
                        message={{
                            id: 'streaming',
                            role: 'assistant',
                            content: currentAnswer,
                            timestamp: Date.now(),
                        }}
                        isStreaming
                        streamingContent={currentAnswer}
                    />
                )}

                {/* Loading indicator */}
                {isGenerating && !currentAnswer && (
                    <div className="ask-loading">
                        <div className="ask-loading-dots">
                            <span />
                            <span />
                            <span />
                        </div>
                        <span className="ask-loading-text">Thinking...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Error State */}
            {error && (
                <div className="ask-error">
                    <AlertCircleIcon />
                    <span>{error}</span>
                    {onRetry && (
                        <button type="button" className="ask-error-retry" onClick={onRetry}>
                            Retry
                        </button>
                    )}
                </div>
            )}

            {/* Attachment Preview */}
            {attachment && (
                <AskAttachmentPreview
                    attachment={attachment}
                    onRemove={clearAttachment}
                    disabled={isGenerating}
                />
            )}

            {/* Input Row */}
            <div
                className={`ask-input-row ${isFileDragOver ? 'ask-input-row--dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className="ask-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder={attachment ? 'Ask about this file...' : 'Ask a question...'}
                    disabled={isGenerating}
                    autoComplete="off"
                />
                <button
                    type="button"
                    className={`ask-attach-button ${attachment ? 'ask-attach-button--active' : ''}`}
                    onClick={openFilePicker}
                    disabled={isGenerating || isProcessing}
                    title="Attach file"
                    aria-label="Attach file"
                >
                    <PaperclipIcon />
                </button>
                {isGenerating ? (
                    <button
                        type="button"
                        className="ask-stop-button"
                        onClick={onCancelGeneration}
                        title="Stop generating"
                        aria-label="Stop generating"
                    >
                        <StopIcon />
                    </button>
                ) : (
                    <button
                        type="button"
                        className="ask-send-button"
                        onClick={handleSubmitQuestion}
                        disabled={(!question.trim() && !attachment) || isGenerating}
                        title="Send (Enter)"
                        aria-label="Send question"
                    >
                        <SendIcon />
                    </button>
                )}
            </div>

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
            {isProcessing && <div className="ask-processing">Processing file...</div>}

            {/* Tools Toggle */}
            <div className="ask-tools-row">
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
                {hasMessages && (
                    <button
                        type="button"
                        className="ask-clear-button"
                        onClick={onClearConversation}
                        disabled={isGenerating}
                        title="Clear conversation"
                        aria-label="Clear conversation"
                    >
                        <TrashIcon />
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}
