/**
 * Generic MCP SSE Client
 * Handles Server-Sent Events connection to MCP servers
 * 
 * Enhanced with comprehensive error handling:
 * - Automatic retry with exponential backoff
 * - Detailed error categorization (network, auth, server errors)
 * - Rate limit detection and handling
 * - Connection recovery and reconnection
 */

import type {
    McpMessage,
    McpInitializeRequest,
    McpToolsListResponse,
    McpServerStatus,
    McpConnectionState
} from '../types';
import { createLogger } from '@logger';
import { mergeConfig, type SSEClientConfig } from './config';
import { ErrorHandler } from './errorHandler';
import { MessageHandler } from './messageHandler';
import { RequestManager } from './requestManager';
import { StreamProcessor } from './streamProcessor';
import { TransportDetector } from './transportDetector';
import { ConnectionManager } from './connectionManager';

const log = createLogger('MCP-SSE', 'MCP_SSE');

/**
 * Generic MCP SSE Client for any MCP server
 */
export class McpSSEClient {
    private serverId: string;
    private sseUrl: string;
    private accessToken: string;
    private sessionId: string | null = null; // MCP session ID from initialization
    private onStatusChange: (status: McpServerStatus) => void;
    private onMessage: (message: McpMessage) => void;
    private currentStatus: McpServerStatus;
    private config: Required<SSEClientConfig>;

    // Initialization tracking
    private initialized = false;
    private initializePromise: Promise<void> | null = null;
    // Used by transportDetector callbacks - values are written but not directly read in this class
    // @ts-ignore - used by callbacks
    private _initializeResolve: (() => void) | null = null;
    // @ts-ignore - used by callbacks
    private _initializeResult: any = null;

    // Component managers
    private errorHandler: ErrorHandler;
    private messageHandler: MessageHandler;
    private requestManager: RequestManager;
    private streamProcessor: StreamProcessor;
    private transportDetector: TransportDetector;
    private connectionManager: ConnectionManager;

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

        this.config = mergeConfig(config);

        // Initialize component managers
        this.errorHandler = new ErrorHandler(this.serverId, {
            updateStatus: this.updateStatus.bind(this)
        });

        this.messageHandler = new MessageHandler(this.serverId, {
            onMessage: this.onMessage
        });

        this.requestManager = new RequestManager({
            serverId: this.serverId,
            accessToken: this.accessToken,
            config: this.config,
            messageHandler: this.messageHandler,
            errorHandler: this.errorHandler,
            getSessionId: () => this.sessionId,
            getPostUrl: () => this.transportDetector.getPostUrl()
        });

        this.transportDetector = new TransportDetector({
            serverId: this.serverId,
            sseUrl: this.sseUrl,
            accessToken: this.accessToken,
            messageHandler: this.messageHandler,
            errorHandler: this.errorHandler,
            setSessionId: (id) => { this.sessionId = id; },
            setInitializePromise: (promise) => { this.initializePromise = promise; },
            setInitializeResolve: (resolve) => { this._initializeResolve = resolve; },
            setInitializeResult: (result) => { this._initializeResult = result; },
            setInitialized: (initialized) => { this.initialized = initialized; }
        });

        this.streamProcessor = new StreamProcessor(
            {
                serverId: this.serverId,
                transportType: null, // Will be set by transportDetector
                messageHandler: this.messageHandler,
                errorHandler: this.errorHandler,
                isDisconnecting: () => this.connectionManager.getIsDisconnecting(),
                getCurrentState: () => this.currentStatus.state
            },
            {
                onEndpointReceived: (endpoint, sessionId) => {
                    this.transportDetector.setMessageEndpoint(endpoint, sessionId);
                },
                onStreamEnd: () => {
                    // Stream ended - handled by connectionManager
                }
            }
        );

        // Update stream processor's transport type getter
        Object.defineProperty(this.streamProcessor['deps'], 'transportType', {
            get: () => this.transportDetector.getTransportType()
        });

        this.connectionManager = new ConnectionManager(
            {
                serverId: this.serverId,
                config: this.config,
                errorHandler: this.errorHandler,
                transportDetector: this.transportDetector,
                streamProcessor: this.streamProcessor,
                messageHandler: this.messageHandler,
                getNextMessageId: () => this.requestManager.getNextMessageId()
            },
            {
                updateStatus: this.updateStatus.bind(this),
                onConnected: () => {
                    // Connection established callback
                }
            }
        );
    }

    /**
     * Connect to the SSE endpoint
     */
    async connect(): Promise<void> {
        await this.connectionManager.connect();
    }

    /**
     * Initialize the MCP connection
     * Handles both Streamable HTTP and HTTP+SSE transports
     */
    async initialize(): Promise<void> {
        if (this.transportDetector.getTransportType() === 'streamable-http') {
            // New Streamable HTTP transport: initialize was sent during connection
            log.info(`[${this.serverId}] Waiting for initialization response...`);

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

            log.info(`[${this.serverId}] ✓ Initialized via Streamable HTTP`);
        } else {
            // Old HTTP+SSE transport: Wait for endpoint event, then send initialize
            log.info(`[${this.serverId}] Waiting for message endpoint from SSE...`);
            await this.transportDetector.waitForEndpoint();
            log.info(`[${this.serverId}] Message endpoint ready, sending initialize request`);

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
            const result = await this.requestManager.sendRequest('initialize', params);
            this._initializeResult = result;
            this.initialized = true;
            log.info(`[${this.serverId}] ✓ Initialized via HTTP+SSE:`, result);
        }

        // Verify session ID was received (if server uses sessions)
        if (this.sessionId) {
            log.info(`[${this.serverId}] Session established:`, this.sessionId);
        } else {
            log.info(`[${this.serverId}] Server does not use session management`);
        }

        // After initialization, send initialized notification (no response expected)
        await this.requestManager.sendNotification('notifications/initialized');

        // Fetch available tools
        await this.fetchTools();
    }

    /**
     * Fetch available tools from MCP server
     */
    async fetchTools(): Promise<void> {
        try {
            const result: McpToolsListResponse = await this.requestManager.sendRequest('tools/list');
            this.currentStatus.tools = result.tools;
            this.onStatusChange(this.currentStatus);
            log.info(`[${this.serverId}] Tools:`, result.tools);
        } catch (error) {
            log.error(`[${this.serverId}] Failed to fetch tools:`, error);
        }
    }

    /**
     * Get available tools (returns cached tools from status)
     */
    async listTools(): Promise<{ tools: any[] }> {
        // Return cached tools from status
        return { tools: this.currentStatus.tools || [] };
    }

    /**
     * Call a tool
     */
    async callTool(name: string, args?: Record<string, any>): Promise<any> {
        return this.requestManager.sendRequest('tools/call', { name, arguments: args });
    }

    /**
     * Send a notification (no response expected)
     */
    async sendNotification(method: string, params?: any): Promise<void> {
        return this.requestManager.sendNotification(method, params);
    }

    /**
     * Send a request
     */
    async sendRequest(method: string, params?: any, options?: { skipSessionId?: boolean }): Promise<any> {
        return this.requestManager.sendRequest(method, params, options);
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
     * Disconnect and cleanup
     */
    disconnect(): void {
        this.connectionManager.disconnect();
    }

    /**
     * Get current status
     */
    getStatus(): McpServerStatus {
        return this.currentStatus;
    }
}
