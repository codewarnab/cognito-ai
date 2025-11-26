import { useCallback, useState, useRef } from 'react';
import { getTextSummarizerSettings } from '@/utils/settings';
import type { SummarizeRequest, SummarizeMessage } from '@/types';

interface SummarizerState {
    summary: string;
    isLoading: boolean;
    isStreaming: boolean;
    error: string | null;
}

const MAX_TEXT_LENGTH = 10000;

export function useSummarizer() {
    const [state, setState] = useState<SummarizerState>({
        summary: '',
        isLoading: false,
        isStreaming: false,
        error: null,
    });

    const portRef = useRef<chrome.runtime.Port | null>(null);

    const resetSummary = useCallback(() => {
        // Disconnect existing port if any
        if (portRef.current) {
            portRef.current.disconnect();
            portRef.current = null;
        }

        setState({
            summary: '',
            isLoading: false,
            isStreaming: false,
            error: null,
        });
    }, []);

    const summarize = useCallback(async (text: string) => {
        if (!text) return;

        // Truncate very long text
        let processedText = text;
        if (text.length > MAX_TEXT_LENGTH) {
            processedText = text.slice(0, MAX_TEXT_LENGTH);
            console.warn(`Text truncated from ${text.length} to ${MAX_TEXT_LENGTH} chars`);
        }

        // Reset and start loading
        setState({
            summary: '',
            isLoading: true,
            isStreaming: false,
            error: null,
        });

        try {
            // Get settings
            const settings = await getTextSummarizerSettings();

            // Get page context
            const pageContext = {
                title: document.title,
                url: window.location.href,
                domain: window.location.hostname,
            };

            // Connect to background via port for streaming
            const port = chrome.runtime.connect({ name: 'text-summarizer' });
            portRef.current = port;

            port.onMessage.addListener((message: SummarizeMessage) => {
                if (message.action === 'SUMMARIZE_STREAM_CHUNK') {
                    setState((prev) => ({
                        ...prev,
                        summary: prev.summary + message.text,
                        isLoading: false,
                        isStreaming: !message.done,
                    }));
                } else if (message.action === 'SUMMARIZE_ERROR') {
                    setState({
                        summary: '',
                        isLoading: false,
                        isStreaming: false,
                        error: message.error,
                    });
                }
            });

            port.onDisconnect.addListener(() => {
                portRef.current = null;
                // Handle unexpected disconnection during streaming
                setState((prev) => {
                    if (prev.isLoading || prev.isStreaming) {
                        return {
                            ...prev,
                            isLoading: false,
                            isStreaming: false,
                            error: prev.summary ? null : 'Connection lost',
                        };
                    }
                    return prev;
                });
            });

            // Send request
            const request: SummarizeRequest = {
                action: 'SUMMARIZE_REQUEST',
                payload: {
                    text: processedText,
                    pageContext,
                    settings: {
                        summaryType: settings.summaryType,
                        summaryLength: settings.summaryLength,
                    },
                },
            };

            port.postMessage(request);
        } catch (error) {
            setState({
                summary: '',
                isLoading: false,
                isStreaming: false,
                error: error instanceof Error ? error.message : 'Failed to start summarization',
            });
        }
    }, []);

    return {
        ...state,
        summarize,
        resetSummary,
    };
}
