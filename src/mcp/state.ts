/**
 * MCP Server State Management
 * 
 * Centralized state management for all MCP servers to prevent circular imports.
 * Each server maintains its own connection state, tokens, credentials, and status.
 */

import type { McpOAuthTokens, McpServerStatus, OAuthEndpoints, OAuthState } from './types';
import type { DynamicClientCredentials } from './oauth';
import type { McpSSEClient } from './sseClient';
import { MCP_SERVERS, type ServerConfig } from '../constants/mcpServers';

/**
 * State for each MCP server
 */
export interface ServerState {
    /** SSE client instance for this server */
    client: McpSSEClient | null;
    /** OAuth tokens for authentication */
    tokens: McpOAuthTokens | null;
    /** Dynamic client credentials from registration */
    credentials: DynamicClientCredentials | null;
    /** Current server status */
    status: McpServerStatus;
    /** Discovered OAuth endpoints */
    oauthEndpoints: OAuthEndpoints | null;
    /** OAuth state for CSRF protection */
    oauthState: OAuthState | null;
    /** Whether this server is currently enabled */
    isEnabled: boolean;
}

/**
 * Map of server states by serverId
 * Maintains the state for all configured MCP servers
 */
export const serverStates = new Map<string, ServerState>();

/**
 * Get or initialize server state
 * 
 * Creates a new state object with default values if the server hasn't been initialized yet.
 * This ensures every server has a consistent initial state.
 * 
 * @param serverId - The unique identifier for the MCP server
 * @returns The server state object
 */
export function getServerState(serverId: string): ServerState {
    if (!serverStates.has(serverId)) {
        serverStates.set(serverId, {
            client: null,
            tokens: null,
            credentials: null,
            status: { serverId, state: 'disconnected' },
            oauthEndpoints: null,
            oauthState: null,
            isEnabled: false
        });
    }
    return serverStates.get(serverId)!;
}

/**
 * Get server configuration by ID
 * 
 * Retrieves the static configuration for a given server ID from the centralized
 * MCP_SERVERS configuration array.
 * 
 * @param serverId - The unique identifier for the MCP server
 * @returns The server configuration or null if not found
 */
export function getServerConfig(serverId: string): ServerConfig | null {
    return MCP_SERVERS.find(s => s.id === serverId) || null;
}
