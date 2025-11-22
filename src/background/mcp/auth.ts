/**
 * MCP Authentication Module
 * 
 * Handles OAuth 2.0 flows, token management, and authentication lifecycle
 * for MCP servers.
 */

import {
    registerDynamicClient,
    generateState,
    buildAuthUrl,
    exchangeCodeForTokens,
    storeTokens,
    clearTokens,
    storeClientCredentials,
    clearClientCredentials,
    storeOAuthEndpoints,
    clearOAuthEndpoints
} from '../../mcp/oauth';
import { discoverOAuthEndpoints } from '../../mcp/discovery';
import { selectScopes, updateGrantedScopes, clearScopeData } from '../../mcp/scopeHandler';
import type { McpExtensionResponse, OAuthEndpoints } from '../../mcp/types';
import { getServerState, getServerConfig } from '../../mcp/state';
import { broadcastStatusUpdate } from '../../mcp/events';
import { scheduleTokenRefresh, refreshServerToken } from '../../mcp/authHelpers';
import { MCP_OAUTH_CONFIG, SERVER_SPECIFIC_CONFIGS } from '../../constants';
import { createLogger } from '~logger';
import { disconnectMcpServer, connectMcpServer, registerAuthHandlers } from './manager';
import { updateKeepAliveState } from '../keepAlive';

const mcpLog = createLogger('Background-MCP', 'MCP_CLIENT');
const authLog = createLogger('Background-Auth', 'MCP_AUTH');

// Register auth handlers with manager to avoid circular dependency issues
registerAuthHandlers(handleTokenExpiry, handleInvalidToken);

/**
 * Initialize the OAuth redirect URI dynamically based on the actual extension ID
 * This ensures dev and prod builds use the correct redirect URI
 */
export function initializeOAuthRedirectURI(): void {
    if (!MCP_OAUTH_CONFIG.REDIRECT_URI) {
        // Get the correct redirect URI for this extension
        const redirectURL = chrome.identity.getRedirectURL();
        authLog.info('Initializing OAuth redirect URI:', redirectURL);

        // Mutate the const object (this is safe at runtime)
        (MCP_OAUTH_CONFIG as any).REDIRECT_URI = redirectURL;
    }
}

/**
 * Start OAuth flow for any MCP server with dynamic client registration and discovery
 */
export async function startOAuthFlow(serverId: string): Promise<McpExtensionResponse> {
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

/**
 * Disconnect and clear authentication for a server
 */
export async function disconnectServerAuth(serverId: string): Promise<McpExtensionResponse> {
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
 * Handle token expiry - attempt refresh and reconnect
 */
export async function handleTokenExpiry(serverId: string): Promise<void> {
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
export async function handleInvalidToken(serverId: string): Promise<void> {
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
