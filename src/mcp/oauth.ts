/**
 * OAuth utilities for MCP authentication
 * Implements OAuth 2.0 with Dynamic Client Registration (RFC 7591)
 * Supports multiple MCP servers with independent credentials
 */

import type { McpOAuthTokens, OAuthStateRecord } from './types';
import { createLogger } from '../logger';

const authLog = createLogger('MCP-OAuth', 'MCP_AUTH');

/**
 * Dynamic client credentials from registration
 */
export interface DynamicClientCredentials {
    serverId: string; // Server this client is registered for
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    client_name: string;
    grant_types: string[];
    response_types: string[];
    token_endpoint_auth_method: string;
    registration_client_uri?: string;
    client_id_issued_at?: number;
    created_at: number;
}

/**
 * Register a dynamic client with MCP OAuth server
 * This is called before starting the OAuth flow
 */
export async function registerDynamicClient(
    serverId: string,
    registrationUrl: string,
    redirectUri: string,
    serverName: string,
    scopes?: string[]
): Promise<DynamicClientCredentials> {
    const registrationPayload = {
        client_name: `Chrome AI Extension - ${serverName}`,
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        // Only include scope if scopes are provided and non-empty
        ...(scopes && scopes.length > 0 ? { scope: scopes.join(' ') } : {}),
        token_endpoint_auth_method: "client_secret_basic"
    };

    authLog.info(`[${serverId}] Registering dynamic client with payload:`, registrationPayload);

    const response = await fetch(registrationUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(registrationPayload)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Client registration failed: ${response.status} ${error}`);
    }

    const data = await response.json();

    authLog.info(`[${serverId}] Client registered successfully:`, {
        client_id: data.client_id,
        redirect_uris: data.redirect_uris
    });

    return {
        serverId,
        client_id: data.client_id,
        client_secret: data.client_secret,
        redirect_uris: data.redirect_uris,
        client_name: data.client_name,
        grant_types: data.grant_types,
        response_types: data.response_types,
        token_endpoint_auth_method: data.token_endpoint_auth_method,
        registration_client_uri: data.registration_client_uri,
        client_id_issued_at: data.client_id_issued_at,
        created_at: Date.now()
    };
}

/**
 * Generate a random string for state parameter (CSRF protection)
 */
function generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate state parameter for CSRF protection
 */
function generateState(): string {
    return generateRandomString(16);
}

/**
 * Create a code verifier for PKCE (43-128 characters, base64url)
 */
function createCodeVerifier(): string {
    const array = new Uint8Array(32); // 32 bytes = 43 chars in base64url
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
}

/**
 * Create a code challenge from a verifier (SHA-256 hash, base64url encoded)
 */
async function createCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Base64URL encode (without padding)
 */
function base64UrlEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Build OAuth authorization URL
 */
export function buildAuthUrl(
    serverId: string,
    authEndpoint: string,
    clientId: string,
    redirectUri: string,
    state: string,
    scopes?: string[],
    resource?: string
): string {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        state: state
    });

    // Add scopes if provided
    if (scopes && scopes.length > 0) {
        params.append('scope', scopes.join(' '));
    }

    // Add resource parameter if provided (RFC 8707)
    if (resource) {
        params.append('resource', resource);
    }

    // Notion-specific: add owner parameter
    if (serverId === 'notion') {
        params.append('owner', 'user');
    }

    const url = `${authEndpoint}?${params.toString()}`;
    authLog.info(`[${serverId}] Built authorization URL (scopes: ${scopes?.join(' ') || 'none'})`);

    return url;
}

/**
 * Exchange authorization code for tokens using dynamic client credentials
 */
export async function exchangeCodeForTokens(
    serverId: string,
    tokenEndpoint: string,
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    resource?: string,
    customHeaders?: Record<string, string>
): Promise<McpOAuthTokens> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    authLog.info(`[${serverId}] Exchange code for tokens with client:`, clientId);

    // Create x-www-form-urlencoded body for OAuth token exchange
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
    });

    // Add resource parameter if provided (RFC 8707)
    if (resource) {
        params.append('resource', resource);
    }

    authLog.info(`[${serverId}] Exchange code for tokens body (urlencoded):`, params.toString());
    authLog.info(`[${serverId}] Exchange code for tokens URL:`, tokenEndpoint);

    const headers: Record<string, string> = {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...customHeaders
    };

    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers,
        body: params.toString()
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Calculate expiration timestamp
    const expiresIn = data.expires_in || 3600; // Default 1 hour if not provided
    const expiresAt = Date.now() + (expiresIn * 1000);

    // Store server-specific metadata as JSON string
    const metadata: Record<string, any> = {};
    const standardFields = ['access_token', 'refresh_token', 'token_type', 'expires_in', 'scope'];

    for (const [key, value] of Object.entries(data)) {
        if (!standardFields.includes(key)) {
            metadata[key] = value;
        }
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type || 'Bearer',
        expires_at: expiresAt,
        scope: data.scope,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined,
        created_at: Date.now()
    };
}

/**
 * Refresh access token using refresh token and dynamic client credentials
 */
export async function refreshAccessToken(
    _serverId: string,
    tokenEndpoint: string,
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    resource?: string,
    customHeaders?: Record<string, string>
): Promise<McpOAuthTokens> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    // Add resource parameter if provided (RFC 8707)
    if (resource) {
        params.append('resource', resource);
    }

    const headers: Record<string, string> = {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...customHeaders
    };

    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers,
        body: params.toString()
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${error}`);
    }

    const data = await response.json();

    const expiresIn = data.expires_in || 3600;
    const expiresAt = Date.now() + (expiresIn * 1000);

    // Store server-specific metadata as JSON string
    const metadata: Record<string, any> = {};
    const standardFields = ['access_token', 'refresh_token', 'token_type', 'expires_in', 'scope'];

    for (const [key, value] of Object.entries(data)) {
        if (!standardFields.includes(key)) {
            metadata[key] = value;
        }
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        token_type: data.token_type || 'Bearer',
        expires_at: expiresAt,
        scope: data.scope,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined,
        created_at: Date.now()
    };
}

