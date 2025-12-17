/**
 * MCP Events Broadcasting
 * 
 * Handles broadcasting of MCP server status updates to all extension contexts
 * (sidepanel, options page, etc.).
 */

import type { McpServerStatus, McpConnectionState } from './types';
import { trySendMcpMessage } from '@/lib/messaging';

/**
 * Broadcast status update to all listeners
 * 
 * Sends a status update message to all extension contexts that are listening for
 * MCP server status changes. Uses the Chrome runtime messaging API to broadcast
 * the update. If no listeners are present, the error is silently ignored.
 * 
 * Message format: `mcp/{serverId}/status/update`
 * 
 * @param serverId - The unique identifier for the MCP server
 * @param status - The current status of the server
 */
export function broadcastStatusUpdate(serverId: string, status: McpServerStatus): void {
    void trySendMcpMessage(serverId, 'status/update', {
        state: status.state as McpConnectionState,
        error: status.error,
        tools: status.tools,
    });
}
