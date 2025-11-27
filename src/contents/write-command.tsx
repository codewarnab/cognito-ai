/**
 * Write Command Content Script
 * Plasmo content script that enables the /write command in any input field
 * 
 * Usage: Type "/write" followed by your prompt in any text field
 * Example: "/write draft an email about the project delay"
 */
import type { PlasmoCSConfig } from 'plasmo';
import { useCallback, useState, useEffect, useRef } from 'react';
import cssText from 'data-text:~/styles/features/write-command.css';

import { useWriteCommandDetection } from './write-command/useWriteCommandDetection';
import { useTextInsertion } from './write-command/useTextInsertion';
import { WriterOverlay } from './write-command/WriterOverlay';
import { WriteCommandErrorBoundary } from './write-command/ErrorBoundary';
import { getPageContext } from './write-command/platformDetector';
import { getWriteCommandSettings } from '@/utils/settings';
import type { WriteStreamChunk, WriteError, WriteGenerateRequest, WriteAttachmentPayload } from '@/types';
import { createLogger } from '~logger';

const log = createLogger('WriteCommand');

export const config: PlasmoCSConfig = {
    matches: ['<all_urls>'],
    all_frames: true, // Enable for iframes (Gmail compose, etc.)
    // Note: chrome://, chrome-extension://, and moz-extension:// URLs are automatically
    // excluded by the browser - content scripts cannot run on these pages
};

export const getStyle = () => {
    const style = document.createElement('style');
    style.textContent = cssText;
    return style;
};

function WriteCommandContent() {
    const {
        isWriterMode,
        targetElement,
        cursorPosition,
        tooltipPosition,
        setIsWriterMode,
        isEnabled,
    } = useWriteCommandDetection();

    const { insertText } = useTextInsertion();

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedText, setGeneratedText] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Ref to track active port for cleanup
    const activePortRef = useRef<chrome.runtime.Port | null>(null);

    // Cleanup on unmount or page navigation only
    useEffect(() => {
        // Handle page navigation (beforeunload)
        const handleBeforeUnload = () => {
            if (activePortRef.current) {
                log.debug('Cleaning up active port on navigation');
                try {
                    activePortRef.current.disconnect();
                } catch {
                    // Port might already be disconnected
                }
                activePortRef.current = null;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        // Cleanup only on unmount
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (activePortRef.current) {
                log.debug('Cleaning up active port on unmount');
                try {
                    activePortRef.current.disconnect();
                } catch {
                    // Port might already be disconnected
                }
                activePortRef.current = null;
            }
        };
    }, []); // Empty dependency array - only run on mount/unmount

    // Handle text generation via background service worker
    const handleGenerate = useCallback(async (
        prompt: string,
        toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean; enableSupermemorySearch: boolean },
        attachment?: WriteAttachmentPayload
    ) => {
        // Allow generation with just an attachment (no text prompt required)
        if (!prompt.trim() && !attachment) return;

        // Disconnect any existing port
        if (activePortRef.current) {
            try {
                activePortRef.current.disconnect();
            } catch {
                // Ignore
            }
        }

        setIsGenerating(true);
        setGeneratedText('');
        setError(null);

        log.debug('Starting generation', { promptLength: prompt.length, toolSettings });

        try {
            // Check if extension context is still valid (important for iframes)
            if (!chrome.runtime?.id) {
                throw new Error('Extension context invalidated. Please refresh the page.');
            }

            // Get settings and page context
            const [settings, pageContext] = await Promise.all([
                getWriteCommandSettings(),
                Promise.resolve(getPageContext()),
            ]);

            // Connect to background via port for streaming
            const port = chrome.runtime.connect({ name: 'write-command' });
            activePortRef.current = port;

            // Handle incoming messages
            port.onMessage.addListener((message: WriteStreamChunk | WriteError) => {
                log.debug('Received message from background', { action: message.action, message });

                if (message.action === 'WRITE_STREAM_CHUNK') {
                    log.debug('Processing stream chunk', { text: message.text, done: message.done });
                    setGeneratedText((prev) => prev + message.text);
                    if (message.done) {
                        setIsGenerating(false);
                        activePortRef.current = null;
                        log.debug('Generation complete');
                    }
                } else if (message.action === 'WRITE_ERROR') {
                    setIsGenerating(false);
                    activePortRef.current = null;
                    setError(message.error);
                    log.error('Generation error', { error: message.error, code: message.code });
                }
            });

            // Handle disconnection
            port.onDisconnect.addListener(() => {
                // Check for runtime errors
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    log.error('Port disconnected with error', { error: lastError.message });
                    // Only show error if we're still generating (not a normal completion)
                    if (activePortRef.current) {
                        setError('Connection lost. Please try again.');
                    }
                } else {
                    // Normal disconnection (user closed overlay, navigated away, etc.)
                    log.debug('Port disconnected normally');
                }
                setIsGenerating(false);
                activePortRef.current = null;
            });

            // Send the request - use passed tool settings if available, fallback to stored settings
            const request: WriteGenerateRequest = {
                action: 'WRITE_GENERATE',
                payload: {
                    prompt,
                    pageContext: settings.includePageContext ? pageContext : undefined,
                    settings: {
                        tone: settings.defaultTone,
                        maxTokens: settings.maxOutputTokens,
                        enableUrlContext: toolSettings?.enableUrlContext ?? settings.enableUrlContext,
                        enableGoogleSearch: toolSettings?.enableGoogleSearch ?? settings.enableGoogleSearch,
                        enableSupermemorySearch: toolSettings?.enableSupermemorySearch ?? settings.enableSupermemorySearch,
                    },
                    // Include attachment if provided
                    attachment,
                },
            };

            port.postMessage(request);
        } catch (err) {
            setIsGenerating(false);
            activePortRef.current = null;
            const errorMessage = err instanceof Error ? err.message : 'Failed to connect to AI service';
            setError(errorMessage);
            log.error('Failed to start generation', { error: errorMessage });
        }
    }, []);

    // Handle close/cleanup
    const handleClose = useCallback(() => {
        setIsWriterMode(false);
        setGeneratedText('');
        setIsGenerating(false);
        setError(null);
    }, [setIsWriterMode]);

    // Handle text insertion
    const handleInsert = useCallback(async () => {
        if (targetElement && generatedText) {
            log.debug('Inserting text into element', {
                elementType: targetElement.tagName,
                textLength: generatedText.length,
            });

            const result = await insertText(targetElement, generatedText, cursorPosition);

            if (result.success) {
                log.info('Text inserted successfully');
                handleClose();
            } else if (result.fallbackUsed === 'clipboard') {
                // Text was copied to clipboard as fallback
                log.info('Text copied to clipboard as fallback');
                setError('Text copied to clipboard. Please paste manually (Ctrl+V / Cmd+V).');
                // Don't close overlay - let user see the message
            } else {
                setError(result.error || 'Failed to insert text. Please copy and paste manually.');
            }
        }
    }, [targetElement, generatedText, cursorPosition, insertText, handleClose]);

    // Don't render if feature is disabled or not in writer mode
    if (!isEnabled || !isWriterMode) {
        return null;
    }

    return (
        <WriteCommandErrorBoundary onClose={handleClose}>
            <WriterOverlay
                position={tooltipPosition}
                onGenerate={handleGenerate}
                onInsert={handleInsert}
                onClose={handleClose}
                isGenerating={isGenerating}
                generatedText={generatedText}
                error={error}
            />
        </WriteCommandErrorBoundary>
    );
}

export default WriteCommandContent;
