/**
 * MCP Authentication Helpers
 * 
 * Handles automatic token refresh scheduling and validation for MCP servers.
 * Ensures tokens remain valid by proactively refreshing before expiration.
 */

import { createLogger } from '~logger';
import { MCP_OAUTH_CONFIG, SERVER_SPECIFIC_CONFIGS } from '@constants';
import { getServerState, getServerConfig } from './state';
import { broadcastStatusUpdate } from './events';
import type { McpOAuthTokens } from './types';
import {
    getStoredTokens,
    storeTokens,
    refreshAccessToken,
    isTokenExpired,
    getStoredClientCredentials,
    clearTokens
} from './oauth';
import { discoverOAuthEndpoints } from './discovery';
import { updateGrantedScopes } from './scopeHandler';
import { storeOAuthEndpoints, getStoredOAuthEndpoints } from './oauth';
import { MCPError } from '../errors';
import { buildUserMessage } from '../errors/errorMessages';

const log = createLogger('Background-AuthHelpers', 'MCP_AUTH');

/**
 * Schedule automatic token refresh before expiration
 * 
 * Calculates when to refresh the token (with a buffer time before expiration)
 * and sets a Chrome alarm to trigger the refresh automatically. This ensures
 * that tokens are refreshed proactively before they expire, minimizing
 * authentication disruptions.
 * 
 * The alarm is named `mcp-token-refresh-{serverId}` to allow per-server scheduling.
 * 
 * @param serverId - The unique identifier for the MCP server
 * @param tokens - The OAuth tokens containing the expiration timestamp
 */
export async function scheduleTokenRefresh(serverId: string, tokens: McpOAuthTokens): Promise<void> {
    try {
        const alarmName = `mcp-token-refresh-${serverId}`;

        // Clear any existing refresh alarm for this server
        await chrome.alarms.clear(alarmName);

        // Calculate when to refresh (buffer time before expiration)
        const refreshTime = tokens.expires_at - MCP_OAUTH_CONFIG.TOKEN_REFRESH_BUFFER;
        const now = Date.now();

        // Only schedule if the refresh time is in the future
        if (refreshTime > now) {
            log.info(`[${serverId}] Creating alarm "${alarmName}" for token refresh`, {
                refreshTime,
                refreshTimeISO: new Date(refreshTime).toISOString(),
                now,
                nowISO: new Date(now).toISOString(),
                delayMs: refreshTime - now
            });

            await chrome.alarms.create(alarmName, {
                when: refreshTime
            });

            log.info(`[${serverId}] Alarm "${alarmName}" created successfully`);

            const expiresAt = new Date(tokens.expires_at).toISOString();
            const refreshAt = new Date(refreshTime).toISOString();
            log.info(`[${serverId}] Token refresh scheduled:`, {
                alarmName,
                expiresAt,
                refreshAt,
                delayMinutes: Math.ceil((refreshTime - now) / (1000 * 60))
            });
        } else {
            log.warn(`[${serverId}] Token expires too soon for automatic refresh:`, {
                expiresAt: new Date(tokens.expires_at).toISOString(),
                now: new Date(now).toISOString()
            });
        }
    } catch (error) {
        log.error(`[${serverId}] Error scheduling token refresh:`, error);
    }
}

/**
 * Handle automatic token refresh alarm for a specific server
 * 
 * Called when a token refresh alarm fires. Checks if the server is still enabled,
 * attempts to refresh the token, and schedules the next refresh if successful.
 * 
 * If refresh fails, the server status is updated to 'needs-auth' to prompt
 * the user to re-authenticate.
 * 
 * @param serverId - The unique identifier for the MCP server
 * @param refreshServerToken - The function to call for refreshing tokens (injected to avoid circular dependency)
 */
export async function handleTokenRefreshAlarm(
    serverId: string,
    refreshServerToken: (serverId: string) => Promise<boolean>
): Promise<void> {
    log.info(`[${serverId}] Token refresh alarm fired`);

    try {
        const state = getServerState(serverId);

        // Check if server is still enabled
        if (!state.isEnabled) {
            log.info(`[${serverId}] Server disabled, skipping token refresh`);
            return;
        }

        // Attempt to refresh the token
        const refreshed = await refreshServerToken(serverId);

        if (refreshed && state.tokens) {
            // Schedule the next refresh
            await scheduleTokenRefresh(serverId, state.tokens);
            log.info(`[${serverId}] Token refreshed successfully, next refresh scheduled`);
        } else {
            log.error(`[${serverId}] Token refresh failed during alarm, may require re-authentication`);
            state.status = {
                ...state.status,
                state: 'needs-auth',
                error: 'Automatic token refresh failed. Please re-authenticate.'
            };
            broadcastStatusUpdate(serverId, state.status);
        }
    } catch (error) {
        log.error(`[${serverId}] Error in token refresh alarm:`, error);
    }
}