/**
 * Validate token audience matches expected MCP server
 * Per MCP spec: Servers MUST NOT accept tokens not issued for them
 * 
 * @param serverId - MCP server ID for logging
 * @param tokens - OAuth tokens to validate
 * @param expectedAudience - Expected audience value (resource URL or audience claim)
 * @returns true if valid, false if invalid
 */
export function validateTokenAudience(
    serverId: string,
    tokens: McpOAuthTokens,
    expectedAudience: string
): boolean {
    // Decode JWT access token (if JWT format)
    try {
        const parts = tokens.access_token.split('.');
        if (parts.length === 3 && parts[1]) {
            // JWT format - decode payload
            const payload = JSON.parse(atob(parts[1]));

            // Check audience claim
            if (payload.aud) {
                const audiences = Array.isArray(payload.aud)
                    ? payload.aud
                    : [payload.aud];

                if (!audiences.includes(expectedAudience)) {
                    authLog.error(`[${serverId}] Token audience mismatch:`, {
                        expected: expectedAudience,
                        actual: payload.aud
                    });
                    return false;
                }
            }

            // Check resource claim (RFC 8707)
            if (payload.resource && payload.resource !== expectedAudience) {
                authLog.error(`[${serverId}] Token resource mismatch:`, {
                    expected: expectedAudience,
                    actual: payload.resource
                });
                return false;
            }

            authLog.info(`[${serverId}] Token audience validated successfully`);
        } else {
            // Opaque token (not JWT) - cannot validate audience client-side
            // Rely on server-side validation
            authLog.warn(`[${serverId}] Cannot validate token audience: not a JWT (opaque token)`);
        }

        return true;
    } catch (error) {
        // Error decoding token - might be opaque or malformed
        // Log warning but allow, relying on server-side validation
        authLog.warn(`[${serverId}] Cannot validate token audience: ${error instanceof Error ? error.message : 'decode error'}`);
        return true; // Allow but log warning
    }
}

/**
 * Check if token is expired or about to expire (within buffer time)
 */
export function isTokenExpired(tokens: McpOAuthTokens, bufferMinutes: number = 5): boolean {
    const now = Date.now();
    const bufferTime = bufferMinutes * 60 * 1000;
    return tokens.expires_at <= (now + bufferTime);
}

/**
 * Get storage key for tokens
 */
function getTokensKey(serverId: string): string {
    return `oauth.${serverId}.tokens`;
}

/**
 * Get storage key for client credentials
 */
function getClientCredentialsKey(serverId: string): string {
    return `oauth.${serverId}.client`;
}

/**
 * Store tokens in chrome.storage.local
 */
export async function storeTokens(serverId: string, tokens: McpOAuthTokens): Promise<void> {
    const key = getTokensKey(serverId);
    await chrome.storage.local.set({ [key]: tokens });
    authLog.info(`[${serverId}] Tokens stored`);
}

/**
 * Retrieve tokens from chrome.storage.local
 */
