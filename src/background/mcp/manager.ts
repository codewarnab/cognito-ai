/**
 * MCP Connection Manager Module
 * 
 * Handles connecting, disconnecting, enabling, and disabling MCP servers.
 */

import { McpSSEClient } from '../../mcp/sseClient';
import type { McpExtensionResponse } from '../../mcp/types';
import { getServerState, getServerConfig } from '../../mcp/state';
import { broadcastStatusUpdate } from '../../mcp/events';
import { ensureValidToken, refreshServerToken } from '../../mcp/authHelpers';
import { getStoredTokens } from '../../mcp/oauth';
import { updateKeepAliveState } from '../keepAlive';
import { MCP_OAUTH_CONFIG } from '@constants';
import { MCPError, NetworkError } from '../../errors';
import { buildUserMessage } from '../../errors/errorMessages';
import { createLogger } from '~logger';

const mcpLog = createLogger('Background-MCP', 'MCP_CLIENT');

// Forward declarations to avoid circular dependencies
// These will be set by auth.ts after it loads
let handleTokenExpiry: ((serverId: string) => Promise<void>) | null = null;
let handleInvalidToken: ((serverId: string) => Promise<void>) | null = null;

/**
 * Register auth handlers from auth.ts to avoid circular dependencies
 */
export function registerAuthHandlers(
    tokenExpiryHandler: (serverId: string) => Promise<void>,
    invalidTokenHandler: (serverId: string) => Promise<void>
): void {
    handleTokenExpiry = tokenExpiryHandler;
    handleInvalidToken = invalidTokenHandler;
}

/**
 * Connect to any MCP server with comprehensive error handling
 * 
 * Error handling:
 * - Validates server configuration before connection
 * - Categorizes connection failures (auth, network, server)
 * - Returns structured error responses
 * - Handles token refresh automatically
 */
export async function connectMcpServer(serverId: string): Promise<McpExtensionResponse> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    if (!serverConfig) {
        const error = new Error(`Server config not found for ${serverId}`);
        mcpLog.error(`[${serverId}]`, error.message);
        return {
            success: false,
            error: error.message
        };
    }

    if (!serverConfig.url) {
        const error = new Error(`No URL configured for ${serverId}`);
        mcpLog.error(`[${serverId}]`, error.message);
        return {
            success: false,
            error: error.message
        };
    }

    try {
        mcpLog.info(`[${serverId}] Connecting to MCP server`);

        // Only require token for servers that need authentication
        let accessToken: string | null = null;
        if (serverConfig.requiresAuthentication) {
            accessToken = await ensureValidToken(serverId, refreshServerToken);
            if (!accessToken) {
                const error = MCPError.authFailed(
                    serverId,
                    'No valid access token available. Authentication required.'
                );
                return {
                    success: false,
                    error: buildUserMessage(error)
                };
            }
        } else {
            // For servers that don't require authentication, use empty string
            accessToken = '';
            mcpLog.info(`[${serverId}] Server does not require authentication, proceeding without token`);
        }

        // Create SSE client with error handling callbacks
        state.client = new McpSSEClient(
            serverId,
            serverConfig.url,
            accessToken,
            {
                onStatusChange: (status) => {
                    state.status = status;
                    broadcastStatusUpdate(serverId, status);

                    // Handle token expiry (but not format errors)
                    if (status.state === 'needs-auth' && handleTokenExpiry) {
                        handleTokenExpiry(serverId);
                    } else if (status.state === 'invalid-token' && handleInvalidToken) {
                        // Token format is invalid - clear tokens and require re-auth
                        handleInvalidToken(serverId);
                    }
                },
                onMessage: (message) => {
                    mcpLog.info(`[${serverId}] MCP message:`, message);
                }
            },
            {
                reconnectMinDelay: MCP_OAUTH_CONFIG.RECONNECT_MIN_DELAY,
                reconnectMaxDelay: MCP_OAUTH_CONFIG.RECONNECT_MAX_DELAY,
                reconnectMultiplier: MCP_OAUTH_CONFIG.RECONNECT_MULTIPLIER,
                maxReconnectAttempts: 5,
                requestTimeout: 30000,
            }
        );

        // Connect with timeout
        const connectionPromise = state.client.connect();
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(NetworkError.timeout(
                    `Connection to ${serverId} timed out after 30 seconds`
                ));
            }, 30000);
        });

        await Promise.race([connectionPromise, timeoutPromise]);

        // Initialize MCP protocol with timeout
        const initPromise = state.client.initialize();
        const initTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(NetworkError.timeout(
                    `Initialization of ${serverId} timed out after 30 seconds`
                ));
            }, 30000);
        });

        await Promise.race([initPromise, initTimeoutPromise]);

        mcpLog.info(`[${serverId}] Successfully connected and initialized`);
        return { success: true, data: state.client.getStatus() };

    } catch (error) {
        mcpLog.error(`[${serverId}] MCP connection error:`, error);

        // Clean up the client on error
        if (state.client) {
            try {
                state.client.disconnect();
            } catch (disconnectError) {
                mcpLog.error(`[${serverId}] Error disconnecting client:`, disconnectError);
            }
            state.client = null;
        }

        // Categorize the error and provide user-friendly message
        let errorMessage: string;
        let errorState: 'error' | 'cloudflare-error' = 'error';

        if (error instanceof MCPError || error instanceof NetworkError) {
            errorMessage = error.userMessage;
            if (error instanceof MCPError && error.message.toLowerCase().includes('cloudflare')) {
                errorState = 'cloudflare-error';
            }
        } else if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('worker threw exception') ||
                msg.includes('error 1101') ||
                msg.includes('cloudflare') ||
                error.message.includes('<title>')) {
                errorMessage = `${serverConfig?.name || serverId} service is experiencing technical difficulties. This is a temporary issue on their end. Please try again in a few minutes.`;
                errorState = 'cloudflare-error';
            } else if (msg.includes('timeout') || msg.includes('timed out')) {
                errorMessage = 'Connection timed out. Please check your internet connection.';
            } else {
                errorMessage = error.message;
            }
        } else {
            errorMessage = 'An unknown error occurred';
        }

        state.status = {
            ...state.status,
            state: errorState,
            error: errorMessage
        };
        broadcastStatusUpdate(serverId, state.status);

        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Disconnect from MCP server
 */
