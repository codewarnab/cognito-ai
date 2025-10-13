/**
 * Notion MCP SSE Client
 * Handles Server-Sent Events connection to Notion's hosted MCP server
 */

import { NOTION_CONFIG } from '../constants';
import type {
    McpMessage,
    McpInitializeRequest,
    McpToolsListResponse,
    McpToolCallRequest,
    NotionMcpStatus,
    McpConnectionState
} from './types';

/**
 * EventSource-like interface for SSE in extension context
 * Chrome extensions need special handling for SSE
 */
class McpSSEClient {
    private sseUrl: string;
    private baseUrl: string;
    private accessToken: string;
    private sessionId: string | null = null; // MCP session ID from initialization
    private sseSessionId: string | null = null; // SSE stream session ID for resumability
    private messageEndpoint: string | null = null;
    private eventSource: EventSource | null = null;
    private reconnectAttempts = 0;
    private reconnectTimeout: number | null = null;
    private messageId = 0;
    private pendingRequests = new Map<string | number, {
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }>();

    private onStatusChange: (status: NotionMcpStatus) => void;
    private onMessage: (message: McpMessage) => void;

    private currentStatus: NotionMcpStatus = {
        state: 'disconnected'
    };

    constructor(
        sseUrl: string,
        baseUrl: string,
        accessToken: string,
        callbacks: {
            onStatusChange: (status: NotionMcpStatus) => void;
            onMessage: (message: McpMessage) => void;
        }
    ) {
        this.sseUrl = sseUrl;
        this.baseUrl = baseUrl;
        this.accessToken = accessToken;
        this.onStatusChange = callbacks.onStatusChange;
        this.onMessage = callbacks.onMessage;
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
            console.error('[NotionMCP] Connection error:', error);
            this.updateStatus('error', error instanceof Error ? error.message : 'Connection failed');
            this.scheduleReconnect();
        }
    }

    /**
     * Connect using fetch and ReadableStream (MV3 compatible)
     */
    private async connectWithFetch(): Promise<void> {
        const response = await fetch(this.sseUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Accept': 'text/event-stream, application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.updateStatus('needs-auth', 'Token expired or invalid');
                throw new Error('Authentication required');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        this.reconnectAttempts = 0;
        this.updateStatus('connected');

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
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent: string | null = null;

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    console.log('[NotionMCP] Stream ended');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        // Handle SSE event types (e.g., "event: endpoint", "event: message")
                        currentEvent = line.slice(7).trim();
                        console.log('[NotionMCP] SSE event type:', currentEvent);
                        continue;
                    }

                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') continue;

                        // Handle endpoint event - extract SSE session ID (for resumability)
                        if (currentEvent === 'endpoint') {
                            // data format: /sse/message?sessionId=...
                            const match = data.match(/sessionId=([a-f0-9]+)/);
                            if (match) {
                                this.sseSessionId = match[1];
                                this.messageEndpoint = data;
                                console.log('[NotionMCP] SSE Session ID extracted:', this.sseSessionId);
                            }
                            currentEvent = null;
                            continue;
                        }

                        // Skip empty data or non-JSON data
                        if (!data || (!data.startsWith('{') && !data.startsWith('['))) {
                            console.log('[NotionMCP] Non-JSON SSE data:', data);
                            currentEvent = null;
                            continue;
                        }

                        try {
                            const message: McpMessage = JSON.parse(data);
                            this.handleMessage(message);
                        } catch (err) {
                            console.error('[NotionMCP] Failed to parse message:', err, 'Data:', data);
                        }

                        currentEvent = null;
                    }
                }
            }
        } catch (error) {
            console.error('[NotionMCP] Stream error:', error);
        } finally {
            reader.releaseLock();
            // Connection closed, attempt reconnect
            this.scheduleReconnect();
        }
    }

    /**
     * Handle incoming SSE message
     */
    private handleMessage(message: McpMessage): void {
        this.onMessage(message);

        // Handle responses to our requests
        if (message.id && this.pendingRequests.has(message.id)) {
            const pending = this.pendingRequests.get(message.id)!;
            this.pendingRequests.delete(message.id);

            if (message.error) {
                pending.reject(new Error(message.error.message));
            } else {
                pending.resolve(message.result);
            }
        }
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
            'Accept': 'application/json, text/event-stream', // Required by MCP spec
            'MCP-Protocol-Version': '2025-06-18'
        };

        // Include session ID if available
        if (this.sessionId) {
            headers['Mcp-Session-Id'] = this.sessionId;
        }

        // Send notification - no response expected (should return 202 Accepted)
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[NotionMCP] Notification failed:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        console.log('[NotionMCP] Notification sent:', method);
    }

    /**
     * Send a request over SSE (via POST to separate endpoint if needed)
     * Note: Traditional SSE is read-only. For bidirectional, we'd need WebSocket or separate POST endpoint.
     * For now, we'll use a hybrid approach: SSE for receiving, POST to base MCP URL for sending.
     */
    async sendRequest(method: string, params?: any, options?: { skipSessionId?: boolean }): Promise<any> {
        // Wait for session ID to be available (unless this is initialization)
        const isInitialize = method === 'initialize';
        if (!isInitialize && !this.sessionId) {
            throw new Error('Session ID not available. Ensure SSE connection is established first.');
        }

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
                'MCP-Protocol-Version': '2025-06-18' // Latest protocol version
            };

            // Only include session ID for non-initialization requests
            if (!isInitialize && this.sessionId) {
                headers['Mcp-Session-Id'] = this.sessionId;
            }

            // Send via POST to the base MCP endpoint (not /sse)
            fetch(this.baseUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(message)
            })
                .then(async response => {
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('[NotionMCP] Request failed:', response.status, errorText);
                        throw new Error(`HTTP ${response.status}: ${errorText}`);
                    }

                    // Extract session ID from response headers if this is initialization
                    if (isInitialize) {
                        const sessionIdHeader = response.headers.get('Mcp-Session-Id');
                        if (sessionIdHeader) {
                            this.sessionId = sessionIdHeader;
                            console.log('[NotionMCP] Session ID from init response:', this.sessionId);
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
                                        console.error('[NotionMCP] Failed to parse SSE data:', err);
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
     * Initialize the MCP connection
     */
    async initialize(): Promise<void> {
        const params: McpInitializeRequest['params'] = {
            protocolVersion: '2025-06-18', // Latest MCP protocol version
            capabilities: {
                experimental: {},
                roots: { listChanged: true }
            },
            clientInfo: {
                name: 'chrome-ai-extension',
                version: '0.0.1'
            }
        };

        // Send initialize request (without session ID)
        // Session ID will be extracted from response headers
        const result = await this.sendRequest('initialize', params);
        console.log('[NotionMCP] Initialized:', result);

        // Verify session ID was received (if server uses sessions)
        if (this.sessionId) {
            console.log('[NotionMCP] Session established:', this.sessionId);
        } else {
            console.log('[NotionMCP] Server does not use session management');
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
            console.log('[NotionMCP] Tools:', result.tools);
        } catch (error) {
            console.error('[NotionMCP] Failed to fetch tools:', error);
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
            NOTION_CONFIG.RECONNECT_MIN_DELAY * Math.pow(NOTION_CONFIG.RECONNECT_MULTIPLIER, this.reconnectAttempts),
            NOTION_CONFIG.RECONNECT_MAX_DELAY
        );

        this.reconnectAttempts++;
        this.updateStatus('connecting', `Reconnecting in ${Math.round(delay / 1000)}s...`);

        this.reconnectTimeout = window.setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, delay);
    }

    /**
     * Disconnect and cleanup
     */
    disconnect(): void {
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
    }

    /**
     * Get current status
     */
    getStatus(): NotionMcpStatus {
        return this.currentStatus;
    }
}

export { McpSSEClient };
