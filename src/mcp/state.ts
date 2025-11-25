/**
 * MCP Server State Management
 * 
 * Centralized state management for all MCP servers to prevent circular imports.
 * Each server maintains its own connection state, tokens, credentials, and status.
 */

import type { McpOAuthTokens, McpServerStatus, OAuthEndpoints, OAuthState } from './types';
import type { DynamicClientCredentials } from './oauth';
import type { McpSSEClient } from './sseClient';
import { MCP_SERVERS, type ServerConfig } from '@/constants/mcpServers';
import { createLogger } from '~logger';

const log = createLogger('MCP-State', 'MCP_CLIENT');

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
 * Cache for custom MCP servers loaded from chrome.storage.local
 * This cache is populated on background startup and updated when servers are added/removed
 */
let customServersCache: ServerConfig[] = [];

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
 * Retrieves the configuration for a given server ID from:
 * 1. The centralized MCP_SERVERS configuration array (official servers)
 * 2. The custom servers cache (user-added servers)
 * 
 * @param serverId - The unique identifier for the MCP server
 * @returns The server configuration or null if not found
 */
export function getServerConfig(serverId: string): ServerConfig | null {
    // First check official servers
    const officialServer = MCP_SERVERS.find(s => s.id === serverId);
    if (officialServer) return officialServer;

    // Then check custom servers cache
    const customServer = customServersCache.find(s => s.id === serverId);
    if (customServer) return customServer;

    return null;
}

/**
 * Storage key for custom MCP servers
 */
const CUSTOM_SERVERS_STORAGE_KEY = 'customMcpServers';

/**
 * Load custom servers from chrome.storage.local into cache
 * Called on background startup to ensure custom servers are available
 */
export async function loadCustomServersCache(): Promise<void> {
    try {
        const result = await chrome.storage.local.get(CUSTOM_SERVERS_STORAGE_KEY);
        const stored = result[CUSTOM_SERVERS_STORAGE_KEY];
        if (stored && Array.isArray(stored)) {
            customServersCache = stored.map((server: any) => ({
                id: server.id,
                name: server.name,
                url: server.url,
                description: server.description,
                icon: null, // Icon will be rendered in UI from image data
                requiresAuthentication: server.requiresAuthentication,
                initialEnabled: server.initialEnabled ?? false,
                initialAuthenticated: server.initialAuthenticated ?? false,
                isCustom: true,
                imageData: server.image // Store base64 image data
            }));
            log.info(`Loaded ${customServersCache.length} custom MCP servers from storage`);
        } else {
            customServersCache = [];
        }
    } catch (error) {
        log.error('Failed to load custom MCP servers from storage:', error);
        customServersCache = [];
    }
}

/**
 * Get all custom servers from cache
 */
export function getCustomServers(): ServerConfig[] {
    return [...customServersCache];
}

/**
 * Add a custom server to storage and cache
 */
export async function addCustomServer(server: {
    id: string;
    name: string;
    url: string;
    description: string;
    image?: string;
    requiresAuthentication: boolean;
}): Promise<void> {
    const newServer = {
        ...server,
        initialEnabled: false,
        initialAuthenticated: false,
        isCustom: true
    };

    // Get existing servers from storage
    const result = await chrome.storage.local.get(CUSTOM_SERVERS_STORAGE_KEY);
    const existing = result[CUSTOM_SERVERS_STORAGE_KEY] || [];

    // Add new server
    const updated = [...existing, newServer];
    await chrome.storage.local.set({ [CUSTOM_SERVERS_STORAGE_KEY]: updated });

    // Update cache
    customServersCache.push({
        id: server.id,
        name: server.name,
        url: server.url,
        description: server.description,
        icon: null,
        requiresAuthentication: server.requiresAuthentication,
        initialEnabled: false,
        initialAuthenticated: false,
        isCustom: true,
        imageData: server.image
    } as ServerConfig);

    log.info(`Added custom MCP server: ${server.name} (${server.id})`);
}

/**
 * Remove a custom server from storage and cache
 */
export async function removeCustomServer(serverId: string): Promise<void> {
    // Get existing servers from storage
    const result = await chrome.storage.local.get(CUSTOM_SERVERS_STORAGE_KEY);
    const existing = result[CUSTOM_SERVERS_STORAGE_KEY] || [];

    // Remove server
    const updated = existing.filter((s: any) => s.id !== serverId);
    await chrome.storage.local.set({ [CUSTOM_SERVERS_STORAGE_KEY]: updated });

    // Update cache
    customServersCache = customServersCache.filter(s => s.id !== serverId);

    // Clean up server state
    serverStates.delete(serverId);

    log.info(`Removed custom MCP server: ${serverId}`);
}

/**
 * Get all custom servers directly from storage (for UI that needs fresh data)
 */
export async function getCustomServersFromStorage(): Promise<any[]> {
    try {
        const result = await chrome.storage.local.get(CUSTOM_SERVERS_STORAGE_KEY);
        return result[CUSTOM_SERVERS_STORAGE_KEY] || [];
    } catch (error) {
        log.error('Failed to get custom servers from storage:', error);
        return [];
    }
}