export async function getStoredTokens(serverId: string): Promise<McpOAuthTokens | null> {
    const key = getTokensKey(serverId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
}

/**
 * Clear stored tokens
 */
export async function clearTokens(serverId: string): Promise<void> {
    const key = getTokensKey(serverId);
    await chrome.storage.local.remove(key);
    authLog.info(`[${serverId}] Tokens cleared`);
}

/**
 * Store dynamic client credentials in chrome.storage.local
 */
export async function storeClientCredentials(serverId: string, credentials: DynamicClientCredentials): Promise<void> {
    const key = getClientCredentialsKey(serverId);
    await chrome.storage.local.set({ [key]: credentials });
    authLog.info(`[${serverId}] Client credentials stored`);
}

/**
 * Retrieve dynamic client credentials from chrome.storage.local
 */
export async function getStoredClientCredentials(serverId: string): Promise<DynamicClientCredentials | null> {
    const key = getClientCredentialsKey(serverId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
}

/**
 * Clear stored client credentials
 */
export async function clearClientCredentials(serverId: string): Promise<void> {
    const key = getClientCredentialsKey(serverId);
    await chrome.storage.local.remove(key);
    authLog.info(`[${serverId}] Client credentials cleared`);
}

/**
 * Get storage key for OAuth endpoints
 */
function getEndpointsKey(serverId: string): string {
    return `mcp.${serverId}.oauth.endpoints`;
}

/**
 * Store OAuth endpoints in chrome.storage.local
 */
export async function storeOAuthEndpoints(serverId: string, endpoints: any): Promise<void> {
    const key = getEndpointsKey(serverId);
    await chrome.storage.local.set({ [key]: endpoints });
    authLog.info(`[${serverId}] OAuth endpoints stored`);
}

/**
 * Retrieve OAuth endpoints from chrome.storage.local
 */
export async function getStoredOAuthEndpoints(serverId: string): Promise<any | null> {
    const key = getEndpointsKey(serverId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
}

/**
 * Clear stored OAuth endpoints
 */
export async function clearOAuthEndpoints(serverId: string): Promise<void> {
    const key = getEndpointsKey(serverId);
    await chrome.storage.local.remove(key);
    authLog.info(`[${serverId}] OAuth endpoints cleared`);
}

export {
    generateState,
    createCodeVerifier,
    createCodeChallenge,
};

/**
 * Phase 3: Enhanced CSRF Protection - Single-Use State Management
 */

/**
 * Store OAuth state in chrome.storage.session with single-use enforcement
 * State expires after 10 minutes
 */
export async function storeOAuthState(
    state: string,
    serverId: string,
    clientId: string
): Promise<void> {
    const stateRecord: OAuthStateRecord = {
        state,
        serverId,
        clientId,
        created_at: Date.now(),
        expires_at: Date.now() + (10 * 60 * 1000), // 10 minutes
        used: false
    };

    await chrome.storage.session.set({
        [`oauth.state.${state}`]: stateRecord
    });

    authLog.info(`[${serverId}] OAuth state stored (expires in 10 minutes)`);
}

/**
 * Validate and consume OAuth state (single-use)
 * Returns true if state is valid and unused, false otherwise
 * Marks state as used if valid
 */
export async function validateAndConsumeState(
    state: string,
    expectedServerId: string
): Promise<{ valid: boolean; error?: string }> {
    const key = `oauth.state.${state}`;
    const result = await chrome.storage.session.get(key);
    const storedState = result[key] as OAuthStateRecord | undefined;

    if (!storedState) {
        authLog.error(`[${expectedServerId}] State validation failed: state not found`);
        return { valid: false, error: 'Invalid state parameter' };
    }

    if (storedState.used) {
        authLog.error(`[${expectedServerId}] State validation failed: state already used`);
        return { valid: false, error: 'State parameter already used - possible replay attack' };
    }

    if (storedState.expires_at < Date.now()) {
        authLog.error(`[${expectedServerId}] State validation failed: state expired`);
        // Clean up expired state
        await chrome.storage.session.remove(key);
        return { valid: false, error: 'State parameter expired' };
    }

    if (storedState.serverId !== expectedServerId) {
        authLog.error(`[${expectedServerId}] State validation failed: serverId mismatch`, {
            expected: expectedServerId,
            actual: storedState.serverId
        });
        return { valid: false, error: 'State parameter serverId mismatch' };
    }

    // Mark state as used
    storedState.used = true;
    await chrome.storage.session.set({ [key]: storedState });

    authLog.info(`[${expectedServerId}] State validated and marked as used`);

    // Schedule cleanup after 1 second
    setTimeout(async () => {
        await chrome.storage.session.remove(key);
        authLog.info(`[${expectedServerId}] Used state cleaned up`);
    }, 1000);

    return { valid: true };
}

/**
 * Clean up expired OAuth states
 * Called periodically by alarm
 */
export async function cleanupExpiredStates(): Promise<void> {
    const allItems = await chrome.storage.session.get();
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, value] of Object.entries(allItems)) {
        if (key.startsWith('oauth.state.')) {
            const state = value as OAuthStateRecord;
            if (state.expires_at < now || state.used) {
                toRemove.push(key);
            }
        }
    }

    if (toRemove.length > 0) {
        await chrome.storage.session.remove(toRemove);
        authLog.info(`Cleaned up ${toRemove.length} expired/used OAuth states`);
    }
}