/**
 * Ensure token is valid and schedule refresh if needed
 * 
 * Checks if stored tokens exist and are valid. If tokens are expired or about to
 * expire, attempts to refresh them. If refresh succeeds, schedules the next
 * automatic refresh.
 * 
 * This function should be called during server initialization to ensure tokens
 * are valid before attempting to connect.
 * 
 * @param serverId - The unique identifier for the MCP server
 * @param refreshServerToken - The function to call for refreshing tokens (injected to avoid circular dependency)
 * @returns True if tokens are valid or were successfully refreshed, false otherwise
 */
export async function ensureTokenValidity(
    serverId: string,
    refreshServerToken: (serverId: string) => Promise<boolean>
): Promise<boolean> {
    try {
        const state = getServerState(serverId);
        const tokens = await getStoredTokens(serverId);

        if (!tokens) {
            log.info(`[${serverId}] No stored tokens found`);
            return false;
        }

        log.info(`[${serverId}] Checking token validity:`, {
            expiresAt: new Date(tokens.expires_at).toISOString(),
            now: new Date().toISOString(),
            isExpired: isTokenExpired(tokens)
        });

        // Check if token is expired or about to expire
        if (isTokenExpired(tokens)) {
            log.info(`[${serverId}] Token expired or expiring soon, attempting refresh`);

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
        log.error(`[${serverId}] Error in ensureTokenValidity:`, error);
        return false;
    }
}

/**
 * Ensure we have a valid access token for a server
 * 
 * Retrieves the access token for a server, loading from storage if not already
 * in memory. If the token is expired, attempts to refresh it automatically.
 * 
 * @param serverId - The unique identifier for the MCP server
 * @param refreshServerToken - The function to call for refreshing tokens (injected to avoid circular dependency)
 * @returns The valid access token, or null if no valid token is available
 */
export async function ensureValidToken(
    serverId: string,
    refreshServerToken: (serverId: string) => Promise<boolean>
): Promise<string | null> {
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

/**
 * Refresh access token for an MCP server with enhanced error handling
 * 
 * Attempts to refresh the access token using the refresh token. Handles various
 * error scenarios including missing refresh tokens, credentials, or endpoints.
 * Falls back to endpoint re-discovery if needed.
 * 
 * On success:
 * - Validates token audience for security
 * - Updates granted scopes
 * - Stores new tokens
 * - Schedules next automatic refresh
 * 
 * On failure:
 * - Clears invalid tokens
 * - Updates server status to 'needs-auth'
 * - Provides user-friendly error messages
 * 
 * @param serverId - The unique identifier for the MCP server
 * @returns True if refresh succeeded, false otherwise
 */
export async function refreshServerToken(serverId: string): Promise<boolean> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    if (!state.tokens?.refresh_token) {
        log.error(`[${serverId}] No refresh token available`);
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
        log.info(`[${serverId}] Loaded client credentials for token refresh`);
    }

    if (!state.credentials) {
        log.error(`[${serverId}] No client credentials available for token refresh`);
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
            log.info(`[${serverId}] Loaded OAuth endpoints from storage for token refresh`);
        }
    }

    // If still not available, try to re-discover them as a fallback
    if (!state.oauthEndpoints) {
        log.info(`[${serverId}] OAuth endpoints not found in memory or storage, attempting re-discovery...`);

        if (serverConfig?.url) {
            try {
                const discoveredEndpoints = await discoverOAuthEndpoints(serverConfig.url);

                if (discoveredEndpoints) {
                    log.info(`[${serverId}] Successfully re-discovered OAuth endpoints`);
                    state.oauthEndpoints = discoveredEndpoints;

                    // Persist the re-discovered endpoints for future use
                    await storeOAuthEndpoints(serverId, discoveredEndpoints);
                } else {
                    log.error(`[${serverId}] OAuth endpoint re-discovery failed`);
                }
            } catch (discoveryError) {
                log.error(`[${serverId}] Error during OAuth endpoint re-discovery:`, discoveryError);
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
        log.error(`[${serverId}] No OAuth endpoints available after all attempts (memory, storage, and re-discovery)`);
        const error = MCPError.authFailed(
            serverId,
            'OAuth endpoints unavailable. Re-authentication required.'
        );
        state.status = { ...state.status, state: 'needs-auth', error: buildUserMessage(error) };
        broadcastStatusUpdate(serverId, state.status);
        return false;
    }

    try {
        log.info(`[${serverId}] Refreshing token`);
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

        log.info(`[${serverId}] Token refreshed successfully`);
        return true;
    } catch (error) {
        log.error(`[${serverId}] Token refresh failed:`, error);

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

