/**
 * useHistoryRAG Hook
 * Manages RAG (Retrieval-Augmented Generation) for history search
 * Combines hybrid search with Chrome AI (Gemini Nano) for conversational answers
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface HistoryRAGMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: Array<{
        url: string;
        title?: string;
        snippet?: string;
        score?: number;
    }>;
    timestamp: number;
    metadata?: {
        error?: boolean;
        streaming?: boolean;
    };
}

interface UseHistoryRAGOptions {
    topK?: number; // Number of top results to use as context
    systemPrompt?: string;
}

interface UseHistoryRAGReturn {
    messages: HistoryRAGMessage[];
    isLoading: boolean;
    error: string | null;
    sendMessage: (query: string) => Promise<void>;
    clearMessages: () => void;
    modelReady: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant with access to the user's browsing history.
Answer questions based on the provided context from their browsing history.
Always cite your sources using the URLs provided.
If the context doesn't contain relevant information, say so clearly.
Be concise and accurate in your responses.`;

export function useHistoryRAG(options: UseHistoryRAGOptions = {}): UseHistoryRAGReturn {
    const { topK = 10, systemPrompt = DEFAULT_SYSTEM_PROMPT } = options;

    const [messages, setMessages] = useState<HistoryRAGMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<any | null>(null);
    const [modelReady, setModelReady] = useState(false);

    const sessionRef = useRef<any | null>(null);
    const mountedRef = useRef(true);

    // Initialize Chrome AI session
    useEffect(() => {
        const initSession = async () => {
            try {
                // Check if LanguageModel is available
                if (!window.LanguageModel) {
                    console.warn('[useHistoryRAG] Chrome LanguageModel API not available');
                    setError('Chrome AI not available. Please use Chrome Canary 128+ with AI features enabled.');
                    return;
                }

                const availability = await window.LanguageModel.availability();
                console.log('[useHistoryRAG] LanguageModel availability:', availability);

                if (availability === 'no') {
                    setError('Chrome AI not available on this device.');
                    return;
                }

                if (availability === 'readily') {
                    setError('Chrome AI is supported but not enough disk space to download the model.');
                    return;
                }

                // Create session with system instruction
                const newSession = await window.LanguageModel.create({
                    expectedInputs: [{ type: "text", languages: ["en"] }],
                    expectedOutputs: [{ type: "text", languages: ["en"] }],
                    systemInstruction: systemPrompt,
                });

                if (mountedRef.current) {
                    setSession(newSession);
                    sessionRef.current = newSession;
                    setModelReady(true);
                    console.log('[useHistoryRAG] Chrome AI session initialized');
                }
            } catch (err) {
                console.error('[useHistoryRAG] Error initializing Chrome AI:', err);
                if (mountedRef.current) {
                    setError('Failed to initialize Chrome AI.');
                }
            }
        };

        initSession();

        return () => {
            mountedRef.current = false;
            if (sessionRef.current) {
                try {
                    sessionRef.current.destroy?.();
                } catch (err) {
                    console.warn('[useHistoryRAG] Error destroying session:', err);
                }
            }
        };
    }, [systemPrompt]);

    /**
     * Run hybrid search and get relevant context
     */
    const searchHistory = useCallback(async (query: string): Promise<Array<{
        url: string;
        title?: string;
        snippet?: string;
        score?: number;
    }>> => {
        try {
            // Use sendMessage to run hybrid search
            const response = await chrome.runtime.sendMessage({
                type: 'HistoryRAGSearch',
                query,
                topK
            });

            if (response.error) {
                throw new Error(response.error);
            }

            return response.results || [];
        } catch (err) {
            console.error('[useHistoryRAG] Error searching history:', err);
            return [];
        }
    }, [topK]);

    /**
     * Format search results as context for the AI
     */
    const formatContext = useCallback((results: Array<{
        url: string;
        title?: string;
        snippet?: string;
        score?: number;
    }>): string => {
        if (results.length === 0) {
            return "No relevant browsing history found for this query.";
        }

        let context = "Based on this browsing history:\n\n";

        results.forEach((result, index) => {
            context += `[${index + 1}] ${result.title || 'Untitled'} - ${result.url}\n`;
            if (result.snippet) {
                context += `${result.snippet}\n`;
            }
            context += `\n`;
        });

        return context;
    }, []);

    /**
     * Send a message and get AI response
     */
    const sendMessage = useCallback(async (query: string) => {
        if (!query.trim() || !sessionRef.current || isLoading) {
            return;
        }

        setIsLoading(true);
        setError(null);

        const userMessage: HistoryRAGMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: query.trim(),
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);

        try {
            // Step 1: Search browsing history
            const searchResults = await searchHistory(query);

            // Step 2: Format context
            const context = formatContext(searchResults);

            // Step 3: Create full prompt
            const fullPrompt = `${context}\n\nQuestion: ${query}`;

            // Step 4: Stream AI response
            const stream = sessionRef.current.promptStreaming(fullPrompt);

            // Create placeholder assistant message
            const assistantMsgId = `assistant-${Date.now()}`;
            const assistantMsg: HistoryRAGMessage = {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                sources: searchResults,
                timestamp: Date.now(),
                metadata: { streaming: true }
            };

            setMessages(prev => [...prev, assistantMsg]);

            let assistantContent = "";

            // Stream chunks
            for await (const chunk of stream) {
                assistantContent += chunk;
                if (mountedRef.current) {
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === assistantMsgId
                                ? { ...msg, content: assistantContent }
                                : msg
                        )
                    );
                }
            }

            // Mark as complete
            if (mountedRef.current) {
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === assistantMsgId
                            ? { ...msg, metadata: { streaming: false } }
                            : msg
                    )
                );
            }
        } catch (err: any) {
            console.error('[useHistoryRAG] Error getting AI response:', err);
            
            if (mountedRef.current) {
                const errorMsg: HistoryRAGMessage = {
                    id: `error-${Date.now()}`,
                    role: 'assistant',
                    content: `Error: ${err.message || 'Failed to get AI response'}`,
                    timestamp: Date.now(),
                    metadata: { error: true }
                };
                setMessages(prev => [...prev, errorMsg]);
                setError(err.message || 'Failed to get AI response');
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [isLoading, searchHistory, formatContext]);

    /**
     * Clear all messages
     */
    const clearMessages = useCallback(() => {
        setMessages([]);
        setError(null);
    }, []);

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        clearMessages,
        modelReady
    };
}

