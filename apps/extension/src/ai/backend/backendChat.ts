/**
 * Backend Chat Implementation
 * 
 * Handles AI chat through our Vercel backend instead of direct API calls.
 * Used when backend mode is enabled and user doesn't have their own API key.
 */

import { createUIMessageStream, generateId, type UIMessage } from 'ai';
import { createLogger } from '~logger';
import { createBackendController, clearBackendController } from './streamingOptimizations';
import type { BackendModel } from '@/stores/settings/types';
import { ENV } from '@/utils/env';

const log = createLogger('BackendChat', 'AI_CHAT');

// Backend API URL from centralized ENV
const BACKEND_URL = ENV.BACKEND_API_URL;

export interface BackendChatParams {
    messages: UIMessage[];
    model?: BackendModel;
    abortSignal?: AbortSignal;
    onError?: (error: Error) => void;
    onFinishCallback?: () => void;
}

/**
 * Stream AI response through our backend
 * Returns a UIMessageStream compatible with the existing chat UI
 */
export async function streamBackendChat(params: BackendChatParams) {
    const { messages, model = 'gemini-2.0-flash', abortSignal, onError, onFinishCallback } = params;

    log.info('Starting backend chat stream', { messageCount: messages.length, model });

    // Create abort controller for this request
    const controller = createBackendController();

    try {
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                try {
                    // Send initial processing status
                    writer.write({
                        type: 'data-status',
                        id: 'status-' + generateId(),
                        data: { status: 'processing', timestamp: Date.now() },
                        transient: true,
                    });

                    // Convert UIMessages to simple format for backend
                    // UIMessage uses 'parts' array, extract text from text parts
                    const simpleMessages = messages.map(msg => {
                        // Extract text from parts array
                        let textContent = '';
                        if (msg.parts && Array.isArray(msg.parts)) {
                            textContent = msg.parts
                                .filter((part: any) => part && part.type === 'text')
                                .map((part: any) => part.text || '')
                                .join('');
                        }
                        return {
                            role: msg.role,
                            content: textContent
                        };
                    }).filter(msg => msg.content.length > 0);

                    // Make request to backend
                    const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Connection': 'keep-alive',
                        },
                        body: JSON.stringify({
                            messages: simpleMessages,
                            model, // Use selected model
                        }),
                        signal: abortSignal || controller.signal,
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.message || `Backend error: ${response.status}`);
                    }

                    if (!response.body) {
                        throw new Error('No response body from backend');
                    }

                    // Stream the response
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });

                        // Parse SSE format from AI SDK
                        const lines = chunk.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('0:')) {
                                // Text delta from AI SDK stream
                                try {
                                    const text = JSON.parse(line.slice(2));
                                    writer.write({
                                        type: 'text-delta',
                                        id: 'text-' + generateId(),
                                        delta: text,
                                    });
                                } catch (e) {
                                    // Not valid JSON, skip
                                    log.warn('Failed to parse AI SDK chunk:', line);
                                }
                            }
                            // Handle finish message (e or d prefixes in AI SDK)
                            else if (line.startsWith('e:') || line.startsWith('d:')) {
                                // Finish or data message
                                log.info('Received stream completion signal');
                            }
                        }
                    }

                    // Send completion status
                    writer.write({
                        type: 'data-status',
                        id: 'status-' + generateId(),
                        data: { status: 'completed', timestamp: Date.now() },
                        transient: true,
                    });

                    // Clear controller on completion
                    clearBackendController();

                    // Call finish callback
                    onFinishCallback?.();

                } catch (error) {
                    // Clear controller on error
                    clearBackendController();
                    log.error('Backend chat error:', error);

                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                    // Check if aborted
                    if (error instanceof Error && error.name === 'AbortError') {
                        log.info('Backend chat was aborted by user');
                        writer.write({
                            type: 'data-status',
                            id: 'status-' + generateId(),
                            data: { status: 'aborted', timestamp: Date.now() },
                            transient: true,
                        });
                        return;
                    }

                    // Write error to stream
                    writer.write({
                        type: 'text-delta',
                        id: 'error-' + generateId(),
                        delta: `\n\n❌ **Error:** ${errorMessage}\n\nPlease try again or switch to BYOK mode with your own API key.`,
                    });

                    // Send error status
                    writer.write({
                        type: 'data-status',
                        id: 'status-' + generateId(),
                        data: { status: 'error', timestamp: Date.now() },
                        transient: false,
                    });

                    onError?.(error instanceof Error ? error : new Error(errorMessage));
                }
            },
        });

        return stream;

    } catch (error) {
        log.error('Failed to create backend stream:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to start backend chat'));
        throw error;
    }
}
