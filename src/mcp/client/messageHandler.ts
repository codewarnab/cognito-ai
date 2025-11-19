/**
 * Message handling and routing for MCP SSE Client
 */

import type { McpMessage } from '../types';
import { createLogger } from '@logger';

const log = createLogger('MCP-SSE', 'MCP_SSE');

export interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

export interface MessageHandlerCallbacks {
    onMessage: (message: McpMessage) => void;
}

export class MessageHandler {
    private pendingRequests = new Map<string | number, PendingRequest>();

    constructor(
        private serverId: string,
        private callbacks: MessageHandlerCallbacks
    ) { }

    /**
     * Handle incoming SSE message
     */
    handleMessage(message: McpMessage): void {
        log.info(`[${this.serverId}] Handling message:`, JSON.stringify(message, null, 2));
        log.info(`[${this.serverId}] Pending requests:`, Array.from(this.pendingRequests.keys()));

        this.callbacks.onMessage(message);

        // Handle responses to our requests
        if (message.id && this.pendingRequests.has(message.id)) {
            const pending = this.pendingRequests.get(message.id)!;
            this.pendingRequests.delete(message.id);

            if (message.error) {
                pending.reject(new Error(message.error.message));
            } else {
                log.info(`[${this.serverId}] Resolving request ${message.id} with result:`, message.result);
                pending.resolve(message.result);
            }
        } else {
            log.info(`[${this.serverId}] No pending request found for message ID:`, message.id);
        }
    }

    /**
     * Add a pending request
     */
    addPendingRequest(id: string | number, request: PendingRequest): void {
        this.pendingRequests.set(id, request);
    }

    /**
     * Check if a request is pending
     */
    hasPendingRequest(id: string | number): boolean {
        return this.pendingRequests.has(id);
    }

    /**
     * Remove a pending request
     */
    removePendingRequest(id: string | number): void {
        this.pendingRequests.delete(id);
    }

    /**
     * Clear all pending requests (e.g., on disconnect)
     */
    clearAllPendingRequests(error?: string): void {
        for (const [_id, pending] of this.pendingRequests) {
            pending.reject(new Error(error || 'Disconnected'));
        }
        this.pendingRequests.clear();
    }

    /**
     * Get count of pending requests
     */
    getPendingCount(): number {
        return this.pendingRequests.size;
    }
}
