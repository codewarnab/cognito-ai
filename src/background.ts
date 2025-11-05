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
    discoverOAuthEndpoints
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
    McpExtensionResponse,
    OAuthEndpoints,
    McpTool
} from './mcp/types';
import { MCP_OAUTH_CONFIG, SERVER_SPECIFIC_CONFIGS } from './constants';
import { MCP_SERVERS, type ServerConfig } from './constants/mcpServers';
import { MCPError, NetworkError } from './errors/errorTypes';
import { buildUserMessage } from './errors/errorMessages';
import {
    createAINotification,
    parseNotificationId,
    isAINotification,
    clearNotification
} from './utils/aiNotification';
import type { AINotificationPayload } from './types/notifications';

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
        console.log('[Background] Initializing OAuth redirect URI:', redirectURL);

        // Mutate the const object (this is safe at runtime)
        (MCP_OAUTH_CONFIG as any).REDIRECT_URI = redirectURL;
    }
}

// Initialize redirect URI immediately when service worker loads
initializeOAuthRedirectURI();

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
    for (const [_serverId, state] of serverStates) {
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
 * Refresh access token for any MCP server with enhanced error handling
 * 
 * Error handling:
 * - Validates prerequisites (refresh token, credentials, endpoints)
 * - Handles network errors during refresh
 * - Falls back to endpoint re-discovery if needed
 * - Updates scope information after refresh
 * - Schedules next automatic refresh
 */
async function refreshServerToken(serverId: string): Promise<boolean> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    if (!state.tokens?.refresh_token) {
        console.error(`[Background:${serverId}] No refresh token available`);
        const error = MCPError.authFailed(
            serverId,
            'No refresh token available. Re-authentication required.'
        );
        state.status = { ...state.status, state: 'needs-auth', error: buildUserMessage(error) };
        broadcastStatusUpdate(serverId, state.status);
        return false;
    }

    // Load client credentials if not in memory
    if (!state.credentials) {
        state.credentials = await getStoredClientCredentials(serverId);
        console.log(`[Background:${serverId}] Loaded client credentials for token refresh`);
    }

    if (!state.credentials) {
        console.error(`[Background:${serverId}] No client credentials available for token refresh`);
        const error = MCPError.authFailed(
            serverId,
            'No client credentials found. Re-authentication required.'
        );
        state.status = { ...state.status, state: 'needs-auth', error: buildUserMessage(error) };
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
                const error = MCPError.authFailed(
                    serverId,
                    `Failed to discover OAuth endpoints: ${discoveryError instanceof Error ? discoveryError.message : 'Unknown error'}`
                );
                state.status = { ...state.status, state: 'needs-auth', error: buildUserMessage(error) };
                broadcastStatusUpdate(serverId, state.status);
                return false;
            }
        }
    }

    // Final check: if still no endpoints, fail
    if (!state.oauthEndpoints) {
        console.error(`[Background:${serverId}] No OAuth endpoints available after all attempts (memory, storage, and re-discovery)`);
        const error = MCPError.authFailed(
            serverId,
            'OAuth endpoints unavailable. Re-authentication required.'
        );
        state.status = { ...state.status, state: 'needs-auth', error: buildUserMessage(error) };
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

        // Categorize the error
        let mcpError: MCPError;
        if (error instanceof MCPError) {
            mcpError = error;
        } else {
            mcpError = MCPError.authFailed(
                serverId,
                `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }

        // Clear invalid tokens
        await clearTokens(serverId);
        state.tokens = null;

        const errorMessage = buildUserMessage(mcpError);
        state.status = {
            ...state.status,
            state: 'needs-auth',
            error: errorMessage
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
        console.error(`[Background:${serverId}]`, error.message);
        return {
            success: false,
            error: error.message
        };
    }

    if (!serverConfig.url) {
        const error = new Error(`No URL configured for ${serverId}`);
        console.error(`[Background:${serverId}]`, error.message);
        return {
            success: false,
            error: error.message
        };
    }

    try {
        console.log(`[Background:${serverId}] Connecting to MCP server`);

        // Only require token for servers that need authentication
        let accessToken: string | null = null;
        if (serverConfig.requiresAuthentication) {
            accessToken = await ensureValidToken(serverId);
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
            console.log(`[Background:${serverId}] Server does not require authentication, proceeding without token`);
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
                    console.log(`[Background:${serverId}] MCP message:`, message);
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

        console.log(`[Background:${serverId}] Successfully connected and initialized`);
        return { success: true, data: state.client.getStatus() };

    } catch (error) {
        console.error(`[Background:${serverId}] MCP connection error:`, error);

        // Categorize the error and provide user-friendly message
        let errorMessage: string;

        if (error instanceof MCPError || error instanceof NetworkError) {
            errorMessage = buildUserMessage(error);
        } else if (error instanceof Error) {
            // Wrap generic errors in MCPError
            const mcpError = MCPError.connectionFailed(
                serverId,
                error.message
            );
            errorMessage = buildUserMessage(mcpError);
        } else {
            errorMessage = 'Connection failed due to an unknown error';
        }

        // Update server state with error
        state.status = {
            ...state.status,
            state: 'error',
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
                    (healthCheckClient as McpSSEClient).disconnect();
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
                (healthCheckClient as McpSSEClient).disconnect();
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

            const serverType = serverConfig.url?.endsWith('/sse') ? 'sse' : 'mcp';

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

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
    console.log('[Background] Received message:', message.type, message);

    // Handle model download progress broadcasts
    if (message.type === 'MODEL_DOWNLOAD_PROGRESS') {
        console.log('[Background] Relaying model download progress to sidepanel:', message.data);

        // Broadcast to all extension contexts (especially sidepanel)
        chrome.runtime.sendMessage({
            type: 'MODEL_DOWNLOAD_PROGRESS_UPDATE',
            data: message.data,
        }).catch((error) => {
            console.debug('[Background] No listeners for download progress update:', error);
        });

        sendResponse({ success: true });
        return true;
    }

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

    // Handle AI notification creation
    if (message?.type === 'ai/notification/create') {
        (async () => {
            try {
                const payload = message.payload as AINotificationPayload;
                console.log('[Background] Creating AI notification:', payload);

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
                console.error('[Background] Error creating AI notification:', error);
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
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
            console.log('[Background] AI notification clicked:', notificationId);

            const parsed = parseNotificationId(notificationId);
            if (!parsed) {
                console.warn('[Background] Invalid AI notification ID:', notificationId);
                return;
            }

            // Open/focus sidepanel
            try {
                await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
            } catch (error) {
                console.error('[Background] Error opening sidepanel:', error);
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
                console.debug('[Background] No listeners for navigation message:', error);
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
            console.warn('[Background] Invalid reminder notification ID:', notificationId);
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
        console.error('[Background] Error handling notification click:', error);
    }
});

// Global notification button click handler for AI notifications
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    try {
        // Only handle AI completion notifications
        if (!isAINotification(notificationId)) {
            return;
        }

        console.log('[Background] AI notification button clicked:', notificationId, buttonIndex);

        const parsed = parseNotificationId(notificationId);
        if (!parsed) {
            console.warn('[Background] Invalid AI notification ID:', notificationId);
            return;
        }

        // Button 0: Continue Iterating
        // Button 1: Dismiss
        if (buttonIndex === 0) {
            // Continue Iterating clicked
            console.log('[Background] Continue Iterating clicked for thread:', parsed.threadId);

            // Open/focus sidepanel
            try {
                await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
            } catch (error) {
                console.error('[Background] Error opening sidepanel:', error);
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
                console.debug('[Background] No listeners for continue action:', error);
            }
        } else if (buttonIndex === 1) {
            // Dismiss clicked - just clear the notification
            console.log('[Background] Dismiss clicked for thread:', parsed.threadId);
        }

        // Clear the notification regardless of which button was clicked
        await clearNotification(notificationId);
    } catch (error) {
        console.error('[Background] Error handling notification button click:', error);
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
    if (!id) {
        console.warn('[Background] Invalid reminder alarm name:', alarm.name);
        return;
    }

    console.log('[Background] Reminder alarm fired:', id);

    try {
        // Get the reminder from storage
        const { reminders = {} } = await chrome.storage.local.get('reminders');
        const remindersMap = reminders as Record<string, Reminder>;
        const reminder: Reminder | undefined = remindersMap[id];

        if (!reminder) {
            console.warn('[Background] Reminder not found:', id);
            return;
        }

        // Create notification with AI-generated content or fallback to original title
        const appicon = 'data:image/png;base64,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';

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


