/**
 * Generic MCP SSE Client
 * Handles Server-Sent Events connection to MCP servers
 */

import type {
    McpMessage,
    McpInitializeRequest,
    McpToolsListResponse,
    McpToolCallRequest,
    McpServerStatus,
    McpConnectionState
} from './types';

interface SSEClientConfig {
    reconnectMinDelay: number;
    reconnectMaxDelay: number;
    reconnectMultiplier: number;
}

/**
 * Generic MCP SSE Client for any MCP server
 */
export class McpSSEClient {
    private serverId: string;
    private sseUrl: string;
    private accessToken: string;
    private sessionId: string | null = null; // MCP session ID from initialization
    private sseSessionId: string | null = null; // SSE stream session ID for resumability
    private messageEndpoint: string | null = null; // POST endpoint from SSE 'endpoint' event
    private eventSource: EventSource | null = null;
    private reconnectAttempts = 0;
    private reconnectTimeout: number | null = null;
    private messageId = 0;
    private pendingRequests = new Map<string | number, {
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }>();

    private onStatusChange: (status: McpServerStatus) => void;
    private onMessage: (message: McpMessage) => void;

    private currentStatus: McpServerStatus;
    private config: SSEClientConfig;

    // Transport detection
    private transportType: 'streamable-http' | 'http-sse' | null = null;
    private initializeResult: any = null;
    private initialized = false;
    private initializePromise: Promise<void> | null = null;
    private initializeResolve: (() => void) | null = null;
    private isDisconnecting = false;

    constructor(
        serverId: string,
        sseUrl: string,
        accessToken: string,
        callbacks: {
            onStatusChange: (status: McpServerStatus) => void;
            onMessage: (message: McpMessage) => void;
        },
        config?: Partial<SSEClientConfig>
    ) {
        this.serverId = serverId;
        this.sseUrl = sseUrl;
        this.accessToken = accessToken;
        this.onStatusChange = callbacks.onStatusChange;
        this.onMessage = callbacks.onMessage;

        this.currentStatus = {
            serverId,
            state: 'disconnected'
        };

        this.config = {
            reconnectMinDelay: config?.reconnectMinDelay ?? 500,
            reconnectMaxDelay: config?.reconnectMaxDelay ?? 30000,
            reconnectMultiplier: config?.reconnectMultiplier ?? 2
        };
    }

    /**
     * Connect to the SSE endpoint
     */
    async connect(): Promise<void> {
        this.updateStatus('connecting');

        try {
            // For MV3 extensions, we need to use fetch with ReadableStream
            // instead of EventSource due to CSP restrictions
            await this.connectWithFetch();
        } catch (error) {
            console.error(`[MCP:${this.serverId}] Connection error:`, error);
            this.updateStatus('error', error instanceof Error ? error.message : 'Connection failed');
            this.scheduleReconnect();
        }
    }

