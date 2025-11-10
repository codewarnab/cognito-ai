/**
 * MCP Events Broadcasting
 * 
 * Handles broadcasting of MCP server status updates to all extension contexts
 * (sidepanel, options page, etc.).
 */

import type { McpServerStatus } from './types';

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
    chrome.runtime.sendMessage({
        type: `mcp/${serverId}/status/update`,
        payload: status
    }).catch(() => {
        // Ignore errors if no listeners
    });
}
