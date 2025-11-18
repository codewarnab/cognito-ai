/**
 * Transport detection and endpoint management
 * Handles both Streamable HTTP (POST) and HTTP+SSE (GET) transports
 */

import { createLogger } from '../../logger';
import { MCPError } from '../../errors/errorTypes';
import type { TransportType } from './streamProcessor';
import type { MessageHandler, PendingRequest } from './messageHandler';
import type { ErrorHandler } from './errorHandler';

const log = createLogger('MCP-SSE', 'MCP_SSE');

export interface TransportDetectorDeps {
    serverId: string;
    sseUrl: string;
    accessToken: string;
    messageHandler: MessageHandler;
    errorHandler: ErrorHandler;
    setSessionId: (sessionId: string | null) => void;
    setInitializePromise: (promise: Promise<void>) => void;
    setInitializeResolve: (resolve: () => void) => void;
    setInitializeResult: (result: any) => void;
    setInitialized: (initialized: boolean) => void;
}

export class TransportDetector {
    private transportType: TransportType = null;
    private messageEndpoint: string | null = null;
    private sseSessionId: string | null = null;

    constructor(private deps: TransportDetectorDeps) { }

    /**
     * Detect transport type and establish initial connection
     * Returns the response for stream processing
     */
    async detectAndConnect(messageId: number): Promise<Response> {
        log.info(`[${this.deps.serverId}] Connecting to SSE endpoint:`, this.deps.sseUrl);
        log.info(`[${this.deps.serverId}] Using access token (first 20 chars):`, this.deps.accessToken.substring(0, 20) + '...');

        // Try new Streamable HTTP transport first (POST with initialize request)
        // Fall back to old HTTP+SSE transport (GET to open SSE stream) if POST fails with 405
        let response: Response;

        // Attempt 1: Try new Streamable HTTP transport (POST with initialize)
        try {
            response = await fetch(this.deps.sseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.deps.accessToken}`,
                    'Accept': 'text/event-stream, application/json',
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'MCP-Protocol-Version': '2025-06-18'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: messageId,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2025-06-18',
                        capabilities: {
                            roots: { listChanged: true }
                        },
                        clientInfo: {
                            name: 'chrome-ai-extension',
                            version: '0.0.1'
                        }
                    }
                })
            });

            // Set up promise to track initialization response BEFORE checking response
            // This ensures the promise exists when the stream starts processing
            const initPromise = new Promise<void>((resolve) => {
                this.deps.setInitializeResolve(resolve);
            });
            this.deps.setInitializePromise(initPromise);

            const pendingRequest: PendingRequest = {
                resolve: (result) => {
                    this.deps.setInitializeResult(result);
                    this.deps.setInitialized(true);
                    log.info(`[${this.deps.serverId}] ✓ Initialization response received:`, result);
                },
                reject: (error) => {
                    log.error(`[${this.deps.serverId}] ✗ Initialization failed:`, error);
                }
            };
            this.deps.messageHandler.addPendingRequest(messageId, pendingRequest);

            // Check if server accepted POST (Streamable HTTP transport)
            if (response.ok) {
                this.transportType = 'streamable-http';
                log.info(`[${this.deps.serverId}] ✓ Using Streamable HTTP transport (POST)`);

                // Extract session ID from headers
                const sessionIdHeader = response.headers.get('Mcp-Session-Id');
                if (sessionIdHeader) {
                    this.deps.setSessionId(sessionIdHeader);
                    log.info(`[${this.deps.serverId}] Session ID:`, sessionIdHeader);
                }
            } else if (response.status === 405) {
                // Server doesn't support POST - try GET (old HTTP+SSE transport)
                log.info(`[${this.deps.serverId}] POST returned 405, falling back to HTTP+SSE transport (GET)`);
                throw new Error('Method not allowed, try GET');
            } else {
                // Handle error status codes with proper categorization
                await this.deps.errorHandler.handleErrorResponse(response);
                throw new Error(`POST failed with status ${response.status}`);
            }
        } catch (error) {
            // Only attempt fallback if it's a 405 error
            if (error instanceof Error && error.message.includes('Method not allowed')) {
                log.info(`[${this.deps.serverId}] Streamable HTTP not supported, trying HTTP+SSE:`, error);

                // Attempt 2: Fall back to old HTTP+SSE transport (GET)
                response = await fetch(this.deps.sseUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.deps.accessToken}`,
                        'Accept': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'MCP-Protocol-Version': '2024-11-05'
                    }
                });

                this.transportType = 'http-sse';
                log.info(`[${this.deps.serverId}] ✓ Using HTTP+SSE transport (GET)`);
            } else {
                // Re-throw if it's not a 405 fallback scenario
                throw error;
            }
        }

        log.info(`[${this.deps.serverId}] Response status:`, response.status);
        log.info(`[${this.deps.serverId}] Response headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            await this.deps.errorHandler.handleErrorResponse(response);
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        if (!response.body) {
            throw MCPError.connectionFailed(
                this.deps.serverId,
                'Response body is null - server did not return a stream'
            );
        }

        return response;
    }

    /**
     * Get the full POST endpoint URL
     * Handles both Streamable HTTP and HTTP+SSE transports
     */
    getPostUrl(): string {
        if (this.transportType === 'streamable-http') {
            // New transport: use the same endpoint for all requests
            return this.deps.sseUrl;
        }

        // Old HTTP+SSE transport: use the endpoint from SSE 'endpoint' event
        if (!this.messageEndpoint) {
            throw new Error('Message endpoint not available. SSE connection may not be established.');
        }

        // If endpoint is relative, construct full URL
        if (this.messageEndpoint.startsWith('/')) {
            const url = new URL(this.deps.sseUrl);
            return `${url.origin}${this.messageEndpoint}`;
        }

        // If endpoint is already absolute, use it as-is
        return this.messageEndpoint;
    }

    /**
     * Set message endpoint (called when endpoint event is received)
     */
    setMessageEndpoint(endpoint: string, sessionId: string | null): void {
        this.messageEndpoint = endpoint;
        this.sseSessionId = sessionId;
    }

    /**
     * Wait for message endpoint to be available (for HTTP+SSE transport)
     */
    async waitForEndpoint(timeoutMs: number = 10000): Promise<void> {
        const startTime = Date.now();
        while (!this.messageEndpoint) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error('Timeout waiting for message endpoint from SSE');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * Get current transport type
     */
    getTransportType(): TransportType {
        return this.transportType;
    }

    /**
     * Get SSE session ID (for stream resumability)
     */
    getSseSessionId(): string | null {
        return this.sseSessionId;
    }
}
