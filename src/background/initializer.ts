/**
 * MCP Server Initialization Module
 * 
 * Handles server initialization on startup:
 * - Restores authentication state from storage
 * - Reconnects enabled servers
 * - Validates and refreshes tokens
 */

import { createLogger } from '~logger';
import { getStoredTokens, getStoredClientCredentials } from '../mcp/oauth';
import { getServerState } from '../mcp/state';
import { MCP_SERVERS } from '../constants/mcpServers';
import { ensureTokenValidity, refreshServerToken } from '../mcp/authHelpers';
import { updateKeepAliveState } from './keepAlive';
import { connectMcpServer } from './mcp/manager';

const log = createLogger('Background-Initializer', 'BACKGROUND');

/**
 * Initialize server status from stored tokens
 * Called on startup to restore authentication state
 */
async function initializeServerStatus(serverId: string): Promise<void> {
    const state = getServerState(serverId);
    const serverConfig = MCP_SERVERS.find(s => s.id === serverId);

    try {
        const tokens = await getStoredTokens(serverId);

        // Also restore OAuth endpoints from storage if available
        const { [`mcp.${serverId}.oauthEndpoints`]: storedEndpoints } = 
            await chrome.storage.local.get(`mcp.${serverId}.oauthEndpoints`);
        
        if (storedEndpoints) {
            state.oauthEndpoints = storedEndpoints;
            log.info(`[${serverId}] OAuth endpoints restored from storage`);
        }

        if (tokens) {
            // User has tokens, mark as authenticated
            state.status = { ...state.status, state: 'authenticated' };
            log.info(`[${serverId}] Status initialized: authenticated (tokens found)`);
        } else if (serverConfig && !serverConfig.requiresAuthentication) {
            // Server doesn't require authentication, mark as ready to connect
            state.status = { ...state.status, state: 'disconnected' };
            log.info(`[${serverId}] Status initialized: disconnected (no auth required)`);
        } else {
            // No tokens and server requires auth
            state.status = { ...state.status, state: 'needs-auth' };
            log.info(`[${serverId}] Status initialized: needs-auth (no tokens)`);
        }
    } catch (error) {
        log.error(`[${serverId}] Error initializing status:`, error);
        state.status = { ...state.status, state: 'disconnected' };
    }
}

/**
 * Initialize all MCP servers from storage
 * Restores connections for enabled servers on startup
 */
export async function initializeAllServers(): Promise<void> {
    log.info('Initializing all MCP servers');

    for (const serverConfig of MCP_SERVERS) {
        const serverId = serverConfig.id;

        try {
            // Initialize server status from stored tokens
            await initializeServerStatus(serverId);

            // Check if server is enabled
            const { [`mcp.${serverId}.enabled`]: isEnabled } = 
                await chrome.storage.local.get(`mcp.${serverId}.enabled`);
            const state = getServerState(serverId);
            state.isEnabled = isEnabled || false;

            // If enabled, try to restore connection
            if (isEnabled) {
                const [tokens, credentials] = await Promise.all([
                    getStoredTokens(serverId),
                    getStoredClientCredentials(serverId)
                ]);

                if (tokens && credentials) {
                    state.tokens = tokens;
                    state.credentials = credentials;

                    // Check token validity and schedule refresh if needed
                    const tokenValid = await ensureTokenValidity(serverId, refreshServerToken);

                    if (tokenValid) {
                        // Attempt to connect
                        await connectMcpServer(serverId);
                        log.info(`${serverConfig.name} restored and connected`);
                    } else {
                        log.info(`${serverConfig.name} needs re-authentication`);
                    }
                } else {
                    log.info(`${serverConfig.name} enabled but no credentials found`);
                }
            }
        } catch (error) {
            log.error(`Error initializing ${serverId}:`, error);
        }
    }

    // Start keep-alive if any servers are enabled
    log.info('Checking if keep-alive should start');
    updateKeepAliveState();
}