export function disconnectMcpServer(serverId: string): void {
    const state = getServerState(serverId);

    if (state.client) {
        state.client.disconnect();
        state.client = null;
    }
    state.status = { ...state.status, state: 'authenticated' };
    broadcastStatusUpdate(serverId, state.status);
}

/**
 * Enable MCP server (connect if authenticated)
 */
export async function enableMcpServer(serverId: string): Promise<McpExtensionResponse> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);
    state.isEnabled = true;

    await chrome.storage.local.set({ [`mcp.${serverId}.enabled`]: true });
    updateKeepAliveState();

    if (state.client && state.status.state === 'connected') {
        mcpLog.info(`[${serverId}] Already connected and initialized`);
        return { success: true, data: state.status };
    }

    if (serverConfig && !serverConfig.requiresAuthentication) {
        mcpLog.info(`[${serverId}] Server does not require authentication, connecting directly`);
        const connectResult = await connectMcpServer(serverId);

        if (connectResult.success) {
            mcpLog.info(`[${serverId}] Connection and initialization successful`);
        } else {
            mcpLog.warn(`[${serverId}] Connection failed:`, connectResult.error);
        }

        return connectResult;
    }

    if (state.tokens || await getStoredTokens(serverId)) {
        const connectResult = await connectMcpServer(serverId);

        if (connectResult.success) {
            mcpLog.info(`[${serverId}] Connection and initialization successful`);
        } else {
            mcpLog.warn(`[${serverId}] Connection failed:`, connectResult.error);
        }

        return connectResult;
    }

    return {
        success: false,
        error: 'Authentication required. Please connect first.'
    };
}

/**
 * Disable MCP server (disconnect)
 */
export async function disableMcpServer(serverId: string): Promise<McpExtensionResponse> {
    const state = getServerState(serverId);
    state.isEnabled = false;

    await chrome.storage.local.set({ [`mcp.${serverId}.enabled`]: false });
    disconnectMcpServer(serverId);
    updateKeepAliveState();

    return { success: true };
}
