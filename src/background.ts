/**
 * MV3 Background Service Worker - Main Entry Point
 * 
 * Handles:
 * - Side panel initialization
 * - Extension lifecycle events
 * - Multi-server MCP OAuth and SSE connections
 * 
 * Enhanced with comprehensive error handling:
 * - Structured error responses for all MCP operations
 * - Connection error categorization and recovery
 * - Token management error handling
 * - Per-server error isolation
 */

import './polyfills/process';
import { McpSSEClient } from './mcp/sseClient';
import {
    registerDynamicClient,
    generateState,
    buildAuthUrl,
    exchangeCodeForTokens,
    storeTokens,
    getStoredTokens,
    clearTokens,
    storeClientCredentials,
    getStoredClientCredentials,
    clearClientCredentials,
    storeOAuthEndpoints,
    getStoredOAuthEndpoints,
    clearOAuthEndpoints
} from './mcp/oauth';
import {
    discoverOAuthEndpoints
} from './mcp/discovery';
import {
    selectScopes,
    updateGrantedScopes,
    clearScopeData
} from './mcp/scopeHandler';

import type {
    McpServerStatus,
    McpExtensionResponse,
    OAuthEndpoints,
    McpTool
} from './mcp/types';
import { getServerState, getServerConfig, serverStates } from './mcp/state';
import { broadcastStatusUpdate } from './mcp/events';
import { getDisabledTools, setDisabledTools } from './mcp/toolsConfig';
import {
    scheduleTokenRefresh,
    handleTokenRefreshAlarm,
    ensureTokenValidity,
    ensureValidToken,
    refreshServerToken
} from './mcp/authHelpers';
import {
    updateKeepAliveState
} from './background/keepAlive';
import {
    openSidePanel,
    openSidePanelForTab,
    sendMessageToSidepanel
} from './background/sidepanelUtils';
import { ensureOffscreenDocument } from './offscreen/ensure';
import { MCP_OAUTH_CONFIG, SERVER_SPECIFIC_CONFIGS, APP_ICON } from './constants';
import { MCP_SERVERS } from './constants/mcpServers';
import { MCPError, NetworkError, isFileAccessError } from './errors';
import { buildUserMessage } from './errors/errorMessages';
import {
    createAINotification,
    parseNotificationId,
    isAINotification,
    clearNotification
} from './utils/aiNotification';
import type { AINotificationPayload } from './types/notifications';
import { readLocalFile, extractFilename } from './utils/localFileReader';
import { cleanupCache } from './ai/fileApi/cache';
import { createLogger } from '~logger';

const backgroundLog = createLogger('Background', 'BACKGROUND');
const mcpLog = createLogger('Background-MCP', 'MCP_CLIENT');
const authLog = createLogger('Background-Auth', 'MCP_AUTH');

// Track the last focused window ID for omnibox sidepanel opening
// This avoids async operations that break the user gesture chain
let lastFocusedWindowId: number | undefined;

// ============================================================================
// Dynamic OAuth Redirect URI Initialization
// ============================================================================

/**
 * Initialize the OAuth redirect URI dynamically based on the actual extension ID
 * This ensures dev and prod builds use the correct redirect URI
 */
function initializeOAuthRedirectURI(): void {
    if (!MCP_OAUTH_CONFIG.REDIRECT_URI) {
        // Get the correct redirect URI for this extension
        const redirectURL = chrome.identity.getRedirectURL();
        authLog.info('Initializing OAuth redirect URI:', redirectURL);

        // Mutate the const object (this is safe at runtime)
        (MCP_OAUTH_CONFIG as any).REDIRECT_URI = redirectURL;
    }
}

// Initialize redirect URI immediately when service worker loads
initializeOAuthRedirectURI();




// Token refresh helpers moved to src/mcp/authHelpers.ts

/**
 * Start OAuth flow for any MCP server with dynamic client registration and discovery
 */