    /**
     * Connect using fetch and ReadableStream (MV3 compatible)
     * Supports both Streamable HTTP (2025-06-18) and HTTP+SSE (2024-11-05) transports
     */
    private async connectWithFetch(): Promise<void> {
        console.log(`[MCP:${this.serverId}] Connecting to SSE endpoint:`, this.sseUrl);
        console.log(`[MCP:${this.serverId}] Using access token (first 20 chars):`, this.accessToken.substring(0, 20) + '...');

        // Try new Streamable HTTP transport first (POST with initialize request)
        // Fall back to old HTTP+SSE transport (GET to open SSE stream) if POST fails with 405
        let response: Response;

        // Attempt 1: Try new Streamable HTTP transport (POST with initialize)
        try {
            const initId = ++this.messageId;
            response = await fetch(this.sseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'text/event-stream, application/json',
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'MCP-Protocol-Version': '2025-06-18'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: initId,
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
            this.initializePromise = new Promise((resolve) => {
                this.initializeResolve = resolve;
            });
            this.pendingRequests.set(initId, {
                resolve: (result) => {
                    this.initializeResult = result;
                    this.initialized = true;
                    console.log(`[MCP:${this.serverId}] ✓ Initialization response received:`, result);
                    if (this.initializeResolve) {
                        this.initializeResolve();
                    }
                },
                reject: (error) => {
                    console.error(`[MCP:${this.serverId}] ✗ Initialization failed:`, error);
                    if (this.initializeResolve) {
                        this.initializeResolve(); // Resolve anyway to prevent hanging
                    }
                }
            });

            // Check if server accepted POST (Streamable HTTP transport)
            if (response.ok) {
                this.transportType = 'streamable-http';
                console.log(`[MCP:${this.serverId}] ✓ Using Streamable HTTP transport (POST)`);

                // Extract session ID from headers
                const sessionIdHeader = response.headers.get('Mcp-Session-Id');
                if (sessionIdHeader) {
                    this.sessionId = sessionIdHeader;
                    console.log(`[MCP:${this.serverId}] Session ID:`, this.sessionId);
                }
            } else if (response.status === 405) {
                // Server doesn't support POST - try GET (old HTTP+SSE transport)
                console.log(`[MCP:${this.serverId}] POST returned 405, falling back to HTTP+SSE transport (GET)`);
                throw new Error('Method not allowed, try GET');
            } else {
                // Other error - don't fall back, throw
                throw new Error(`POST failed with status ${response.status}`);
            }
        } catch (error) {
            console.log(`[MCP:${this.serverId}] Streamable HTTP not supported, trying HTTP+SSE:`, error);

            // Attempt 2: Fall back to old HTTP+SSE transport (GET)
            response = await fetch(this.sseUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'MCP-Protocol-Version': '2024-11-05'
                }
            });

            this.transportType = 'http-sse';
            console.log(`[MCP:${this.serverId}] ✓ Using HTTP+SSE transport (GET)`);
        }

        console.log(`[MCP:${this.serverId}] Response status:`, response.status);
        console.log(`[MCP:${this.serverId}] Response headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[MCP:${this.serverId}] Connection failed:`, response.status, errorText);

