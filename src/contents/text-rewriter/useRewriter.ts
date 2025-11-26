/**
 * Rewriter Hook
 * Handles port communication with background service for non-streaming text rewriting
 */
import { useCallback, useState, useRef } from 'react';
import { getRewriteSettings } from '@/utils/settings/rewriteSettings';
import type { RewriteMessage, RewritePreset, RewriteRequest } from '@/types';
import { createLogger } from '~logger';

const log = createLogger('UseRewriter');

interface RewriterState {
    rewrittenText: string;
    isProcessing: boolean;
    error: string | null;
}

export function useRewriter() {
    const [state, setState] = useState<RewriterState>({
        rewrittenText: '',
        isProcessing: false,
        error: null,
    });

    const portRef = useRef<chrome.runtime.Port | null>(null);

    /**
     * Replace selected text with new text
     * Tries execCommand first for rich editors, falls back to DOM manipulation
     */
    const replaceSelection = useCallback((range: Range, newText: string): boolean => {
        try {
            // First, restore the selection from the saved range
            const sel = window.getSelection();
            if (!sel) return false;

            sel.removeAllRanges();
            sel.addRange(range);

            // Try execCommand for better rich editor compatibility (Gmail, etc.)
            if (document.execCommand('insertText', false, newText)) {
                log.debug('Text replaced using execCommand');
                return true;
            }

            // Fallback: Direct DOM manipulation
            range.deleteContents();
            range.insertNode(document.createTextNode(newText));

            // Collapse selection to end of inserted text
            sel.removeAllRanges();
            const newRange = document.createRange();
            newRange.setStartAfter(range.endContainer);
            newRange.collapse(true);
            sel.addRange(newRange);

            log.debug('Text replaced using DOM manipulation');
            return true;
        } catch (error) {
            log.error('Failed to replace selection', error);
            return false;
        }
    }, []);

    /**
     * Start rewrite process - sends request to background
     * @param text - Text to rewrite
     * @param instruction - Optional custom instruction
     * @param preset - Optional preset to use
     * @param toolSettings - Optional override for tool settings (from inline toggles)
     */
    const rewrite = useCallback(async (
        text: string,
        instruction?: string,
        preset?: RewritePreset,
        toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean }
    ) => {
        // Disconnect any existing port
        if (portRef.current) {
            try {
                portRef.current.disconnect();
            } catch {
                // Ignore disconnect errors
            }
            portRef.current = null;
        }

        setState({
            rewrittenText: '',
            isProcessing: true,
            error: null,
        });

        log.debug('Starting rewrite', { textLength: text.length, preset, hasInstruction: !!instruction });

        try {
            // Check extension context is valid
            if (!chrome.runtime?.id) {
                throw new Error('Extension context invalidated. Please refresh the page.');
            }

            // Get settings for tool configuration (can be overridden by inline toggles)
            const settings = await getRewriteSettings();

            // Use inline toggle settings if provided, otherwise fall back to stored settings
            const enableUrlContext = toolSettings?.enableUrlContext ?? settings.enableUrlContext;
            const enableGoogleSearch = toolSettings?.enableGoogleSearch ?? settings.enableGoogleSearch;

            // Connect to background via port
            const port = chrome.runtime.connect({ name: 'text-rewriter' });
            portRef.current = port;

            // Handle incoming messages
            port.onMessage.addListener((message: RewriteMessage) => {
                log.debug('Received message', { action: message.action });

                if (message.action === 'REWRITE_COMPLETE') {
                    // Non-streaming: receive complete text at once
                    setState({
                        rewrittenText: message.text,
                        isProcessing: false,
                        error: null,
                    });
                    portRef.current = null;
                    log.info('Rewrite complete', { outputLength: message.text.length });
                } else if (message.action === 'REWRITE_ERROR') {
                    setState({
                        rewrittenText: '',
                        isProcessing: false,
                        error: message.error,
                    });
                    portRef.current = null;
                    log.error('Rewrite error', { error: message.error });
                }
            });

            // Handle disconnection
            port.onDisconnect.addListener(() => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    log.error('Port disconnected with error', { error: lastError.message });
                    setState((prev) => {
                        // Only show error if we were still processing
                        if (prev.isProcessing) {
                            return {
                                ...prev,
                                isProcessing: false,
                                error: 'Connection lost. Please try again.',
                            };
                        }
                        return prev;
                    });
                }
                portRef.current = null;
            });

            // Build and send request
            const request: RewriteRequest = {
                action: 'REWRITE_REQUEST',
                payload: {
                    selectedText: text,
                    instruction: instruction || '',
                    preset,
                    enableUrlContext,
                    enableGoogleSearch,
                },
            };

            port.postMessage(request);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to connect to AI service';
            setState({
                rewrittenText: '',
                isProcessing: false,
                error: errorMessage,
            });
            portRef.current = null;
            log.error('Failed to start rewrite', { error: errorMessage });
        }
    }, []);

    /**
     * Reset state and cleanup
     */
    const reset = useCallback(() => {
        setState({
            rewrittenText: '',
            isProcessing: false,
            error: null,
        });

        if (portRef.current) {
            try {
                portRef.current.disconnect();
            } catch {
                // Ignore disconnect errors
            }
            portRef.current = null;
        }
    }, []);

    return {
        ...state,
        rewrite,
        replaceSelection,
        reset,
    };
}