async function startOAuthFlow(serverId: string): Promise<McpExtensionResponse> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    if (!serverConfig) {
        return {
            success: false,
            error: `Server config not found for ${serverId}`
        };
    }

    if (!serverConfig.url) {
        return {
            success: false,
            error: `No URL configured for ${serverId}`
        };
    }

    try {
        mcpLog.info(`[${serverId}] Starting OAuth flow with dynamic client registration`);

        // Step 1: Discover OAuth endpoints using proper RFC 9728 + RFC 8414 metadata discovery
        // Never use hardcoded hints - always follow the MCP specification discovery flow
        state.status = { ...state.status, state: 'connecting' };
        broadcastStatusUpdate(serverId, state.status);

        let endpoints: OAuthEndpoints | null = state.oauthEndpoints;

        if (!endpoints) {
            // Perform spec-compliant OAuth discovery following RFC 9728 (Protected Resource Metadata)
            // and RFC 8414 (Authorization Server Metadata)
            mcpLog.info(`[${serverId}] Performing OAuth discovery per RFC 9728 + RFC 8414...`);
            endpoints = await discoverOAuthEndpoints(serverConfig.url);

            if (!endpoints) {
                throw new Error('OAuth discovery failed. Server may not support OAuth or endpoints are not discoverable. Ensure the server implements RFC 9728 Protected Resource Metadata discovery.');
            }

            // Cache discovered endpoints for future use
            state.oauthEndpoints = endpoints;

            // Persist endpoints to storage so they survive service worker restarts
            await storeOAuthEndpoints(serverId, endpoints);

            mcpLog.info(`[${serverId}] Successfully discovered OAuth endpoints:`, {
                authorization_endpoint: endpoints.authorization_endpoint,
                token_endpoint: endpoints.token_endpoint,
                registration_endpoint: endpoints.registration_endpoint,
                scopes_supported: endpoints.scopes_supported
            });
        }

        if (!endpoints.registration_endpoint) {
            throw new Error('No registration endpoint found. Dynamic client registration is required.');
        }

        // Step 2: Register a dynamic client
        mcpLog.info(`[${serverId}] Registering dynamic client...`);
        state.status = { ...state.status, state: 'registering' };
        broadcastStatusUpdate(serverId, state.status);

        // Select scopes for registration
        const scopes = await selectScopes(serverId, serverConfig.oauth);

        const clientCredentials = await registerDynamicClient(
            serverId,
            endpoints.registration_endpoint,
            MCP_OAUTH_CONFIG.REDIRECT_URI,
            serverConfig.name,
            scopes
        );

        // Store credentials in memory but NOT in storage yet - wait until user approves
        state.credentials = clientCredentials;

        mcpLog.info(`[${serverId}] Dynamic client registered:`, clientCredentials.client_id);

        // Step 3: Generate state for CSRF protection
        const oauthStateValue = generateState();

        // Store state in memory
        state.oauthState = {
            state: oauthStateValue,
            codeVerifier: '', // Not used in standard OAuth (only PKCE)
            created_at: Date.now()
        };

        // Step 4: Build authorization URL
        const authUrl = buildAuthUrl(
            serverId,
            endpoints.authorization_endpoint,
            clientCredentials.client_id,
            MCP_OAUTH_CONFIG.REDIRECT_URI,
            oauthStateValue,
            scopes,
            serverConfig.oauth?.resource || endpoints.resource
        );

        mcpLog.info(`[${serverId}] Launching OAuth...`);
        mcpLog.info(`[${serverId}] Authorization URL: ${authUrl}`);

        // Update status
        state.status = { ...state.status, state: 'authorizing' };
        broadcastStatusUpdate(serverId, state.status);
        // Step 5: Launch OAuth flow using Chrome Identity API
        let redirectUrl: string | undefined;
        try {
            redirectUrl = await chrome.identity.launchWebAuthFlow({
                url: authUrl,
                interactive: true
            });
        } catch (error) {
            mcpLog.error(`[${serverId}] Could not load OAuth URL:`, error);
            throw new Error(`Could not load OAuth URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        if (!redirectUrl) {
            throw new Error('OAuth flow cancelled');
        }

        mcpLog.info(`[${serverId}] OAuth redirect URL received`);

        // Step 6: Extract code and state from redirect URL
        const url = new URL(redirectUrl);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (!code) {
            throw new Error('No authorization code received');
        }

        if (!returnedState) {
            throw new Error('No state parameter received');
        }

        // Validate state parameter (CSRF protection)
        if (!state.oauthState || returnedState !== state.oauthState.state) {
            throw new Error('State validation failed - possible CSRF attack');
        }

        mcpLog.info(`[${serverId}] Exchanging code for tokens`);

        // Step 7: Exchange code for tokens
        // Get custom headers for this server (e.g., Notion-Version header)
        const specificConfig = SERVER_SPECIFIC_CONFIGS[serverId];
        const customHeaders = specificConfig?.customHeaders;

        const tokens = await exchangeCodeForTokens(
            serverId,
            endpoints.token_endpoint,
            code,
            clientCredentials.client_id,
            clientCredentials.client_secret,
            MCP_OAUTH_CONFIG.REDIRECT_URI,
            serverConfig.oauth?.resource || endpoints.resource,
            customHeaders
        );

        // User approved! Now we can store client credentials permanently
        await storeClientCredentials(serverId, clientCredentials);
        mcpLog.info(`[${serverId}] Client credentials stored after user approval`);

        // Update granted scopes
        if (tokens.scope) {
            await updateGrantedScopes(serverId, tokens.scope);
        }

        // Store tokens
        state.tokens = tokens;
        await storeTokens(serverId, tokens);

        mcpLog.info(`[${serverId}] Tokens stored successfully`);

        // Schedule automatic token refresh before expiry
        await scheduleTokenRefresh(serverId, tokens);

        // Update status
        state.status = { ...state.status, state: 'authenticated' };
        broadcastStatusUpdate(serverId, state.status);

        mcpLog.info(`[${serverId}] OAuth successful`);

        return { success: true, data: { state: 'authenticated' } };
    } catch (error) {
        authLog.error(`[${serverId}] OAuth error:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        authLog.error("full error :", error);

        // Check if user cancelled or denied the flow
        const wasCancelled = errorMessage.toLowerCase().includes('cancelled') ||
            errorMessage.toLowerCase().includes('closed') ||
            errorMessage.toLowerCase().includes('denied') ||
            errorMessage.toLowerCase().includes('did not approve') ||
            errorMessage.toLowerCase().includes('user denied');

        if (wasCancelled) {
            mcpLog.info(`[${serverId}] OAuth flow was cancelled/denied by user - cleaning up...`);

            // Clean up ALL partial data since auth was cancelled
            // Clear storage (in case anything was written)
            await Promise.all([
                clearClientCredentials(serverId),
                clearTokens(serverId),
                clearScopeData(serverId),
                clearOAuthEndpoints(serverId)
            ]);

            // Clear memory state
            state.credentials = null;
            state.tokens = null;
            state.oauthEndpoints = null;

            // Set state back to disconnected (clean slate) since cancellation is not an error
            state.status = { serverId, state: 'disconnected' };

            mcpLog.info(`[${serverId}] Cleanup complete after cancellation`);
        } else {
            // Actual error occurred (not user cancellation)
            mcpLog.error(`[${serverId}] Actual authentication error (not cancellation):`, errorMessage);

            // Still clean up partial data on error
            await clearClientCredentials(serverId);
            state.credentials = null;

            state.status = {
                serverId,
                state: 'error',
                error: errorMessage
            };
        }

        broadcastStatusUpdate(serverId, state.status);
        return {
            success: false,
            error: errorMessage
        };
    } finally {
        // Always clear OAuth state when exiting flow
        state.oauthState = null;
    }
}

// Token validation and refresh functions moved to src/mcp/authHelpers.ts

// ============================================================================
// MCP Connection Functions
// ============================================================================

/**
 * Connect to any MCP server with comprehensive error handling
 * 
 * Error handling:
 * - Validates server configuration before connection
 * - Categorizes connection failures (auth, network, server)
 * - Returns structured error responses
 * - Handles token refresh automatically
 */
async function connectMcpServer(serverId: string): Promise<McpExtensionResponse> {
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
                    if (status.state === 'needs-auth') {
                        handleTokenExpiry(serverId);
                    } else if (status.state === 'invalid-token') {
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
                maxReconnectAttempts: 5, // Limit reconnection attempts
                requestTimeout: 30000, // 30s timeout for requests
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
            // Check if it's specifically a Cloudflare error
            if (error instanceof MCPError && error.message.toLowerCase().includes('cloudflare')) {
                errorState = 'cloudflare-error';
            }
        } else if (error instanceof Error) {
            // Check for Cloudflare Worker errors in the error message
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

        // Update server state with error
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
function disconnectMcpServer(serverId: string): void {
    const state = getServerState(serverId);

    if (state.client) {
        state.client.disconnect();
        state.client = null;
    }
    state.status = { ...state.status, state: 'authenticated' };
    broadcastStatusUpdate(serverId, state.status);
}

/**
 * Handle token expiry - attempt refresh and reconnect
 */
async function handleTokenExpiry(serverId: string): Promise<void> {
    mcpLog.info(`[${serverId}] Handling token expiry`);

    const state = getServerState(serverId);

    // Disconnect current client
    if (state.client) {
        state.client.disconnect();
        state.client = null;
    }

    // Try to refresh
    const refreshed = await refreshServerToken(serverId);

    // If enabled and refresh succeeded, reconnect
    if (refreshed && state.isEnabled) {
        await connectMcpServer(serverId);
    }
}

/**
 * Handle invalid token format - clear tokens and require re-auth
 */
async function handleInvalidToken(serverId: string): Promise<void> {
    mcpLog.info(`[${serverId}] Handling invalid token format`);

    const state = getServerState(serverId);

    // Disconnect current client
    if (state.client) {
        state.client.disconnect();
        state.client = null;
    }

    // Clear invalid tokens and client credentials - don't try to refresh
    await Promise.all([
        clearTokens(serverId),
        clearClientCredentials(serverId),
        clearScopeData(serverId),
        clearOAuthEndpoints(serverId)
    ]);

    state.tokens = null;
    state.credentials = null;
    state.oauthEndpoints = null;
    state.status = {
        ...state.status,
        state: 'invalid-token',
        error: 'Invalid token format - please re-authenticate'
    };
    state.isEnabled = false;

    await chrome.storage.local.set({ [`mcp.${serverId}.enabled`]: false });
    broadcastStatusUpdate(serverId, state.status);
}

/**
 * Enable MCP server (connect if authenticated)
 */
async function enableMcpServer(serverId: string): Promise<McpExtensionResponse> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);
    state.isEnabled = true;

    // Store enabled state
    await chrome.storage.local.set({ [`mcp.${serverId}.enabled`]: true });

    // Start keep-alive when first server is enabled
    updateKeepAliveState();

    // If already connected, just return success
    if (state.client && state.status.state === 'connected') {
        mcpLog.info(`[${serverId}] Already connected and initialized`);
        return { success: true, data: state.status };
    }

    // Check if server requires authentication
    if (serverConfig && !serverConfig.requiresAuthentication) {
        // Server doesn't require authentication, connect directly
        mcpLog.info(`[${serverId}] Server does not require authentication, connecting directly`);
        const connectResult = await connectMcpServer(serverId);

        if (connectResult.success) {
            mcpLog.info(`[${serverId}] Connection and initialization successful`);
        } else {
            mcpLog.warn(`[${serverId}] Connection failed:`, connectResult.error);
        }

        return connectResult;
    }

    // If authenticated, connect
    if (state.tokens || await getStoredTokens(serverId)) {
        const connectResult = await connectMcpServer(serverId);

        // No need for separate health check - our client already initializes and fetches tools during connection
        if (connectResult.success) {
            mcpLog.info(`[${serverId}] Connection and initialization successful`);
        } else {
            mcpLog.warn(`[${serverId}] Connection failed:`, connectResult.error);
        }

        return connectResult;
    }

    // Otherwise, need auth
    return {
        success: false,
        error: 'Authentication required. Please connect first.'
    };
}

/**
 * Disable MCP server (disconnect)
 */
async function disableMcpServer(serverId: string): Promise<McpExtensionResponse> {
    const state = getServerState(serverId);
    state.isEnabled = false;

    await chrome.storage.local.set({ [`mcp.${serverId}.enabled`]: false });
    disconnectMcpServer(serverId);

    // Stop keep-alive if no servers remain enabled
    updateKeepAliveState();

    return { success: true };
}

/**
 * Disconnect and clear authentication for a server
 */
async function disconnectServerAuth(serverId: string): Promise<McpExtensionResponse> {
    mcpLog.info(`[${serverId}] Disconnecting and clearing all authentication data...`);
    const state = getServerState(serverId);

    // Disconnect the MCP client if active
    disconnectMcpServer(serverId);

    // Clear all stored authentication data from chrome.storage.local
    await Promise.all([
        clearTokens(serverId),
        clearClientCredentials(serverId),
        clearScopeData(serverId),
        clearOAuthEndpoints(serverId)
    ]);

    // Clear all in-memory state
    state.tokens = null;
    state.credentials = null;
    state.oauthEndpoints = null;
    state.oauthState = null;
    state.status = { serverId, state: 'disconnected' };
    state.isEnabled = false;

    // Clear enabled flag from storage
    await chrome.storage.local.set({ [`mcp.${serverId}.enabled`]: false });

    // Stop keep-alive if no servers remain enabled
    updateKeepAliveState();

    mcpLog.info(`[${serverId}] All authentication data cleared successfully`);
    broadcastStatusUpdate(serverId, state.status);

    return { success: true };
}

/**
 * Get current MCP server status
 */
function getServerStatus(serverId: string): McpServerStatus {
    const state = getServerState(serverId);
    return state.status;
}

// Broadcast and tools config functions moved to src/mcp/events.ts and src/mcp/toolsConfig.ts

/**
 * Get available tools for a server
 */
async function getServerTools(serverId: string): Promise<McpTool[]> {
    const state = getServerState(serverId);
    return state.status?.tools || [];
}

/**
 * Perform health check on MCP server
 * Validates connection and retrieves available tools
 * Uses custom SSE client that supports both Streamable HTTP and HTTP+SSE transports
 */
async function performHealthCheck(serverId: string): Promise<McpExtensionResponse> {
    let healthCheckClient: McpSSEClient | undefined = undefined;
    const serverConfig = getServerConfig(serverId);

    if (!serverConfig || !serverConfig.url) {
        return {
            success: false,
            error: 'Server configuration not found'
        };
    }

    try {
        mcpLog.info(`[${serverId}] Performing MCP health check with custom client`);

        // Get access token (only required if server needs authentication)
        let accessToken: string | null = null;
        if (serverConfig.requiresAuthentication) {
            accessToken = await ensureValidToken(serverId, refreshServerToken);
            if (!accessToken) {
                return {
                    success: false,
                    error: 'No valid access token available'
                };
            }
        } else {
            // For servers that don't require authentication, use empty string
            accessToken = '';
            mcpLog.info(`[${serverId}] Server does not require authentication, performing health check without token`);
        }

        try {
            // Create temporary client for health check
            // This client supports both Streamable HTTP (POST) and HTTP+SSE (GET) transports
            healthCheckClient = new McpSSEClient(
                `${serverId}-health`,
                serverConfig.url,
                accessToken,
                {
                    onStatusChange: (status) => {
                        mcpLog.info(`[${serverId}] Health check status:`, status.state);
                    },
                    onMessage: (_message) => {
                        // Ignore messages during health check
                    }
                },
                {
                    reconnectMinDelay: MCP_OAUTH_CONFIG.RECONNECT_MIN_DELAY,
                    reconnectMaxDelay: MCP_OAUTH_CONFIG.RECONNECT_MAX_DELAY,
                    reconnectMultiplier: MCP_OAUTH_CONFIG.RECONNECT_MULTIPLIER
                }
            );

            mcpLog.info(`[${serverId}] Connecting to MCP server (auto-detect transport)...`);

            // Connect (will auto-detect Streamable HTTP vs HTTP+SSE)
            await healthCheckClient.connect();
            mcpLog.info(`[${serverId}] Connected successfully`);

            // Initialize MCP protocol
            await healthCheckClient.initialize();
            mcpLog.info(`[${serverId}] Initialized successfully`);

            // Get server status (includes tools)
            const status = healthCheckClient.getStatus();
            mcpLog.info(`[${serverId}] Server status:`, status);

            // Disconnect the health check client
            healthCheckClient.disconnect();

            if (status.tools && status.tools.length > 0) {
                mcpLog.info(`[${serverId}] Health check passed. Tools available:`, status.tools.length);

                return {
                    success: true,
                    data: {
                        state: 'connected',
                        tools: status.tools,
                        toolCount: status.tools.length
                    }
                };
            } else {
                return {
                    success: false,
                    error: 'No tools available from server'
                };
            }
        } catch (transportError) {
            mcpLog.error(`[${serverId}] Health check failed:`, transportError);

            // Clean up client if exists
            if (healthCheckClient) {
                try {
                    (healthCheckClient as McpSSEClient).disconnect();
                } catch (closeError) {
                    mcpLog.error(`[${serverId}] Error closing client:`, closeError);
                }
            }

            return {
                success: false,
                error: transportError instanceof Error ? transportError.message : 'Connection failed'
            };
        }
    } catch (error) {
        mcpLog.error(`[${serverId}] Health check error:`, error);

        // Clean up client if exists
        if (healthCheckClient) {
            try {
                (healthCheckClient as McpSSEClient).disconnect();
            } catch (closeError) {
                mcpLog.error(`[${serverId}] Error closing client:`, closeError);
            }
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Health check failed'
        };
    }
}

/**
 * Get all available tools from persistent MCP connections
 */
async function getAllMCPTools(): Promise<McpExtensionResponse> {
    const allTools: any[] = [];

    try {
        for (const [serverId, state] of serverStates) {
            // Only include tools from enabled servers with active connections
            if (state.isEnabled && state.client && state.status.state === 'connected') {
                try {
                    const toolsList = await state.client.listTools();

                    if (toolsList && toolsList.tools) {
                        // Add serverId to each tool for routing
                        const serverTools = toolsList.tools.map((tool: any) => ({
                            ...tool,
                            serverId, // Add server ID so we know where to route calls
                            serverName: getServerConfig(serverId)?.name || serverId
                        }));

                        allTools.push(...serverTools);
                        mcpLog.info(`[${serverId}] Added ${serverTools.length} tools`);
                    }
                } catch (error) {
                    mcpLog.error(`[${serverId}] Error listing tools:`, error);
                    // Continue with other servers instead of failing completely
                }
            }
        }

        backgroundLog.info(` Total MCP tools available: ${allTools.length}`);
        return { success: true, data: { tools: allTools } };
    } catch (error) {
        backgroundLog.error(' Error getting all MCP tools:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get MCP tools'
        };
    }
}

/**
 * Call an MCP tool on any server
 */
async function callServerTool(serverId: string, name: string, args?: Record<string, any>): Promise<McpExtensionResponse> {
    const state = getServerState(serverId);

    if (!state.client) {
        return { success: false, error: 'Not connected' };
    }

    try {
        const result = await state.client.callTool(name, args);
        return { success: true, data: result };
    } catch (error) {
        mcpLog.error(`[${serverId}] Tool call error:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Tool call failed'
        };
    }
}

/**
 * Get MCP server configurations for frontend
 */
async function getMCPServerConfigs(): Promise<any[]> {
    backgroundLog.info(' getMCPServerConfigs called');
    const servers = [];

    try {
        backgroundLog.info(` Processing ${MCP_SERVERS.length} server configs`);

        for (const serverConfig of MCP_SERVERS) {
            const serverId = serverConfig.id;
            const state = getServerState(serverId);

            mcpLog.info(`[${serverId}] Checking server configuration:`, {
                name: serverConfig.name,
                url: serverConfig.url,
                hasTokens: !!state.tokens,
                hasAccessToken: !!state.tokens?.access_token,
                currentStatus: state.status.state
            });

            // Get enabled status from storage
            const { [`mcp.${serverId}.enabled`]: isEnabled } = await chrome.storage.local.get(`mcp.${serverId}.enabled`);
            mcpLog.info(`[${serverId}] Enabled status from storage:`, isEnabled);

            const serverType = serverConfig.url?.endsWith('/sse') ? 'sse' : 'mcp';

            // Add server if enabled AND either:
            // 1. Server requires authentication and has access token
            // 2. Server doesn't require authentication
            const shouldAddServer = isEnabled && serverConfig.url && (
                !serverConfig.requiresAuthentication ||
                (serverConfig.requiresAuthentication && state.tokens?.access_token)
            );

            if (shouldAddServer) {
                mcpLog.info(`[${serverId}] ✓ Adding server to frontend config`);

                // Build headers based on authentication requirement
                const headers = [
                    { key: 'Accept', value: 'application/json, text/event-stream' }
                ];

                // Only add Authorization header if server requires authentication
                if (serverConfig.requiresAuthentication && state.tokens?.access_token) {
                    headers.unshift({ key: 'Authorization', value: `Bearer ${state.tokens.access_token}` });
                }

                servers.push({
                    id: serverId,
                    name: serverConfig.name,
                    url: serverConfig.url,
                    type: serverType,
                    headers,
                    enabled: true,
                    status: state.status
                });

                mcpLog.info(`[${serverId}] ${serverConfig.name} configured for frontend (requiresAuth: ${serverConfig.requiresAuthentication})`);
            } else {
                mcpLog.info(`[${serverId}] ✗ Not adding to config - Conditions not met:`, {
                    isEnabled,
                    requiresAuthentication: serverConfig.requiresAuthentication,
                    hasAccessToken: !!state.tokens?.access_token,
                    hasUrl: !!serverConfig.url
                });
            }
        }

        backgroundLog.info(` Returning ${servers.length} configured server(s)`);
    } catch (error) {
        backgroundLog.error(' Error getting MCP server configs:', error);
    }

    return servers;
}

/**
 * Initialize server status from stored tokens
 * Called on startup to restore authentication state
 */
async function initializeServerStatus(serverId: string): Promise<void> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    try {
        const tokens = await getStoredTokens(serverId);

        // Also restore OAuth endpoints from storage if available
        const storedEndpoints = await getStoredOAuthEndpoints(serverId);
        if (storedEndpoints) {
            state.oauthEndpoints = storedEndpoints;
            mcpLog.info(`[${serverId}] OAuth endpoints restored from storage`);
        }

        if (tokens) {
            // User has tokens, mark as authenticated
            state.status = { ...state.status, state: 'authenticated' };
            mcpLog.info(`[${serverId}] Status initialized: authenticated (tokens found)`);
        } else if (serverConfig && !serverConfig.requiresAuthentication) {
            // Server doesn't require authentication, mark as ready to connect
            state.status = { ...state.status, state: 'disconnected' };
            mcpLog.info(`[${serverId}] Status initialized: disconnected (no auth required)`);
        } else {
            // No tokens and server requires auth
            state.status = { ...state.status, state: 'needs-auth' };
            mcpLog.info(`[${serverId}] Status initialized: needs-auth (no tokens)`);
        }
    } catch (error) {
        mcpLog.error(`[${serverId}] Error initializing status:`, error);
        state.status = { ...state.status, state: 'disconnected' };
    }
}

// ============================================================================
// Message Handler
// ============================================================================

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
    backgroundLog.info(' Received message:', message.type, message);

    // Handle model download progress broadcasts
    if (message.type === 'MODEL_DOWNLOAD_PROGRESS') {
        backgroundLog.info(' Relaying model download progress to sidepanel:', message.data);

        // Broadcast to all extension contexts (especially sidepanel)
        chrome.runtime.sendMessage({
            type: 'MODEL_DOWNLOAD_PROGRESS_UPDATE',
            data: message.data,
        }).catch((error) => {
            backgroundLog.debug(' No listeners for download progress update:', error);
        });

        sendResponse({ success: true });
        return true;
    }

    // Handle Ask AI button - open sidepanel
    if (message.action === 'OPEN_SIDEBAR') {
        (async () => {
            const windowId = lastFocusedWindowId;

            if (windowId) {
                const success = await openSidePanel(windowId);

                if (success) {
                    backgroundLog.info(' Sidepanel opened via Ask AI button');

                    // Broadcast to content scripts that sidebar is now open
                    chrome.tabs.query({ windowId }, (tabs) => {
                        tabs.forEach((tab) => {
                            if (tab.id) {
                                chrome.tabs.sendMessage(tab.id, { action: 'SIDEBAR_OPENED' })
                                    .catch(() => {
                                        // Ignore errors if content script not loaded
                                    });
                            }
                        });
                    });

                    sendResponse({ success: true });
                } else {
                    backgroundLog.error(' Failed to open sidepanel via Ask AI button');
                    sendResponse({ success: false, error: 'Failed to open sidepanel' });
                }
            } else {
                backgroundLog.error(' Cannot open sidepanel: no window ID tracked');
                sendResponse({ success: false, error: 'No active window' });
            }
        })();
        return true; // Will respond asynchronously
    }

    // Handle general MCP messages
    if (message.type === 'mcp/servers/get') {
        (async () => {
            try {
                const servers = await getMCPServerConfigs();
                backgroundLog.info(' Sending MCP server configs:', servers);
                sendResponse({ success: true, data: servers });
            } catch (error) {
                backgroundLog.error(' Error getting MCP server configs:', error);
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get server configs'
                });
            }
        })();
        return true;
    }

    // Handle tools list request - get all tools from persistent connections
    if (message.type === 'mcp/tools/list') {
        (async () => {
            try {
                const result = await getAllMCPTools();
                backgroundLog.info(' Sending MCP tools list:', result);
                sendResponse(result);
            } catch (error) {
                backgroundLog.error(' Error getting MCP tools:', error);
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get MCP tools'
                });
            }
        })();
        return true;
    }

    // Handle generic MCP messages (format: mcp/{serverId}/{action})
    if (message.type?.startsWith('mcp/')) {
        (async () => {
            // Parse serverId from message type
            const parts = message.type.split('/');
            if (parts.length < 3) {
                sendResponse({ success: false, error: 'Invalid message format' });
                return;
            }

            const serverId = parts[1];
            const action = parts.slice(2).join('/');

            let response: McpExtensionResponse;

            backgroundLog.info(` Handling MCP message for ${serverId}:`, action);

            switch (action) {
                case 'auth/start':
                    response = await startOAuthFlow(serverId);
                    break;

                case 'enable':
                    response = await enableMcpServer(serverId);
                    break;

                case 'disable':
                    response = await disableMcpServer(serverId);
                    break;

                case 'disconnect':
                    response = await disconnectServerAuth(serverId);
                    break;

                case 'status/get':
                    response = { success: true, data: getServerStatus(serverId) };
                    break;

                case 'auth/refresh':

                    const refreshed = await refreshServerToken(serverId);
                    response = refreshed
                        ? { success: true, data: { state: 'authenticated' } }
                        : { success: false, error: 'Token refresh failed' };
                    break;

                case 'tool/call':
                    response = await callServerTool(
                        serverId,
                        message.payload?.name,
                        message.payload?.arguments
                    );
                    break;

                case 'health/check':
                    response = await performHealthCheck(serverId);
                    break;

                case 'tools/list':
                    const tools = await getServerTools(serverId);
                    response = { success: true, data: tools };
                    break;

                case 'tools/config/get':
                    const disabledTools = await getDisabledTools(serverId);
                    response = { success: true, data: disabledTools };
                    break;

                case 'tools/config/set':
                    await setDisabledTools(serverId, message.payload?.disabledTools || []);
                    response = { success: true };
                    break;

                default:
                    response = { success: false, error: `Unknown action: ${action}` };
            }

            mcpLog.info(`[${serverId}] Sending MCP response:`, response);
            sendResponse(response);
        })();

        return true; // Will respond asynchronously
    }

    // Handle summarize messages
    if (message?.type === 'summarize:availability') {
        (async () => {
            await ensureOffscreenDocument();
            try {
                const res = await chrome.runtime.sendMessage({ type: 'offscreen/summarize/availability' });
                sendResponse(res);
            } catch (error) {
                sendResponse({ ok: false, code: 'error', message: error instanceof Error ? error.message : 'unknown' });
            }
        })();
        return true;
    }

    if (message?.type === 'summarize:request') {
        (async () => {
            const msg = message as SummarizeRequestMessage;
            await ensureOffscreenDocument();
            try {
                const res = await chrome.runtime.sendMessage({
                    type: 'offscreen/summarize/request',
                    payload: msg.payload
                });
                sendResponse(res);
            } catch (error) {
                sendResponse({ ok: false, code: 'error', message: error instanceof Error ? error.message : 'unknown' });
            }
        })();
        return true;
    }

    // Handle AI notification creation
    if (message?.type === 'ai/notification/create') {
        (async () => {
            try {
                const payload = message.payload as AINotificationPayload;
                backgroundLog.info(' Creating AI notification:', payload);

                const notificationId = await createAINotification({
                    threadId: payload.threadId,
                    title: payload.title,
                    message: payload.message,
                });

                if (notificationId) {
                    sendResponse({ success: true, notificationId });
                } else {
                    sendResponse({ success: false, error: 'Failed to create notification' });
                }
            } catch (error) {
                backgroundLog.error(' Error creating AI notification:', error);
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        })();
        return true;
    }

    // Handle local PDF file reading
    if (message?.type === 'READ_LOCAL_PDF') {
        (async () => {
            try {
                const { filePath } = message.payload;

                if (!filePath) {
                    sendResponse({
                        success: false,
                        error: 'File path is required'
                    });
                    return;
                }

                backgroundLog.info(' Reading local PDF file:', filePath);

                // Read the file and convert to Blob
                const blob = await readLocalFile(filePath);
                const filename = extractFilename(filePath);

                // Convert Blob to base64 for safe transfer through Chrome messaging
                // ArrayBuffers don't serialize properly through sendResponse()
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);

                // Convert to base64 string
                let binary = '';
                const chunkSize = 0x8000; // Process in chunks to avoid call stack issues
                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                    const chunk = uint8Array.subarray(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, Array.from(chunk));
                }
                const base64Data = btoa(binary);

                backgroundLog.info(' Successfully read local PDF:', {
                    filename,
                    size: blob.size,
                    type: blob.type,
                    base64Length: base64Data.length
                });

                sendResponse({
                    success: true,
                    data: {
                        base64Data,
                        filename,
                        type: blob.type,
                        size: blob.size
                    }
                });
            } catch (error) {
                backgroundLog.error(' Error reading local PDF:', error);

                if (isFileAccessError(error)) {
                    sendResponse({
                        success: false,
                        error: error.userMessage,
                        errorCode: error.code,
                        needsPermission: error.code === 'PERMISSION_DENIED'
                    });
                } else {
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : 'Failed to read local PDF file'
                    });
                }
            }
        })();
        return true;
    }

    // Return false for unhandled messages
    return false;
});

// ============================================================================
// Runtime Listeners
// ============================================================================

// Global notification click handler for reminders and AI notifications
chrome.notifications.onClicked.addListener(async (notificationId) => {
    try {
        // Handle AI completion notifications
        if (isAINotification(notificationId)) {
            backgroundLog.info(' AI notification clicked:', notificationId);

            const parsed = parseNotificationId(notificationId);
            if (!parsed) {
                backgroundLog.warn(' Invalid AI notification ID:', notificationId);
                return;
            }

            // Open/focus sidepanel
            try {
                await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
            } catch (error) {
                backgroundLog.error(' Error opening sidepanel:', error);
            }

            // Send message to sidepanel to navigate to the thread
            try {
                await chrome.runtime.sendMessage({
                    type: 'ai/notification/action',
                    payload: {
                        action: 'navigate',
                        threadId: parsed.threadId,
                    }
                });
            } catch (error) {
                backgroundLog.debug(' No listeners for navigation message:', error);
            }

            // Clear the notification
            await clearNotification(notificationId);
            return;
        }

        // Handle reminder notifications
        if (!notificationId.startsWith('reminder:')) {
            return;
        }

        const id = notificationId.split(':')[1];
        if (!id) {
            backgroundLog.warn(' Invalid reminder notification ID:', notificationId);
            return;
        }

        const { reminders = {} } = await chrome.storage.local.get('reminders');
        const remindersMap = reminders as Record<string, Reminder>;
        const reminder: Reminder | undefined = remindersMap[id];

        if (reminder?.url) {
            await chrome.tabs.create({ url: reminder.url });
        }

        // Cleanup: remove reminder and clear notification
        if (remindersMap[id]) {
            delete remindersMap[id];
            await chrome.storage.local.set({ reminders: remindersMap });
        }

        chrome.notifications.clear(notificationId);
    } catch (error) {
        backgroundLog.error(' Error handling notification click:', error);
    }
});

// Global notification button click handler for AI notifications
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    try {
        // Only handle AI completion notifications
        if (!isAINotification(notificationId)) {
            return;
        }

        backgroundLog.info(' AI notification button clicked:', notificationId, buttonIndex);

        const parsed = parseNotificationId(notificationId);
        if (!parsed) {
            backgroundLog.warn(' Invalid AI notification ID:', notificationId);
            return;
        }

        // Button 0: Continue Iterating
        // Button 1: Dismiss
        if (buttonIndex === 0) {
            // Continue Iterating clicked
            backgroundLog.info(' Continue Iterating clicked for thread:', parsed.threadId);

            // Open/focus sidepanel
            try {
                await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
            } catch (error) {
                backgroundLog.error(' Error opening sidepanel:', error);
            }

            // Send message to sidepanel to continue iterating
            try {
                await chrome.runtime.sendMessage({
                    type: 'ai/notification/action',
                    payload: {
                        action: 'continue',
                        threadId: parsed.threadId,
                    }
                });
            } catch (error) {
                backgroundLog.debug(' No listeners for continue action:', error);
            }
        } else if (buttonIndex === 1) {
            // Dismiss clicked - just clear the notification
            backgroundLog.info(' Dismiss clicked for thread:', parsed.threadId);
        }

        // Clear the notification regardless of which button was clicked
        await clearNotification(notificationId);
    } catch (error) {
        backgroundLog.error(' Error handling notification button click:', error);
    }
});

/**
 * Initialize all MCP servers from storage
 */
async function initializeAllServers(): Promise<void> {
    backgroundLog.info(' Initializing all MCP servers');

    for (const serverConfig of MCP_SERVERS) {
        const serverId = serverConfig.id;

        try {
            // Initialize server status from stored tokens
            await initializeServerStatus(serverId);

            // Check if server is enabled
            const { [`mcp.${serverId}.enabled`]: isEnabled } = await chrome.storage.local.get(`mcp.${serverId}.enabled`);
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
                        backgroundLog.info(` ${serverConfig.name} restored and connected`);
                    } else {
                        backgroundLog.info(` ${serverConfig.name} needs re-authentication`);
                    }
                } else {
                    backgroundLog.info(` ${serverConfig.name} enabled but no credentials found`);
                }
            }
        } catch (error) {
            backgroundLog.error(` Error initializing ${serverId}:`, error);
        }
    }

    // Start keep-alive if any servers are enabled
    backgroundLog.info(' Checking if keep-alive should start');
    updateKeepAliveState();
}

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    backgroundLog.info(' onInstalled:', details.reason);

    try {
        // Initialize all MCP servers from storage
        await initializeAllServers();

        // Keep-alive is initialized by initializeAllServers
        backgroundLog.info(' Keep-alive initialized');

        // Enable side panel on all existing tabs
        if (chrome.sidePanel) {
            chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
                backgroundLog.error('Failed to set panel behavior:', error);
            });
        }

        backgroundLog.info(' Side panel configured');
    } catch (error) {
        backgroundLog.error(' onInstalled error:', error);
    }
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(async () => {
    backgroundLog.info(' onStartup - Extension ready');

    // Clear session-based Ask AI button hide flag on browser startup
    try {
        await chrome.storage.session.set({
            'askAiButton.hiddenForSession': false
        });
        backgroundLog.info(' Ask AI button session hide cleared on startup');
    } catch (error) {
        backgroundLog.error(' Error clearing Ask AI button session hide:', error);
    }

    // Initialize all MCP servers from storage
    await initializeAllServers();

    // Keep-alive is initialized by initializeAllServers
    backgroundLog.info(' Keep-alive initialized on startup');
});

/**
 * Action click handler - open side panel
 */
if (chrome.action) {
    chrome.action.onClicked.addListener(async (tab) => {
        if (chrome.sidePanel && tab.id) {
            await openSidePanelForTab(tab.id);
        }
    });
}

/**
 * Track the last focused window ID for omnibox sidepanel opening
 * This avoids async operations that break the user gesture chain
 */
if (chrome.windows) {
    // Track window focus changes
    chrome.windows.onFocusChanged.addListener((windowId) => {
        if (windowId !== chrome.windows.WINDOW_ID_NONE) {
            lastFocusedWindowId = windowId;
        }
    });

    // Initialize on startup
    chrome.windows.getLastFocused().then((window) => {
        if (window?.id) {
            lastFocusedWindowId = window.id;
        }
    }).catch(() => {
        // Ignore errors during initialization
    });
}

// sendMessageToSidepanel function moved to src/background/sidepanelUtils.ts

/**
 * Omnibox handler - open side panel when user types "ai" in address bar
 * Users can type "ai" in the address bar, press Tab, then enter text to send to chat
 * 
 * Note: Must call sidePanel.open() immediately without any async operations before it
 * to maintain the user gesture chain. See: https://stackoverflow.com/questions/77213045
 */
if (chrome.omnibox) {
    // Handle when user presses Enter after typing the keyword
    chrome.omnibox.onInputEntered.addListener((text, disposition) => {
        // CRITICAL: Call openSidePanel immediately as the FIRST operation
        // Any code before this creates an async gap that breaks the user gesture chain
        // Use tracked window ID instead of WINDOW_ID_CURRENT (which doesn't work in service workers)
        const windowId = lastFocusedWindowId;

        if (windowId) {
            openSidePanel(windowId)
                .then((success) => {
                    if (success) {
                        backgroundLog.info(' Sidepanel opened via omnibox');

                        // Send the text to the sidepanel with retry logic
                        // This handles the case where sidepanel is still initializing
                        if (text && text.trim()) {
                            sendMessageToSidepanel(text.trim());
                        }
                    }
                })
                .catch((error) => {
                    backgroundLog.error(' Error opening sidepanel via omnibox:', error);
                });
        } else {
            // No window ID tracked yet - log error but don't break user gesture chain
            backgroundLog.error(' Cannot open sidepanel: no window ID tracked yet');
        }

        // Logging after the call (synchronous, doesn't affect gesture chain)
        backgroundLog.info(' Omnibox input entered:', { text, disposition });
    });

    // Optional: Provide suggestions as user types (can be enhanced later)
    chrome.omnibox.onInputChanged.addListener((_text, suggest) => {
        // For now, just suggest opening the sidepanel
        // You can enhance this later to provide more suggestions based on text input
        suggest([
            {
                content: 'open',
                description: 'Open AI Chat sidepanel'
            }
        ]);
    });
}


// Create cleanup alarm (runs every hour)
chrome.alarms.create('cleanup-expired-sessions', {
    periodInMinutes: 60
});

// PDF cache cleanup alarm (runs every 6 hours)
chrome.alarms.create('pdf-cache-cleanup', {
    periodInMinutes: 6 * 60
});

// ============================================================================
// Reminder Alarms Handler
// ============================================================================

interface Reminder {
    id: string;
    title: string;
    when: number;
    url?: string;
    createdAt: number;
    generatedTitle?: string;
    generatedDescription?: string;
}

/**
 * Handle reminder alarms - show notification when reminder fires
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    // Handle token refresh alarms (format: mcp-token-refresh-{serverId})
    if (alarm.name.startsWith('mcp-token-refresh-')) {
        const serverId = alarm.name.replace('mcp-token-refresh-', '');
        await handleTokenRefreshAlarm(serverId, refreshServerToken);
        return;
    }

    // Handle PDF cache cleanup
    if (alarm.name === 'pdf-cache-cleanup') {
        try {
            await cleanupCache();
        } catch (error) {
            backgroundLog.error(' PDF cache cleanup failed:', error);
        }
        return;
    }

    // Only handle reminder alarms after this point
    if (!alarm.name.startsWith('reminder:')) {
        return;
    }

    const id = alarm.name.split(':')[1];
    if (!id) {
        backgroundLog.warn(' Invalid reminder alarm name:', alarm.name);
        return;
    }

    backgroundLog.info(' Reminder alarm fired:', id);

    try {
        // Get the reminder from storage
        const { reminders = {} } = await chrome.storage.local.get('reminders');
        const remindersMap = reminders as Record<string, Reminder>;
        const reminder: Reminder | undefined = remindersMap[id];

        if (!reminder) {
            backgroundLog.warn(' Reminder not found:', id);
            return;
        }

        // Create notification with AI-generated content or fallback to original title
        const appicon = APP_ICON;

        const notificationTitle = reminder.generatedTitle || '⏰ Reminder';
        const notificationMessage = reminder.generatedDescription || reminder.title;

        // Use a namespaced notification ID to distinguish reminders
        chrome.notifications.create(`reminder:${id}`, {
            type: 'basic',
            iconUrl: appicon,
            title: notificationTitle,
            message: notificationMessage,
            priority: 2,
            requireInteraction: false
        });

        backgroundLog.info(' Reminder notification created:', {
            title: notificationTitle,
            message: notificationMessage
        });

        // Do not remove the reminder here; it will be removed by the global
        // notification click handler to avoid race conditions and ensure the
        // click handler has access to the stored reminder data.
    } catch (error) {
        backgroundLog.error(' Error handling reminder alarm:', error);
    }
});

// Periodic cache cleanup (scheduled via chrome.alarms every 6 hours)

// ============================================================================
// Initialization
// ============================================================================


backgroundLog.info(' Browser actions event listeners initialized');

// ============================================================================
// Offscreen Document: Summarizer Broker
// ============================================================================
// Offscreen document management moved to src/offscreen/ensure.ts

type SummarizeRequestMessage = {
    type: 'summarize:request';
    payload: {
        requestId: string;
        text: string;
        options?: {
            type?: 'key-points' | 'tldr' | 'teaser' | 'headline';
            format?: 'markdown' | 'plain-text';
            length?: 'short' | 'medium' | 'long';
            sharedContext?: string;
        };
        context?: string;
    };
};