            if (response.status === 401) {
                // Parse error to distinguish between format and expiry issues
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: 'unknown', error_description: errorText };
                }

                if (errorData.error === 'invalid_token' && errorData.error_description?.includes('Invalid token format')) {
                    // Token format is wrong - don't try to refresh, need re-auth
                    this.updateStatus('invalid-token', 'Invalid token format - please re-authenticate');
                    throw new Error(`Invalid token format: ${errorData.error_description}`);
                } else {
                    // Token expired or other auth issue - might be refreshable
                    this.updateStatus('needs-auth', 'Token expired or invalid');
                    throw new Error(`Authentication required: ${errorText}`);
                }
            }
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        this.reconnectAttempts = 0;

        // For Streamable HTTP: Update status to 'connected' immediately after 200 response
        // This ensures UI shows connected state right away, even if initialization takes time
        if (this.transportType === 'streamable-http') {
            this.updateStatus('connected');
            console.log(`[MCP:${this.serverId}] ✓ Connection established (200 OK), processing stream...`);
        } else {
            // For HTTP+SSE: Update status now
            this.updateStatus('connected');
        }

        // Process the stream in the background (don't await)
        this.processStream(response.body);

        // Note: MCP session ID comes from initialization response headers,
        // not from the SSE stream. The SSE endpoint event provides a separate
        // session ID for stream resumability.
    }

    /**
     * Process the SSE stream in the background
     */
    private async processStream(body: ReadableStream<Uint8Array>): Promise<void> {
        console.log(`[MCP:${this.serverId}] Starting stream processing...`);
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent: string | null = null;

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    console.log(`[MCP:${this.serverId}] Stream ended, buffer size: ${buffer.length} bytes`);

                    // For Streamable HTTP: If buffer contains JSON but no SSE format, parse it directly
                    if (this.transportType === 'streamable-http' && buffer.trim().length > 0) {
                        const trimmed = buffer.trim();
                        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                            try {
                                console.log(`[MCP:${this.serverId}] Parsing final buffer as JSON:`, trimmed.substring(0, 100));
                                const message: McpMessage = JSON.parse(trimmed);
                                console.log(`[MCP:${this.serverId}] Parsed JSON message ID:`, message.id);
                                this.handleMessage(message);
                            } catch (err) {
                                console.error(`[MCP:${this.serverId}] Failed to parse buffer as JSON:`, err);
                            }
                        }
                    }
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                console.log(`[MCP:${this.serverId}] Buffer size: ${buffer.length} bytes`);
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                console.log(`[MCP:${this.serverId}] Processing ${lines.length} lines from buffer`);
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        // Handle SSE event types (e.g., "event: endpoint", "event: message")
                        currentEvent = line.slice(7).trim();
                        console.log(`[MCP:${this.serverId}] SSE event type:`, currentEvent);
                        continue;
                    }

                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        console.log(`[MCP:${this.serverId}] SSE data received (${data.length} chars):`, data.substring(0, 100));
                        if (data === '[DONE]') continue;

                        // Handle endpoint event - extract message endpoint for POST requests
                        if (currentEvent === 'endpoint') {
                            // Per MCP spec: server sends endpoint URI for client to use for POST requests
                            // data format: /sse/message?sessionId=... (relative URI)
                            this.messageEndpoint = data;

                            // Extract session ID if present
                            const match = data.match(/sessionId=([a-f0-9-]+)/);
                            if (match) {
                                this.sseSessionId = match[1];
                            }

                            console.log(`[MCP:${this.serverId}] Message endpoint received:`, this.messageEndpoint);
                            console.log(`[MCP:${this.serverId}] SSE Session ID:`, this.sseSessionId);
                            currentEvent = null;
                            continue;
                        }

                        // Skip empty data or non-JSON data
                        if (!data || (!data.startsWith('{') && !data.startsWith('['))) {
                            console.log(`[MCP:${this.serverId}] Non-JSON SSE data:`, data);
                            currentEvent = null;
                            continue;
                        }

                        try {
                            const message: McpMessage = JSON.parse(data);
                            console.log(`[MCP:${this.serverId}] Parsed message ID:`, message.id, 'Method:', message.method);
                            this.handleMessage(message);
                        } catch (err) {
                            console.error(`[MCP:${this.serverId}] Failed to parse message:`, err, 'Data:', data);
                        }

                        currentEvent = null;
                    }
                }
            }
        } catch (error) {
            console.error(`[MCP:${this.serverId}] Stream error:`, error);
        } finally {
            reader.releaseLock();

            // For Streamable HTTP: streams close after each response, which is normal
            // For HTTP+SSE: stream should stay open, so reconnect if it closes unexpectedly
            if (this.transportType === 'http-sse' && !this.isDisconnecting && this.currentStatus.state !== 'disconnected') {
                console.log(`[MCP:${this.serverId}] HTTP+SSE stream ended unexpectedly, scheduling reconnect`);
                this.scheduleReconnect();
            } else if (this.transportType === 'streamable-http') {
                console.log(`[MCP:${this.serverId}] Streamable HTTP stream closed (normal after response)`);
                // Don't reconnect - Streamable HTTP opens new streams per request
            } else {
                console.log(`[MCP:${this.serverId}] Stream ended (intentional disconnect)`);
            }
        }
    }

    /**
     * Handle incoming SSE message
     */
    private handleMessage(message: McpMessage): void {
        console.log(`[MCP:${this.serverId}] Handling message:`, JSON.stringify(message, null, 2));
        console.log(`[MCP:${this.serverId}] Pending requests:`, Array.from(this.pendingRequests.keys()));
        this.onMessage(message);

        // Handle responses to our requests
        if (message.id && this.pendingRequests.has(message.id)) {
            const pending = this.pendingRequests.get(message.id)!;
            this.pendingRequests.delete(message.id);

            if (message.error) {
                pending.reject(new Error(message.error.message));
            } else {
                console.log(`[MCP:${this.serverId}] Resolving request ${message.id} with result:`, message.result);
                pending.resolve(message.result);
            }
        } else {
            console.log(`[MCP:${this.serverId}] No pending request found for message ID:`, message.id);
        }
    }

    /**
     * Get the full POST endpoint URL
     * Handles both Streamable HTTP and HTTP+SSE transports
     */
    private getPostUrl(): string {
        if (this.transportType === 'streamable-http') {
            // New transport: use the same endpoint for all requests
            return this.sseUrl;
        }

        // Old HTTP+SSE transport: use the endpoint from SSE 'endpoint' event
        if (!this.messageEndpoint) {
            throw new Error('Message endpoint not available. SSE connection may not be established.');
        }

        // If endpoint is relative, construct full URL
        if (this.messageEndpoint.startsWith('/')) {
            const url = new URL(this.sseUrl);
            return `${url.origin}${this.messageEndpoint}`;
        }

        // If endpoint is already absolute, use it as-is
        return this.messageEndpoint;
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
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'MCP-Protocol-Version': '2025-06-18'
        };

        // Include session ID if available
        if (this.sessionId) {
            headers['Mcp-Session-Id'] = this.sessionId;
        }

        // Per MCP spec: use the endpoint from SSE 'endpoint' event for POST requests
        const postUrl = this.getPostUrl();
        console.log(`[MCP:${this.serverId}] Sending notification to:`, postUrl);

        // Send notification - no response expected (should return 202 Accepted)
        const response = await fetch(postUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[MCP:${this.serverId}] Notification failed:`, response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        console.log(`[MCP:${this.serverId}] Notification sent:`, method);
    }

    /**
     * Send a request over SSE (via POST to endpoint from SSE 'endpoint' event)
     * Per MCP spec: SSE for receiving, POST to endpoint provided by server for sending
     */
    async sendRequest(method: string, params?: any, options?: { skipSessionId?: boolean }): Promise<any> {
        const id = ++this.messageId;
        const message: McpMessage = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });

            // Build headers
            const headers: Record<string, string> = {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
                'MCP-Protocol-Version': '2025-06-18'
            };

            // Include session ID if available
            const isInitialize = method === 'initialize';
            if (!isInitialize && this.sessionId) {
                headers['Mcp-Session-Id'] = this.sessionId;
            }

            // Per MCP spec: use the endpoint from SSE 'endpoint' event for POST requests
            const postUrl = this.getPostUrl();
            console.log(`[MCP:${this.serverId}] Sending request to:`, postUrl, 'Method:', method);

            // Send via POST to the message endpoint (from SSE endpoint event)
            fetch(postUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(message)
            })
                .then(async response => {
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`[MCP:${this.serverId}] Request failed:`, response.status, errorText);
                        throw new Error(`HTTP ${response.status}: ${errorText}`);
                    }

                    // Extract session ID from response headers if this is initialization
                    if (isInitialize) {
                        const sessionIdHeader = response.headers.get('Mcp-Session-Id');
                        if (sessionIdHeader) {
                            this.sessionId = sessionIdHeader;
                            console.log(`[MCP:${this.serverId}] Session ID from init response:`, this.sessionId);
                        }
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
                                            this.handleMessage(result);
                                            return;
                                        }
                                    } catch (err) {
                                        console.error(`[MCP:${this.serverId}] Failed to parse SSE data:`, err);
                                    }
                                }
                            }
                        }
                    } else if (contentType.includes('application/json')) {
                        // Response is JSON - parse directly
                        const result = await response.json();
                        if (result.id === id) {
                            this.handleMessage(result);
                        }
                    } else {
                        throw new Error(`Unexpected content type: ${contentType}`);
                    }
                })
                .catch(error => {
                    this.pendingRequests.delete(id);
                    reject(error);
                });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Wait for message endpoint to be available
     */
    private async waitForEndpoint(timeoutMs: number = 10000): Promise<void> {
        const startTime = Date.now();
        while (!this.messageEndpoint) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error('Timeout waiting for message endpoint from SSE');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * Initialize the MCP connection
     * Handles both Streamable HTTP and HTTP+SSE transports
     */
    async initialize(): Promise<void> {
        if (this.transportType === 'streamable-http') {
            // New Streamable HTTP transport: initialize was sent during connection
            console.log(`[MCP:${this.serverId}] Waiting for initialization response...`);

            // Wait for initialization promise with timeout
            await Promise.race([
                this.initializePromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Initialization timeout')), 10000)
                )
            ]);

            if (!this.initialized) {
                throw new Error('Initialization failed');
            }

            console.log(`[MCP:${this.serverId}] ✓ Initialized via Streamable HTTP`);
        } else {
            // Old HTTP+SSE transport: Wait for endpoint event, then send initialize
            console.log(`[MCP:${this.serverId}] Waiting for message endpoint from SSE...`);
            await this.waitForEndpoint();
            console.log(`[MCP:${this.serverId}] Message endpoint ready, sending initialize request`);

            const params: McpInitializeRequest['params'] = {
                protocolVersion: '2024-11-05',
                capabilities: {
                    experimental: {},
                    roots: { listChanged: true }
                },
                clientInfo: {
                    name: 'chrome-ai-extension',
                    version: '0.0.1'
                }
            };

            // Send initialize request
            // Session ID will be extracted from response headers
            const result = await this.sendRequest('initialize', params);
            this.initializeResult = result;
            this.initialized = true;
            console.log(`[MCP:${this.serverId}] ✓ Initialized via HTTP+SSE:`, result);
        }

        // Verify session ID was received (if server uses sessions)
        if (this.sessionId) {
            console.log(`[MCP:${this.serverId}] Session established:`, this.sessionId);
        } else {
            console.log(`[MCP:${this.serverId}] Server does not use session management`);
        }

        // After initialization, send initialized notification (no response expected)
        await this.sendNotification('notifications/initialized');

        // Fetch available tools
        await this.fetchTools();
    }

    /**
     * Fetch available tools from MCP server
     */
    async fetchTools(): Promise<void> {
        try {
            const result: McpToolsListResponse = await this.sendRequest('tools/list');
            this.currentStatus.tools = result.tools;
            this.onStatusChange(this.currentStatus);
            console.log(`[MCP:${this.serverId}] Tools:`, result.tools);
        } catch (error) {
            console.error(`[MCP:${this.serverId}] Failed to fetch tools:`, error);
        }
    }

    /**
     * Call a tool
     */
    async callTool(name: string, args?: Record<string, any>): Promise<any> {
        return this.sendRequest('tools/call', { name, arguments: args });
    }

    /**
     * Update connection status
     */
    private updateStatus(state: McpConnectionState, error?: string): void {
        this.currentStatus = {
            ...this.currentStatus,
            serverId: this.serverId,
            state,
            error,
            lastConnected: state === 'connected' ? Date.now() : this.currentStatus.lastConnected
        };
        this.onStatusChange(this.currentStatus);
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimeout) return;

        const delay = Math.min(
            this.config.reconnectMinDelay * Math.pow(this.config.reconnectMultiplier, this.reconnectAttempts),
            this.config.reconnectMaxDelay
        );

        this.reconnectAttempts++;
        this.updateStatus('connecting', `Reconnecting in ${Math.round(delay / 1000)}s...`);

        // Use global setTimeout (works in both browser and service worker contexts)
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, delay) as any;
    }

    /**
     * Disconnect and cleanup
     */
    disconnect(): void {
        this.isDisconnecting = true;

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error('Disconnected'));
        }
        this.pendingRequests.clear();

        this.updateStatus('disconnected');
        this.isDisconnecting = false;
    }

    /**
     * Get current status
     */
    getStatus(): McpServerStatus {
        return this.currentStatus;
    }
}

