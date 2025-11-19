/**
 * Request management for MCP SSE Client
 * Handles sending requests and notifications with timeout management
 */

import type { McpMessage } from '../types';
import { createLogger } from '@logger';
import { NetworkError, MCPError } from '../../errors/errorTypes';
import type { SSEClientConfig } from './config';
import type { MessageHandler } from './messageHandler';
import type { ErrorHandler } from './errorHandler';

const log = createLogger('MCP-SSE', 'MCP_SSE');

export interface RequestManagerDeps {
    serverId: string;
    accessToken: string;
    config: Required<SSEClientConfig>;
    messageHandler: MessageHandler;
    errorHandler: ErrorHandler;
    getSessionId: () => string | null;
    getPostUrl: () => string;
}

export class RequestManager {
    private messageId = 0;

    constructor(private deps: RequestManagerDeps) { }

    /**
     * Get next message ID
     */
    getNextMessageId(): number {
        return ++this.messageId;
    }

    /**
     * Send a notification (no response expected)
     */
    async sendNotification(method: string, params?: any): Promise<void> {
        const message: McpMessage = {
            jsonrpc: '2.0',
            method,
            params
        };

        // Build headers
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.deps.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'MCP-Protocol-Version': '2025-06-18'
        };

        // Include session ID if available
        const sessionId = this.deps.getSessionId();
        if (sessionId) {
            headers['Mcp-Session-Id'] = sessionId;
        }

        // Per MCP spec: use the endpoint from SSE 'endpoint' event for POST requests
        const postUrl = this.deps.getPostUrl();
        log.info(`[${this.deps.serverId}] Sending notification to:`, postUrl);

        // Send notification - no response expected (should return 202 Accepted)
        const response = await fetch(postUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error(`[${this.deps.serverId}] Notification failed:`, response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        log.info(`[${this.deps.serverId}] Notification sent:`, method);
    }

    /**
     * Send a request over SSE (via POST to endpoint from SSE 'endpoint' event)
     * Per MCP spec: SSE for receiving, POST to endpoint provided by server for sending
     * 
     * Enhanced with:
     * - Request timeout handling
     * - Error response categorization
     * - Automatic cleanup on failures
     */
    async sendRequest(method: string, params?: any, _options?: { skipSessionId?: boolean }): Promise<any> {
        const id = this.getNextMessageId();
        const message: McpMessage = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        const timeoutMs = this.deps.config.requestTimeout;

        return new Promise((resolve, reject) => {
            this.deps.messageHandler.addPendingRequest(id, { resolve, reject });

            // Set up timeout with cleanup
            const timeoutId = setTimeout(() => {
                if (this.deps.messageHandler.hasPendingRequest(id)) {
                    this.deps.messageHandler.removePendingRequest(id);
                    const error = NetworkError.timeout(
                        `Request to ${this.deps.serverId} timed out after ${timeoutMs}ms (method: ${method})`
                    );
                    reject(error);
                }
            }, timeoutMs);

            // Build headers
            const headers: Record<string, string> = {
                'Authorization': `Bearer ${this.deps.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
                'MCP-Protocol-Version': '2025-06-18'
            };

            // Include session ID if available
            const isInitialize = method === 'initialize';
            const sessionId = this.deps.getSessionId();
            if (!isInitialize && sessionId) {
                headers['Mcp-Session-Id'] = sessionId;
            }

            // Per MCP spec: use the endpoint from SSE 'endpoint' event for POST requests
            const postUrl = this.deps.getPostUrl();
            log.info(`[${this.deps.serverId}] Sending request to:`, postUrl, 'Method:', method);

            // Send via POST to the message endpoint (from SSE endpoint event)
            fetch(postUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(message)
            })
                .then(async response => {
                    // Clear timeout on response
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        // Handle error response with proper categorization
                        await this.deps.errorHandler.handleErrorResponse(response);
                        const errorText = await response.text().catch(() => 'Unknown error');
                        throw MCPError.connectionFailed(
                            this.deps.serverId,
                            `HTTP ${response.status}: ${errorText}`
                        );
                    }

                    // Check content type to determine how to parse
                    const contentType = response.headers.get('content-type') || '';

                    if (contentType.includes('text/event-stream')) {
                        // Response is SSE format - parse it
                        const text = await response.text();
                        const lines = text.split('\n');

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6).trim();
                                if (data && (data.startsWith('{') || data.startsWith('['))) {
                                    try {
                                        const result = JSON.parse(data);
                                        if (result.id === id) {
                                            this.deps.messageHandler.handleMessage(result);
                                            return;
                                        }
                                    } catch (err) {
                                        console.error(`[MCP:${this.deps.serverId}] Failed to parse SSE data:`, err);
                                    }
                                }
                            }
                        }
                    } else if (contentType.includes('application/json')) {
                        // Response is JSON - parse directly
                        const result = await response.json();
                        if (result.id === id) {
                            this.deps.messageHandler.handleMessage(result);
                        }
                    } else {
                        throw MCPError.connectionFailed(
                            this.deps.serverId,
                            `Unexpected content type: ${contentType}`
                        );
                    }
                })
                .catch(error => {
                    // Clear timeout and cleanup
                    clearTimeout(timeoutId);
                    this.deps.messageHandler.removePendingRequest(id);

                    // Categorize error before rejecting
                    const categorizedError = this.deps.errorHandler.categorizeConnectionError(error);
                    reject(categorizedError);
                });
        });
    }
}
