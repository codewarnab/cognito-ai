/**
 * MV3 Background Service Worker - Main Entry Point
 * 
 * Handles:
 * - Side panel initialization
 * - Extension lifecycle events
 * - Multi-server MCP OAuth and SSE connections
 */

import { McpSSEClient } from './mcp/sseClient';
import {
    registerDynamicClient,
    generateState,
    buildAuthUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    isTokenExpired,
    storeTokens,
    getStoredTokens,
    clearTokens,
    storeClientCredentials,
    getStoredClientCredentials,
    clearClientCredentials,
    storeOAuthEndpoints,
    getStoredOAuthEndpoints,
    clearOAuthEndpoints,
    type DynamicClientCredentials
} from './mcp/oauth';
import {
    discoverOAuthEndpoints,
    parseScopeChallenge
} from './mcp/discovery';
import {
    selectScopes,
    updateGrantedScopes,
    clearScopeData
} from './mcp/scopeHandler';
import type {
    McpOAuthTokens,
    OAuthState,
    McpServerStatus,
    McpExtensionMessage,
    McpExtensionResponse,
    McpMessage,
    OAuthEndpoints,
    McpTool
} from './mcp/types';
import { MCP_OAUTH_CONFIG, SERVER_SPECIFIC_CONFIGS } from './constants';
import { MCP_SERVERS, type ServerConfig } from './constants/mcpServers';

// ============================================================================
// Service Worker Keep-Alive Management
// ============================================================================

/**
 * Chrome API keep-alive interval to prevent service worker termination
 * This exploit calls chrome.runtime.getPlatformInfo every 20 seconds
 * to keep the service worker running when MCP servers are enabled
 */
let keepAliveInterval: number | null = null;

/**
 * Start keep-alive when at least one MCP server is enabled
 */
function startMCPKeepAlive(): void {
    if (keepAliveInterval !== null) {
        console.log('[Background] Keep-alive already running');
        return;
    }

    console.log('[Background] Starting MCP keep-alive to prevent service worker termination');

    // Call chrome.runtime.getPlatformInfo every 20 seconds
    // This keeps service worker alive indefinitely (Chrome 110+ exploit)
    keepAliveInterval = setInterval(() => {
        chrome.runtime.getPlatformInfo(() => {
            // No-op callback, just keeping worker alive
        });
    }, 20000) as unknown as number;

    console.log('[Background] Keep-alive started successfully');
}

/**
 * Stop keep-alive when all MCP servers are disabled
 */
function stopMCPKeepAlive(): void {
    if (keepAliveInterval === null) {
        return;
    }

    console.log('[Background] Stopping MCP keep-alive');
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('[Background] Keep-alive stopped');
}

/**
 * Check if any MCP server is currently enabled
 */
function hasEnabledMCPServers(): boolean {
    for (const [serverId, state] of serverStates) {
        if (state.isEnabled) {
            return true;
        }
    }
    return false;
}

/**
 * Update keep-alive state based on enabled MCP servers
 */
function updateKeepAliveState(): void {
    const hasEnabled = hasEnabledMCPServers();

    if (hasEnabled && keepAliveInterval === null) {
        startMCPKeepAlive();
    } else if (!hasEnabled && keepAliveInterval !== null) {
        stopMCPKeepAlive();
    }
}

// ============================================================================
// Multi-Server MCP State
// ============================================================================

/**
 * State for each MCP server
 */
interface ServerState {
    client: McpSSEClient | null;
    tokens: McpOAuthTokens | null;
    credentials: DynamicClientCredentials | null;
    status: McpServerStatus;
    oauthEndpoints: OAuthEndpoints | null;
    oauthState: OAuthState | null;
    isEnabled: boolean;
}

/**
 * Map of server states by serverId
 */
const serverStates = new Map<string, ServerState>();

/**
 * Get or initialize server state
 */
