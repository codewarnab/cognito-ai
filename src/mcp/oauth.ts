/**
 * OAuth utilities for MCP authentication
 * Implements OAuth 2.0 with Dynamic Client Registration (RFC 7591)
 * Supports multiple MCP servers with independent credentials
 */

import type { McpOAuthTokens } from './types';

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

    console.log(`[OAuth:${serverId}] Registering dynamic client with payload:`, registrationPayload);

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

    console.log(`[OAuth:${serverId}] Client registered successfully:`, {
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
    console.log(`[OAuth:${serverId}] Built authorization URL (scopes: ${scopes?.join(' ') || 'none'})`);
    
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
    
    console.log(`[OAuth:${serverId}] Exchange code for tokens with client:`, clientId);
    
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

    console.log(`[OAuth:${serverId}] Exchange code for tokens body (urlencoded):`, params.toString());
    console.log(`[OAuth:${serverId}] Exchange code for tokens URL:`, tokenEndpoint);

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
    serverId: string,
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
    console.log(`[OAuth:${serverId}] Tokens stored`);
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
    console.log(`[OAuth:${serverId}] Tokens cleared`);
}

/**
 * Store dynamic client credentials in chrome.storage.local
 */
export async function storeClientCredentials(serverId: string, credentials: DynamicClientCredentials): Promise<void> {
    const key = getClientCredentialsKey(serverId);
    await chrome.storage.local.set({ [key]: credentials });
    console.log(`[OAuth:${serverId}] Client credentials stored`);
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
    console.log(`[OAuth:${serverId}] Client credentials cleared`);
}

export {
    generateState,
    createCodeVerifier,
    createCodeChallenge,
};
