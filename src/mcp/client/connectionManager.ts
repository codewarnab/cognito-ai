/**
 * Connection management with automatic reconnection and exponential backoff
 */

import { createLogger } from '../../logger';
import { RetryManager } from '../../errors/retryManager';
import { buildUserMessage } from '../../errors/errorMessages';
import type { McpConnectionState } from '../types';
import type { SSEClientConfig } from './config';
import type { ErrorHandler } from './errorHandler';
import type { TransportDetector } from './transportDetector';
import type { StreamProcessor } from './streamProcessor';
import type { MessageHandler } from './messageHandler';

const log = createLogger('MCP-SSE', 'MCP_SSE');

export interface ConnectionManagerCallbacks {
    updateStatus: (state: McpConnectionState, error?: string) => void;
    onConnected: () => void;
}

export interface ConnectionManagerDeps {
    serverId: string;
    config: Required<SSEClientConfig>;
    errorHandler: ErrorHandler;
    transportDetector: TransportDetector;
    streamProcessor: StreamProcessor;
    messageHandler: MessageHandler;
    getNextMessageId: () => number;
}

export class ConnectionManager {
    private reconnectAttempts = 0;
    private reconnectTimeout: number | null = null;
    private retryManager: RetryManager;
    private consecutiveErrors = 0;
    private isDisconnecting = false;

    constructor(
        private deps: ConnectionManagerDeps,
        private callbacks: ConnectionManagerCallbacks
    ) {
        // Initialize retry manager for connection attempts
        this.retryManager = new RetryManager({
            maxRetries: this.deps.config.maxReconnectAttempts,
            initialDelay: this.deps.config.reconnectMinDelay,
            maxDelay: this.deps.config.reconnectMaxDelay,
            backoffMultiplier: this.deps.config.reconnectMultiplier,
            onRetry: (attempt, delay, error) => {
                log.info(`[${this.deps.serverId}] Retry attempt ${attempt} after ${delay}ms`, error.message);
                this.callbacks.updateStatus('connecting', `Reconnecting... (Attempt ${attempt}/${this.deps.config.maxReconnectAttempts})`);
            },
        });
    }

    /**
     * Connect to the SSE endpoint with comprehensive error handling
     * 
     * Handles:
     * - Connection failures with automatic retry
     * - Error categorization (network, auth, server)
     * - Exponential backoff on failures
     */
    async connect(): Promise<void> {
        this.callbacks.updateStatus('connecting');

        try {
            // Use retry manager for connection attempts
            await this.retryManager.execute(async () => {
                await this.connectWithFetch();
            });

            // Reset error tracking on successful connection
            this.consecutiveErrors = 0;
        } catch (error) {
            log.error(`[${this.deps.serverId}] Connection error:`, error);

            // Categorize and handle the error
            const appError = this.deps.errorHandler.categorizeConnectionError(error);
            const errorMessage = buildUserMessage(appError);

            this.callbacks.updateStatus('error', errorMessage);
            this.consecutiveErrors++;

            // Only schedule reconnect if we haven't exceeded max attempts
            if (this.consecutiveErrors < this.deps.config.maxReconnectAttempts) {
                this.scheduleReconnect();
            } else {
                log.error(`[${this.deps.serverId}] Max reconnection attempts exceeded`);
                this.callbacks.updateStatus('error', 'Connection failed after multiple attempts. Please try again later.');
            }
        }
    }

    /**
     * Connect using fetch and ReadableStream (MV3 compatible)
     * Supports both Streamable HTTP (2025-06-18) and HTTP+SSE (2024-11-05) transports
     */
    private async connectWithFetch(): Promise<void> {
        // Detect transport and get response
        const messageId = this.deps.getNextMessageId();
        const response = await this.deps.transportDetector.detectAndConnect(messageId);

        this.reconnectAttempts = 0;

        // For Streamable HTTP: Update status to 'connected' immediately after 200 response
        // This ensures UI shows connected state right away, even if initialization takes time
        if (this.deps.transportDetector.getTransportType() === 'streamable-http') {
            this.callbacks.updateStatus('connected');
            log.info(`[${this.deps.serverId}] ✓ Connection established (200 OK), processing stream...`);
        } else {
            // For HTTP+SSE: Update status now
            this.callbacks.updateStatus('connected');
        }

        // Notify connection established
        this.callbacks.onConnected();

        // Process the stream in the background (don't await)
        this.processStreamAsync(response.body!);
    }

    /**
     * Process stream asynchronously with error handling
     */
    private async processStreamAsync(body: ReadableStream<Uint8Array>): Promise<void> {
        try {
            await this.deps.streamProcessor.processStream(body);
        } catch (error: any) {
            // Handle stream errors
            if (error.error && error.message) {
                this.callbacks.updateStatus('error', error.message);
            }
        }

        // Check if we should reconnect after stream ends
        if (this.deps.streamProcessor.shouldReconnect()) {
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect(): void {
        if (this.reconnectTimeout) return;

        const delay = Math.min(
            this.deps.config.reconnectMinDelay * Math.pow(this.deps.config.reconnectMultiplier, this.reconnectAttempts),
            this.deps.config.reconnectMaxDelay
        );

        this.reconnectAttempts++;
        this.callbacks.updateStatus('connecting', `Reconnecting in ${Math.round(delay / 1000)}s...`);

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

        // Reject all pending requests
        this.deps.messageHandler.clearAllPendingRequests('Disconnected');

        this.callbacks.updateStatus('disconnected');
        this.isDisconnecting = false;
    }

    /**
     * Check if currently disconnecting
     */
    getIsDisconnecting(): boolean {
        return this.isDisconnecting;
    }

    /**
     * Reset reconnection state
     */
    resetReconnectionState(): void {
        this.reconnectAttempts = 0;
        this.consecutiveErrors = 0;
    }
}