function getServerState(serverId: string): ServerState {
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
 * Get server config by ID
 */
function getServerConfig(serverId: string): ServerConfig | null {
    return MCP_SERVERS.find(s => s.id === serverId) || null;
}


/**
 * Schedule automatic token refresh before expiration
 * Calculates when to refresh and sets a server-specific alarm
 */
async function scheduleTokenRefresh(serverId: string, tokens: McpOAuthTokens): Promise<void> {
    try {
        const alarmName = `mcp-token-refresh-${serverId}`;

        // Clear any existing refresh alarm for this server
        await chrome.alarms.clear(alarmName);

        // Calculate when to refresh (buffer time before expiration)
        const refreshTime = tokens.expires_at - MCP_OAUTH_CONFIG.TOKEN_REFRESH_BUFFER;
        const now = Date.now();

        // Only schedule if the refresh time is in the future
        if (refreshTime > now) {
            console.log(`[Background:${serverId}] Creating alarm "${alarmName}" for token refresh`, {
                refreshTime,
                refreshTimeISO: new Date(refreshTime).toISOString(),
                now,
                nowISO: new Date(now).toISOString(),
                delayMs: refreshTime - now
            });

            await chrome.alarms.create(alarmName, {
                when: refreshTime
            });

            console.log(`[Background:${serverId}] Alarm "${alarmName}" created successfully`);

            const expiresAt = new Date(tokens.expires_at).toISOString();
            const refreshAt = new Date(refreshTime).toISOString();
            console.log(`[Background:${serverId}] Token refresh scheduled:`, {
                alarmName,
                expiresAt,
                refreshAt,
                delayMinutes: Math.ceil((refreshTime - now) / (1000 * 60))
            });
        } else {
            console.warn(`[Background:${serverId}] Token expires too soon for automatic refresh:`, {
                expiresAt: new Date(tokens.expires_at).toISOString(),
                now: new Date(now).toISOString()
            });
        }
    } catch (error) {
        console.error(`[Background:${serverId}] Error scheduling token refresh:`, error);
    }
}

/**
 * Handle automatic token refresh alarm for a specific server
 */
async function handleTokenRefreshAlarm(serverId: string): Promise<void> {
    console.log(`[Background:${serverId}] Token refresh alarm fired`);

    try {
        const state = getServerState(serverId);

        // Check if server is still enabled
        if (!state.isEnabled) {
            console.log(`[Background:${serverId}] Server disabled, skipping token refresh`);
            return;
        }

        // Attempt to refresh the token
        const refreshed = await refreshServerToken(serverId);

        if (refreshed && state.tokens) {
            // Schedule the next refresh
            await scheduleTokenRefresh(serverId, state.tokens);
            console.log(`[Background:${serverId}] Token refreshed successfully, next refresh scheduled`);
        } else {
            console.error(`[Background:${serverId}] Token refresh failed during alarm, may require re-authentication`);
            state.status = {
                ...state.status,
                state: 'needs-auth',
                error: 'Automatic token refresh failed. Please re-authenticate.'
            };
            broadcastStatusUpdate(serverId, state.status);
        }
    } catch (error) {
        console.error(`[Background:${serverId}] Error in token refresh alarm:`, error);
    }
}

/**
 * Ensure token is valid and schedule refresh if needed
 */
async function ensureTokenValidity(serverId: string): Promise<boolean> {
    try {
        const state = getServerState(serverId);
        const tokens = await getStoredTokens(serverId);

        if (!tokens) {
            console.log(`[Background:${serverId}] No stored tokens found`);
            return false;
        }

        console.log(`[Background:${serverId}] Checking token validity:`, {
            expiresAt: new Date(tokens.expires_at).toISOString(),
            now: new Date().toISOString(),
            isExpired: isTokenExpired(tokens)
        });

        // Check if token is expired or about to expire
        if (isTokenExpired(tokens)) {
            console.log(`[Background:${serverId}] Token expired or expiring soon, attempting refresh`);

            // Load tokens into memory
            state.tokens = tokens;

            // Try to refresh
            const refreshed = await refreshServerToken(serverId);
            if (refreshed && state.tokens) {
                // Schedule next refresh
                await scheduleTokenRefresh(serverId, state.tokens);
                return true;
            } else {
                // Refresh failed, need re-auth
                return false;
            }
        }

        // Token is still valid, schedule next refresh
        state.tokens = tokens;
        await scheduleTokenRefresh(serverId, tokens);
        return true;
    } catch (error) {
        console.error(`[Background:${serverId}] Error in ensureTokenValidity:`, error);
        return false;
    }
}

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
        console.log(`[Background:${serverId}] Starting OAuth flow with dynamic client registration`);

        // Step 1: Discover OAuth endpoints using proper RFC 9728 + RFC 8414 metadata discovery
        // Never use hardcoded hints - always follow the MCP specification discovery flow
        state.status = { ...state.status, state: 'connecting' };
        broadcastStatusUpdate(serverId, state.status);

        let endpoints: OAuthEndpoints | null = state.oauthEndpoints;

        if (!endpoints) {
            // Perform spec-compliant OAuth discovery following RFC 9728 (Protected Resource Metadata)
            // and RFC 8414 (Authorization Server Metadata)
            console.log(`[Background:${serverId}] Performing OAuth discovery per RFC 9728 + RFC 8414...`);
            endpoints = await discoverOAuthEndpoints(serverConfig.url);

            if (!endpoints) {
                throw new Error('OAuth discovery failed. Server may not support OAuth or endpoints are not discoverable. Ensure the server implements RFC 9728 Protected Resource Metadata discovery.');
            }

            // Cache discovered endpoints for future use
            state.oauthEndpoints = endpoints;

            // Persist endpoints to storage so they survive service worker restarts
            await storeOAuthEndpoints(serverId, endpoints);

            console.log(`[Background:${serverId}] Successfully discovered OAuth endpoints:`, {
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
        console.log(`[Background:${serverId}] Registering dynamic client...`);
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

        console.log(`[Background:${serverId}] Dynamic client registered:`, clientCredentials.client_id);

        // Step 3: Generate state for CSRF protection
        const oauthStateValue = generateState();

        // Store state in memory for the callback
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

        console.log(`[Background:${serverId}] Launching OAuth...`);
        console.log(`[Background:${serverId}] Authorization URL: ${authUrl}`);

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
            console.error(`[Background:${serverId}] Could not load OAuth URL:`, error);
            throw new Error(`Could not load OAuth URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        if (!redirectUrl) {
            throw new Error('OAuth flow cancelled');
        }

        console.log(`[Background:${serverId}] OAuth redirect URL received`);

        // Step 6: Extract code and state from redirect URL
        const url = new URL(redirectUrl);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (!code) {
            throw new Error('No authorization code received');
        }

        // Verify state
        if (!state.oauthState || returnedState !== state.oauthState.state) {
            throw new Error('State mismatch - possible CSRF attack');
        }

        console.log(`[Background:${serverId}] Exchanging code for tokens`);

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
        console.log(`[Background:${serverId}] Client credentials stored after user approval`);

        // Update granted scopes
        if (tokens.scope) {
            await updateGrantedScopes(serverId, tokens.scope);
        }

        // Store tokens
        state.tokens = tokens;
        await storeTokens(serverId, tokens);

        console.log(`[Background:${serverId}] Tokens stored successfully`);

        // Schedule automatic token refresh before expiry
        await scheduleTokenRefresh(serverId, tokens);

        // Update status
        state.status = { ...state.status, state: 'authenticated' };
        broadcastStatusUpdate(serverId, state.status);

        console.log(`[Background:${serverId}] OAuth successful`);

        return { success: true, data: { state: 'authenticated' } };
    } catch (error) {
        console
        console.error(`[Background:${serverId}] OAuth error:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        console.log("full error :", error);

        // Check if user cancelled or denied the flow
        const wasCancelled = errorMessage.toLowerCase().includes('cancelled') ||
            errorMessage.toLowerCase().includes('closed') ||
            errorMessage.toLowerCase().includes('denied') ||
            errorMessage.toLowerCase().includes('did not approve') ||
            errorMessage.toLowerCase().includes('user denied');

        if (wasCancelled) {
            console.log(`[Background:${serverId}] OAuth flow was cancelled/denied by user - cleaning up...`);

            // Clean up ALL partial data since auth was cancelled
            // Clear storage (in case anything was written)
            await clearClientCredentials(serverId);
            await clearTokens(serverId);
            await clearScopeData(serverId);
            await clearOAuthEndpoints(serverId);

            // Clear memory state
            state.credentials = null;
            state.tokens = null;
            state.oauthEndpoints = null;

            // Set state back to disconnected (clean slate) since cancellation is not an error
            state.status = { serverId, state: 'disconnected' };

            console.log(`[Background:${serverId}] Cleanup complete after cancellation`);
        } else {
            // Actual error occurred (not user cancellation)
            console.error(`[Background:${serverId}] Actual authentication error (not cancellation):`, errorMessage);

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

/**
 * Refresh access token for any MCP server
 */
async function refreshServerToken(serverId: string): Promise<boolean> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    if (!state.tokens?.refresh_token) {
        console.error(`[Background:${serverId}] No refresh token available`);
        state.status = { ...state.status, state: 'needs-auth', error: 'No refresh token' };
        broadcastStatusUpdate(serverId, state.status);
        return false;
    }

    // Load client credentials if not in memory
    if (!state.credentials) {
        state.credentials = await getStoredClientCredentials(serverId);
    }
    console.log(`[Background:${serverId}] Loaded client credentials for token refresh`, state.credentials);

    if (!state.credentials) {
        console.error(`[Background:${serverId}] No client credentials available for token refresh`);
        state.status = { ...state.status, state: 'needs-auth', error: 'No client credentials' };
        broadcastStatusUpdate(serverId, state.status);
        return false;
    }

    // Load OAuth endpoints if not in memory
    if (!state.oauthEndpoints) {
        state.oauthEndpoints = await getStoredOAuthEndpoints(serverId);
        if (state.oauthEndpoints) {
            console.log(`[Background:${serverId}] Loaded OAuth endpoints from storage for token refresh`);
        }
    }

    // If still not available, try to re-discover them as a fallback
    if (!state.oauthEndpoints) {
        console.log(`[Background:${serverId}] OAuth endpoints not found in memory or storage, attempting re-discovery...`);

        if (serverConfig?.url) {
            try {
                const discoveredEndpoints = await discoverOAuthEndpoints(serverConfig.url);

                if (discoveredEndpoints) {
                    console.log(`[Background:${serverId}] Successfully re-discovered OAuth endpoints`);
                    state.oauthEndpoints = discoveredEndpoints;

                    // Persist the re-discovered endpoints for future use
                    await storeOAuthEndpoints(serverId, discoveredEndpoints);
                } else {
                    console.error(`[Background:${serverId}] OAuth endpoint re-discovery failed`);
                }
            } catch (discoveryError) {
                console.error(`[Background:${serverId}] Error during OAuth endpoint re-discovery:`, discoveryError);
            }
        }
    }

    // Final check: if still no endpoints, fail
    if (!state.oauthEndpoints) {
        console.error(`[Background:${serverId}] No OAuth endpoints available after all attempts (memory, storage, and re-discovery)`);
        state.status = { ...state.status, state: 'needs-auth', error: 'No OAuth endpoints' };
        broadcastStatusUpdate(serverId, state.status);
        return false;
    }

    try {
        console.log(`[Background:${serverId}] Refreshing token`);
        state.status = { ...state.status, state: 'token-refresh' };
        broadcastStatusUpdate(serverId, state.status);

        const specificConfig = SERVER_SPECIFIC_CONFIGS[serverId];
        const customHeaders = specificConfig?.customHeaders;

        const newTokens = await refreshAccessToken(
            serverId,
            state.oauthEndpoints.token_endpoint,
            state.tokens.refresh_token,
            state.credentials.client_id,
            state.credentials.client_secret,
            serverConfig?.oauth?.resource || state.oauthEndpoints.resource,
            customHeaders
        );

        // Update granted scopes
        if (newTokens.scope) {
            await updateGrantedScopes(serverId, newTokens.scope);
        }

        state.tokens = newTokens;
        await storeTokens(serverId, newTokens);

        // Schedule next automatic token refresh
        await scheduleTokenRefresh(serverId, newTokens);

        state.status = { ...state.status, state: 'authenticated' };
        broadcastStatusUpdate(serverId, state.status);

        console.log(`[Background:${serverId}] Token refreshed successfully`);
        return true;
    } catch (error) {
        console.error(`[Background:${serverId}] Token refresh failed:`, error);
        // Clear invalid tokens
        await clearTokens(serverId);
        state.tokens = null;
        state.status = {
            ...state.status,
            state: 'needs-auth',
            error: 'Token refresh failed. Please re-authenticate.'
        };
        broadcastStatusUpdate(serverId, state.status);
        return false;
    }
}

/**
 * Ensure we have a valid access token for a server
 */
async function ensureValidToken(serverId: string): Promise<string | null> {
    const state = getServerState(serverId);

    if (!state.tokens) {
        // Try to load from storage
        state.tokens = await getStoredTokens(serverId);
    }

    if (!state.tokens) {
        return null;
    }

    // Check if token is expired
    if (isTokenExpired(state.tokens)) {
        const refreshed = await refreshServerToken(serverId);
        if (!refreshed) {
            return null;
        }
    }

    return state.tokens.access_token;
}

// ============================================================================
// MCP Connection Functions
// ============================================================================

/**
 * Connect to any MCP server
 */
async function connectMcpServer(serverId: string): Promise<McpExtensionResponse> {
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
        console.log(`[Background:${serverId}] Connecting to MCP server`);

        // Only require token for servers that need authentication
        let accessToken: string | null = null;
        if (serverConfig.requiresAuthentication) {
            accessToken = await ensureValidToken(serverId);
            if (!accessToken) {
                return {
                    success: false,
                    error: 'Authentication required'
                };
            }
        } else {
            // For servers that don't require authentication, use empty string
            accessToken = '';
            console.log(`[Background:${serverId}] Server does not require authentication, proceeding without token`);
        }

        // Create SSE client
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
                    console.log(`[Background:${serverId}] MCP message:`, message);
                }
            },
            {
                reconnectMinDelay: MCP_OAUTH_CONFIG.RECONNECT_MIN_DELAY,
                reconnectMaxDelay: MCP_OAUTH_CONFIG.RECONNECT_MAX_DELAY,
                reconnectMultiplier: MCP_OAUTH_CONFIG.RECONNECT_MULTIPLIER
            }
        );

        // Connect
        await state.client.connect();

        // Initialize MCP protocol
        await state.client.initialize();

        return { success: true, data: state.client.getStatus() };
    } catch (error) {
        console.error(`[Background:${serverId}] MCP connection error:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed'
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
    console.log(`[Background:${serverId}] Handling token expiry`);

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
    console.log(`[Background:${serverId}] Handling invalid token format`);

    const state = getServerState(serverId);

    // Disconnect current client
    if (state.client) {
        state.client.disconnect();
        state.client = null;
    }

    // Clear invalid tokens and client credentials - don't try to refresh
    await clearTokens(serverId);
    await clearClientCredentials(serverId);
    await clearScopeData(serverId);
    await clearOAuthEndpoints(serverId);

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
        console.log(`[Background:${serverId}] Already connected and initialized`);
        return { success: true, data: state.status };
    }

    // Check if server requires authentication
    if (serverConfig && !serverConfig.requiresAuthentication) {
        // Server doesn't require authentication, connect directly
        console.log(`[Background:${serverId}] Server does not require authentication, connecting directly`);
        const connectResult = await connectMcpServer(serverId);

        if (connectResult.success) {
            console.log(`[Background:${serverId}] Connection and initialization successful`);
        } else {
            console.warn(`[Background:${serverId}] Connection failed:`, connectResult.error);
        }

        return connectResult;
    }

    // If authenticated, connect
    if (state.tokens || await getStoredTokens(serverId)) {
        const connectResult = await connectMcpServer(serverId);

        // No need for separate health check - our client already initializes and fetches tools during connection
        if (connectResult.success) {
            console.log(`[Background:${serverId}] Connection and initialization successful`);
        } else {
            console.warn(`[Background:${serverId}] Connection failed:`, connectResult.error);
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
    console.log(`[Background:${serverId}] Disconnecting and clearing all authentication data...`);
    const state = getServerState(serverId);

    // Disconnect the MCP client if active
    disconnectMcpServer(serverId);

    // Clear all stored authentication data from chrome.storage.local
    await clearTokens(serverId);
    await clearClientCredentials(serverId);
    await clearScopeData(serverId);
    await clearOAuthEndpoints(serverId);

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

    console.log(`[Background:${serverId}] All authentication data cleared successfully`);
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

/**
 * Broadcast status update to all listeners
 */
function broadcastStatusUpdate(serverId: string, status: McpServerStatus): void {
    chrome.runtime.sendMessage({
        type: `mcp/${serverId}/status/update`,
        payload: status
    }).catch(() => {
        // Ignore errors if no listeners
    });
}

/**
 * Get disabled tools for a server from chrome.storage
 */
async function getDisabledTools(serverId: string): Promise<string[]> {
    const key = `mcp.${serverId}.tools.disabled`;
    const result = await chrome.storage.local.get(key);
    return result[key] || [];
}

/**
 * Set disabled tools for a server in chrome.storage
 */
async function setDisabledTools(serverId: string, toolNames: string[]): Promise<void> {
    const key = `mcp.${serverId}.tools.disabled`;
    await chrome.storage.local.set({ [key]: toolNames });
}

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
        console.log(`[Background:${serverId}] Performing MCP health check with custom client`);

        // Get access token (only required if server needs authentication)
        let accessToken: string | null = null;
        if (serverConfig.requiresAuthentication) {
            accessToken = await ensureValidToken(serverId);
            if (!accessToken) {
                return {
                    success: false,
                    error: 'No valid access token available'
                };
            }
        } else {
            // For servers that don't require authentication, use empty string
            accessToken = '';
            console.log(`[Background:${serverId}] Server does not require authentication, performing health check without token`);
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
                        console.log(`[Background:${serverId}] Health check status:`, status.state);
                    },
                    onMessage: (message) => {
                        // Ignore messages during health check
                    }
                },
                {
                    reconnectMinDelay: MCP_OAUTH_CONFIG.RECONNECT_MIN_DELAY,
                    reconnectMaxDelay: MCP_OAUTH_CONFIG.RECONNECT_MAX_DELAY,
                    reconnectMultiplier: MCP_OAUTH_CONFIG.RECONNECT_MULTIPLIER
                }
            );

            console.log(`[Background:${serverId}] Connecting to MCP server (auto-detect transport)...`);

            // Connect (will auto-detect Streamable HTTP vs HTTP+SSE)
            await healthCheckClient.connect();
            console.log(`[Background:${serverId}] Connected successfully`);

            // Initialize MCP protocol
            await healthCheckClient.initialize();
            console.log(`[Background:${serverId}] Initialized successfully`);

            // Get server status (includes tools)
            const status = healthCheckClient.getStatus();
            console.log(`[Background:${serverId}] Server status:`, status);

            // Disconnect the health check client
            healthCheckClient.disconnect();

            if (status.tools && status.tools.length > 0) {
                console.log(`[Background:${serverId}] Health check passed. Tools available:`, status.tools.length);

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
            console.error(`[Background:${serverId}] Health check failed:`, transportError);

            // Clean up client if exists
            if (healthCheckClient) {
                try {
                    healthCheckClient.disconnect();
                } catch (closeError) {
                    console.error(`[Background:${serverId}] Error closing client:`, closeError);
                }
            }

            return {
                success: false,
                error: transportError instanceof Error ? transportError.message : 'Connection failed'
            };
        }
    } catch (error) {
        console.error(`[Background:${serverId}] Health check error:`, error);

        // Clean up client if exists
        if (healthCheckClient) {
            try {
                healthCheckClient.disconnect();
            } catch (closeError) {
                console.error(`[Background:${serverId}] Error closing client:`, closeError);
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
                        console.log(`[Background:${serverId}] Added ${serverTools.length} tools`);
                    }
                } catch (error) {
                    console.error(`[Background:${serverId}] Error listing tools:`, error);
                    // Continue with other servers instead of failing completely
                }
            }
        }

        console.log(`[Background] Total MCP tools available: ${allTools.length}`);
        return { success: true, data: { tools: allTools } };
    } catch (error) {
        console.error('[Background] Error getting all MCP tools:', error);
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
        console.error(`[Background:${serverId}] Tool call error:`, error);
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
    console.log('[Background] getMCPServerConfigs called');
    const servers = [];

    try {
        console.log(`[Background] Processing ${MCP_SERVERS.length} server configs`);

        for (const serverConfig of MCP_SERVERS) {
            const serverId = serverConfig.id;
            const state = getServerState(serverId);

            console.log(`[Background:${serverId}] Checking server configuration:`, {
                name: serverConfig.name,
                url: serverConfig.url,
                hasTokens: !!state.tokens,
                hasAccessToken: !!state.tokens?.access_token,
                currentStatus: state.status.state
            });

            // Get enabled status from storage
            const { [`mcp.${serverId}.enabled`]: isEnabled } = await chrome.storage.local.get(`mcp.${serverId}.enabled`);
            console.log(`[Background:${serverId}] Enabled status from storage:`, isEnabled);

            const serverType = serverConfig.url.endsWith('/sse') ? 'sse' : 'mcp';

            // Add server if enabled AND either:
            // 1. Server requires authentication and has access token
            // 2. Server doesn't require authentication
            const shouldAddServer = isEnabled && serverConfig.url && (
                !serverConfig.requiresAuthentication ||
                (serverConfig.requiresAuthentication && state.tokens?.access_token)
            );

            if (shouldAddServer) {
                console.log(`[Background:${serverId}] ✓ Adding server to frontend config`);

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

                console.log(`[Background:${serverId}] ${serverConfig.name} configured for frontend (requiresAuth: ${serverConfig.requiresAuthentication})`);
            } else {
                console.log(`[Background:${serverId}] ✗ Not adding to config - Conditions not met:`, {
                    isEnabled,
                    requiresAuthentication: serverConfig.requiresAuthentication,
                    hasAccessToken: !!state.tokens?.access_token,
                    hasUrl: !!serverConfig.url
                });
            }
        }

        console.log(`[Background] Returning ${servers.length} configured server(s)`);
    } catch (error) {
        console.error('[Background] Error getting MCP server configs:', error);
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
            console.log(`[Background:${serverId}] OAuth endpoints restored from storage`);
        }

        if (tokens) {
            // User has tokens, mark as authenticated
            state.status = { ...state.status, state: 'authenticated' };
            console.log(`[Background:${serverId}] Status initialized: authenticated (tokens found)`);
        } else if (serverConfig && !serverConfig.requiresAuthentication) {
            // Server doesn't require authentication, mark as ready to connect
            state.status = { ...state.status, state: 'disconnected' };
            console.log(`[Background:${serverId}] Status initialized: disconnected (no auth required)`);
        } else {
            // No tokens and server requires auth
            state.status = { ...state.status, state: 'needs-auth' };
            console.log(`[Background:${serverId}] Status initialized: needs-auth (no tokens)`);
        }
    } catch (error) {
        console.error(`[Background:${serverId}] Error initializing status:`, error);
        state.status = { ...state.status, state: 'disconnected' };
    }
}

// ============================================================================
// Message Handler
// ============================================================================

chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    console.log('[Background] Received message:', message.type, message);

    // Handle general MCP messages
    if (message.type === 'mcp/servers/get') {
        (async () => {
            try {
                const servers = await getMCPServerConfigs();
                console.log('[Background] Sending MCP server configs:', servers);
                sendResponse({ success: true, data: servers });
            } catch (error) {
                console.error('[Background] Error getting MCP server configs:', error);
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
                console.log('[Background] Sending MCP tools list:', result);
                sendResponse(result);
            } catch (error) {
                console.error('[Background] Error getting MCP tools:', error);
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

            console.log(`[Background] Handling MCP message for ${serverId}:`, action);

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

            console.log(`[Background:${serverId}] Sending MCP response:`, response);
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

    // Return false for unhandled messages
    return false;
});

// ============================================================================
// Runtime Listeners
// ============================================================================

// Global notification click handler for reminders
chrome.notifications.onClicked.addListener(async (notificationId) => {
    try {
        if (!notificationId.startsWith('reminder:')) {
            return;
        }

        const id = notificationId.split(':')[1];
        const { reminders = {} } = await chrome.storage.local.get('reminders');
        const reminder: Reminder | undefined = reminders[id];

        if (reminder?.url) {
            await chrome.tabs.create({ url: reminder.url });
        }

        // Cleanup: remove reminder and clear notification
        if (reminders[id]) {
            delete reminders[id];
            await chrome.storage.local.set({ reminders });
        }

        chrome.notifications.clear(notificationId);
    } catch (error) {
        console.error('[Background] Error handling notification click:', error);
    }
});

/**
 * Initialize all MCP servers from storage
 */
async function initializeAllServers(): Promise<void> {
    console.log('[Background] Initializing all MCP servers');

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
                const tokens = await getStoredTokens(serverId);
                const credentials = await getStoredClientCredentials(serverId);

                if (tokens && credentials) {
                    state.tokens = tokens;
                    state.credentials = credentials;

                    // Check token validity and schedule refresh if needed
                    const tokenValid = await ensureTokenValidity(serverId);

                    if (tokenValid) {
                        // Attempt to connect
                        await connectMcpServer(serverId);
                        console.log(`[Background] ${serverConfig.name} restored and connected`);
                    } else {
                        console.log(`[Background] ${serverConfig.name} needs re-authentication`);
                    }
                } else {
                    console.log(`[Background] ${serverConfig.name} enabled but no credentials found`);
                }
            }
        } catch (error) {
            console.error(`[Background] Error initializing ${serverId}:`, error);
        }
    }

    // Start keep-alive if any servers are enabled
    console.log('[Background] Checking if keep-alive should start');
    updateKeepAliveState();
}

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Background] onInstalled:', details.reason);

    try {
        // Initialize all MCP servers from storage
        await initializeAllServers();

        // Keep-alive is initialized by initializeAllServers
        console.log('[Background] Keep-alive initialized');

        // Enable side panel on all existing tabs
        if (chrome.sidePanel) {
            chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
        }

        console.log('[Background] Side panel configured');
    } catch (error) {
        console.error('[Background] onInstalled error:', error);
    }
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Background] onStartup - Extension ready');

    // Initialize all MCP servers from storage
    await initializeAllServers();

    // Keep-alive is initialized by initializeAllServers
    console.log('[Background] Keep-alive initialized on startup');
});

/**
 * Action click handler - open side panel
 */
if (chrome.action) {
    chrome.action.onClicked.addListener(async (tab) => {
        if (chrome.sidePanel && tab.id) {
            try {
                await chrome.sidePanel.open({ tabId: tab.id });
            } catch (error) {
                console.error('[Background] Error opening side panel:', error);
            }
        }
    });
}


// Create cleanup alarm (runs every hour)
chrome.alarms.create('cleanup-expired-sessions', {
    periodInMinutes: 60
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
        await handleTokenRefreshAlarm(serverId);
        return;
    }

    // Only handle reminder alarms after this point
    if (!alarm.name.startsWith('reminder:')) {
        return;
    }

    const id = alarm.name.split(':')[1];
    console.log('[Background] Reminder alarm fired:', id);

    try {
        // Get the reminder from storage
        const { reminders = {} } = await chrome.storage.local.get('reminders');
        const reminder: Reminder | undefined = reminders[id];

        if (!reminder) {
            console.warn('[Background] Reminder not found:', id);
            return;
        }

        // Create notification with AI-generated content or fallback to original title
        const simpleIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const notificationTitle = reminder.generatedTitle || '⏰ Reminder';
        const notificationMessage = reminder.generatedDescription || reminder.title;

        // Use a namespaced notification ID to distinguish reminders
        chrome.notifications.create(`reminder:${id}`, {
            type: 'basic',
            iconUrl: simpleIcon,
            title: notificationTitle,
            message: notificationMessage,
            priority: 2,
            requireInteraction: false
        });

        console.log('[Background] Reminder notification created:', {
            title: notificationTitle,
            message: notificationMessage
        });

        // Do not remove the reminder here; it will be removed by the global
        // notification click handler to avoid race conditions and ensure the
        // click handler has access to the stored reminder data.
    } catch (error) {
        console.error('[Background] Error handling reminder alarm:', error);
    }
});

// ============================================================================
// Initialization
// ============================================================================

console.log('[Background] Service worker loaded - CopilotKit powered extension ready');
console.log('[Background] Browser actions event listeners initialized');

// ============================================================================
// Offscreen Document: Summarizer Broker
// ============================================================================

// Ensure a single offscreen document exists
async function ensureOffscreenDocument(): Promise<void> {
    try {
        // Chrome 116+ has chrome.offscreen.hasDocument
        // Fallback: try creating and ignore if already exists
        const hasDoc: boolean = typeof chrome.offscreen?.hasDocument === 'function'
            ? await chrome.offscreen.hasDocument()
            : false;

        if (!hasDoc) {
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                // Using IFRAME_SCRIPTING is appropriate for running DOM APIs & scripts
                reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
                justification: 'Run Chrome Summarizer API in an isolated offscreen document'
            });
            console.log('[Background] Offscreen document created');
        }
    } catch (error) {
        // Some Chrome versions throw if a document already exists
        console.warn('[Background] ensureOffscreenDocument warning:', error);
    }
}

type SummarizeAvailabilityMessage = { type: 'summarize:availability' };
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


