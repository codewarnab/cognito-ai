/**
 * Stream processing for SSE connections
 * Handles reading and parsing Server-Sent Events
 */

import type { McpMessage } from '../types';
import { createLogger } from '../../logger';
import type { MessageHandler } from './messageHandler';
import type { ErrorHandler } from './errorHandler';
import { buildUserMessage } from '../../errors/errorMessages';

const log = createLogger('MCP-SSE', 'MCP_SSE');

export type TransportType = 'streamable-http' | 'http-sse' | null;

export interface StreamProcessorCallbacks {
    onEndpointReceived: (endpoint: string, sessionId: string | null) => void;
    onStreamEnd: () => void;
}

export interface StreamProcessorDeps {
    serverId: string;
    transportType: TransportType;
    messageHandler: MessageHandler;
    errorHandler: ErrorHandler;
    isDisconnecting: () => boolean;
    getCurrentState: () => string;
}

export class StreamProcessor {
    constructor(
        private deps: StreamProcessorDeps,
        private callbacks: StreamProcessorCallbacks
    ) {}

    /**
     * Enhanced process stream with error handling
     * 
     * Handles:
     * - Stream interruptions
     * - Parse errors
     * - Unexpected stream closures
     */
    async processStream(body: ReadableStream<Uint8Array>): Promise<void> {
        log.info(`[${this.deps.serverId}] Starting stream processing...`);
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent: string | null = null;

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    log.info(`[${this.deps.serverId}] Stream ended, buffer size: ${buffer.length} bytes`);

                    // For Streamable HTTP: If buffer contains JSON but no SSE format, parse it directly
                    if (this.deps.transportType === 'streamable-http' && buffer.trim().length > 0) {
                        const trimmed = buffer.trim();
                        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                            try {
                                log.info(`[${this.deps.serverId}] Parsing final buffer as JSON:`, trimmed.substring(0, 100));
                                const message: McpMessage = JSON.parse(trimmed);
                                log.info(`[${this.deps.serverId}] Parsed JSON message ID:`, message.id);
                                this.deps.messageHandler.handleMessage(message);
                            } catch (err) {
                                log.error(`[${this.deps.serverId}] Failed to parse buffer as JSON:`, err);
                                // Log but don't throw - stream is ending anyway
                            }
                        }
                    }
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                log.info(`[${this.deps.serverId}] Buffer size: ${buffer.length} bytes`);
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                log.info(`[${this.deps.serverId}] Processing ${lines.length} lines from buffer`);
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        // Handle SSE event types (e.g., "event: endpoint", "event: message")
                        currentEvent = line.slice(7).trim();
                        log.info(`[${this.deps.serverId}] SSE event type:`, currentEvent);
                        continue;
                    }

                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        log.info(`[${this.deps.serverId}] SSE data received (${data.length} chars):`, data.substring(0, 100));
                        if (data === '[DONE]') continue;

                        // Handle endpoint event - extract message endpoint for POST requests
                        if (currentEvent === 'endpoint') {
                            // Per MCP spec: server sends endpoint URI for client to use for POST requests
                            // data format: /sse/message?sessionId=... (relative URI)
                            const messageEndpoint = data;

                            // Extract session ID if present
                            const match = data.match(/sessionId=([a-f0-9-]+)/);
                            const sseSessionId = match ? match[1] || null : null;

                            log.info(`[${this.deps.serverId}] Message endpoint received:`, messageEndpoint);
                            log.info(`[${this.deps.serverId}] SSE Session ID:`, sseSessionId);
                            
                            this.callbacks.onEndpointReceived(messageEndpoint, sseSessionId);
                            currentEvent = null;
                            continue;
                        }

                        // Skip empty data or non-JSON data
                        if (!data || (!data.startsWith('{') && !data.startsWith('['))) {
                            log.info(`[${this.deps.serverId}] Non-JSON SSE data:`, data);
                            currentEvent = null;
                            continue;
                        }

                        try {
                            const message: McpMessage = JSON.parse(data);
                            log.info(`[${this.deps.serverId}] Parsed message ID:`, message.id, 'Method:', message.method);
                            this.deps.messageHandler.handleMessage(message);
                        } catch (err) {
                            log.error(`[${this.deps.serverId}] Failed to parse message:`, err, 'Data:', data);
                            // Log parse errors but don't throw - continue processing stream
                        }

                        currentEvent = null;
                    }
                }
            }
        } catch (error) {
            log.error(`[${this.deps.serverId}] Stream error:`, error);

            // Categorize stream error
            const streamError = this.deps.errorHandler.categorizeConnectionError(error);
            const errorMessage = buildUserMessage(streamError);
            
            // We can't call updateStatus directly, so we'll throw and let the caller handle it
            throw { error: streamError, message: errorMessage };
        } finally {
            reader.releaseLock();

            // Notify about stream end
            this.callbacks.onStreamEnd();
        }
    }

    /**
     * Determine if reconnection is needed after stream ends
     */
    shouldReconnect(): boolean {
        // For Streamable HTTP: streams close after each response, which is normal
        // For HTTP+SSE: stream should stay open, so reconnect if it closes unexpectedly
        if (this.deps.transportType === 'http-sse' && 
            !this.deps.isDisconnecting() && 
            this.deps.getCurrentState() !== 'disconnected') {
            log.info(`[${this.deps.serverId}] HTTP+SSE stream ended unexpectedly, should reconnect`);
            return true;
        } else if (this.deps.transportType === 'streamable-http') {
            log.info(`[${this.deps.serverId}] Streamable HTTP stream closed (normal after response)`);
            return false;
        } else {
            log.info(`[${this.deps.serverId}] Stream ended (intentional disconnect)`);
            return false;
        }
    }
}
