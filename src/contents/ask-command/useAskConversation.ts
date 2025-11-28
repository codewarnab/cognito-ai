/**
 * Ask Conversation Hook
 * Manages multi-turn conversation state and port communication with background service worker
 *
 * Features:
 * - Multi-turn conversation history
 * - Streaming response handling
 * - Tool settings override per-question
 * - Attachment support
 * - Graceful port disconnection handling
 */
import { useState, useCallback, useRef } from 'react';
import type {
    AskMessage,
    AskPageContext,
    AskStreamChunk,
    AskError,
    AskAttachmentPayload,
    AskGenerateRequest,
} from '@/types';
import { getAskCommandSettings } from '@/utils/settings';
import { createLogger } from '~logger';

const log = createLogger('AskConversation');

interface ToolSettings {
    enableUrlContext: boolean;
    enableGoogleSearch: boolean;
    enableSupermemorySearch: boolean;
}

interface UseAskConversationOptions {
    pageContext?: AskPageContext;
}

export function useAskConversation(options: UseAskConversationOptions = {}) {
    const [messages, setMessages] = useState<AskMessage[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [error, setError] = useState<string | null>(null);

    const activePortRef = useRef<chrome.runtime.Port | null>(null);
    const messageIdCounter = useRef(0);
    const accumulatedTextRef = useRef('');

    /**
     * Generate unique message ID
     */
    const generateId = useCallback(() => {
        return `ask-${Date.now()}-${messageIdCounter.current++}`;
    }, []);

    /**
     * Ask a question and get AI response
     */
    const askQuestion = useCallback(
        async (
            question: string,
            toolSettings?: Partial<ToolSettings>,
            attachment?: AskAttachmentPayload
        ) => {
            if (!question.trim() && !attachment) return;

            setError(null);
            setIsGenerating(true);
            setCurrentAnswer('');
            accumulatedTextRef.current = '';

            // Add user message to history
            const userMessage: AskMessage = {
                id: generateId(),
                role: 'user',
                content: question,
                timestamp: Date.now(),
                attachment,
            };

            setMessages((prev) => [...prev, userMessage]);

            try {
                // Validate extension context
                if (!chrome.runtime?.id) {
                    throw new Error('Extension context invalidated. Please refresh the page.');
                }

                const settings = await getAskCommandSettings();

                // Connect to background service worker
                const port = chrome.runtime.connect({ name: 'ask-command' });
                activePortRef.current = port;

                // Handle incoming messages
                port.onMessage.addListener((message: AskStreamChunk | AskError) => {
                    if (message.action === 'ASK_STREAM_CHUNK') {
                        // Accumulate text
                        accumulatedTextRef.current += message.text;
                        setCurrentAnswer(accumulatedTextRef.current);

                        if (message.done) {
                            setIsGenerating(false);
                            activePortRef.current = null;

                            // Add assistant message to history with accumulated content
                            const assistantMessage: AskMessage = {
                                id: generateId(),
                                role: 'assistant',
                                content: accumulatedTextRef.current,
                                timestamp: Date.now(),
                            };

                            setMessages((prev) => [...prev, assistantMessage]);
                            setCurrentAnswer('');
                            accumulatedTextRef.current = '';

                            log.info('Answer received', {
                                contentLength: assistantMessage.content.length,
                            });
                        }
                    } else if (message.action === 'ASK_ERROR') {
                        setIsGenerating(false);
                        activePortRef.current = null;
                        setError(message.error);
                        log.error('Ask error received', { error: message.error, code: message.code });
                    }
                });

                // Handle port disconnection
                port.onDisconnect.addListener(() => {
                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message || 'Connection lost';
                        log.warn('Port disconnected with error', { error: errorMsg });

                        // Only set error if we were still generating
                        if (isGenerating) {
                            setError('Connection lost. Please try again.');
                            setIsGenerating(false);
                        }
                    }
                    activePortRef.current = null;
                });

                // Build conversation history for context (excluding current question)
                const conversationHistory: AskMessage[] = messages.map((m) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                    attachment: m.attachment,
                }));

                // Build request
                const request: AskGenerateRequest = {
                    action: 'ASK_GENERATE',
                    payload: {
                        question,
                        conversationHistory,
                        pageContext: options.pageContext,
                        settings: {
                            maxTokens: settings.maxOutputTokens,
                            enableUrlContext: toolSettings?.enableUrlContext ?? settings.enableUrlContext,
                            enableGoogleSearch: toolSettings?.enableGoogleSearch ?? settings.enableGoogleSearch,
                            enableSupermemorySearch:
                                toolSettings?.enableSupermemorySearch ?? settings.enableSupermemorySearch,
                        },
                        attachment,
                    },
                };

                log.info('Sending ask request', {
                    questionLength: question.length,
                    historyLength: conversationHistory.length,
                    hasAttachment: !!attachment,
                    tools: {
                        urlContext: request.payload.settings?.enableUrlContext,
                        googleSearch: request.payload.settings?.enableGoogleSearch,
                        supermemory: request.payload.settings?.enableSupermemorySearch,
                    },
                });

                port.postMessage(request);
            } catch (err) {
                setIsGenerating(false);
                const errorMessage = err instanceof Error ? err.message : 'Failed to send question';
                setError(errorMessage);
                log.error('Failed to ask question', { error: errorMessage });
            }
        },
        [messages, options.pageContext, generateId, isGenerating]
    );

    /**
     * Clear conversation history and reset state
     */
    const clearConversation = useCallback(() => {
        setMessages([]);
        setCurrentAnswer('');
        setError(null);
        accumulatedTextRef.current = '';

        if (activePortRef.current) {
            try {
                activePortRef.current.disconnect();
            } catch {
                // Port may already be disconnected
            }
            activePortRef.current = null;
        }

        log.debug('Conversation cleared');
    }, []);

    /**
     * Cancel ongoing generation
     */
    const cancelGeneration = useCallback(() => {
        if (activePortRef.current) {
            try {
                activePortRef.current.disconnect();
            } catch {
                // Port may already be disconnected
            }
            activePortRef.current = null;
        }

        setIsGenerating(false);
        accumulatedTextRef.current = '';

        log.debug('Generation cancelled');
    }, []);

    /**
     * Retry the last failed question
     */
    const retryLastQuestion = useCallback(() => {
        // Find the last user message
        const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

        if (lastUserMessage) {
            // Remove the last user message from history (it will be re-added)
            setMessages((prev) => prev.filter((m) => m.id !== lastUserMessage.id));
            setError(null);

            // Re-ask the question
            askQuestion(lastUserMessage.content, undefined, lastUserMessage.attachment);
        }
    }, [messages, askQuestion]);

    return {
        messages,
        isGenerating,
        currentAnswer,
        error,
        askQuestion,
        clearConversation,
        cancelGeneration,
        retryLastQuestion,
    };
}
