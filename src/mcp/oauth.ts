/**
 * OAuth utilities for Notion MCP authentication
 * Implements OAuth 2.0 PKCE (Proof Key for Code Exchange) flow
 * for Notion's hosted MCP server (no client secret)
 */

import { NOTION_CONFIG } from '../constants';
import type { NotionOAuthTokens } from './types';

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
 * Build Notion MCP OAuth authorization URL with PKCE
 */
async function buildAuthUrl(state: string, codeVerifier: string): Promise<string> {
    const codeChallenge = await createCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: NOTION_CONFIG.OAUTH_CLIENT_ID,
        redirect_uri: NOTION_CONFIG.OAUTH_REDIRECT_URI,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        resource: NOTION_CONFIG.MCP_RESOURCE,
        state: state
    });

    return `${NOTION_CONFIG.OAUTH_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens using PKCE
 * No client secret required - uses code_verifier instead
 */
async function exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri?: string
): Promise<NotionOAuthTokens> {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: NOTION_CONFIG.OAUTH_CLIENT_ID,
        code_verifier: codeVerifier
    });

    // Include redirect_uri if provided
    if (redirectUri) {
        params.append('redirect_uri', redirectUri);
    }

    const response = await fetch(NOTION_CONFIG.OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
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

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token, // May be undefined for MCP
        token_type: data.token_type || 'Bearer',
        expires_at: expiresAt,
        workspace_id: data.workspace_id,
        workspace_name: data.workspace_name,
        workspace_icon: data.workspace_icon,
        owner: data.owner,
        bot_id: data.bot_id,
        duplicated_template_id: data.duplicated_template_id,
        created_at: Date.now()
    };
}

/**
 * Refresh access token using refresh token
 * NOTE: Notion MCP may not support refresh tokens.
 * If refresh fails, the user will need to re-authenticate.
 */
async function refreshAccessToken(refreshToken: string): Promise<NotionOAuthTokens> {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: NOTION_CONFIG.OAUTH_CLIENT_ID
    });

    const response = await fetch(NOTION_CONFIG.OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${error}`);
    }

    const data = await response.json();

    const expiresIn = data.expires_in || 3600;
    const expiresAt = Date.now() + (expiresIn * 1000);

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken, // Keep old refresh token if not provided
        token_type: data.token_type || 'Bearer',
        expires_at: expiresAt,
        workspace_id: data.workspace_id,
        workspace_name: data.workspace_name,
        workspace_icon: data.workspace_icon,
        owner: data.owner,
        created_at: Date.now()
    };
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 */
function isTokenExpired(tokens: NotionOAuthTokens): boolean {
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return tokens.expires_at <= (now + bufferTime);
}

/**
 * Store tokens in chrome.storage.local
 */
async function storeTokens(tokens: NotionOAuthTokens): Promise<void> {
    await chrome.storage.local.set({
        [`${NOTION_CONFIG.STORAGE_KEY_PREFIX}.tokens`]: tokens
    });
}

/**
 * Retrieve tokens from chrome.storage.local
 */
async function getStoredTokens(): Promise<NotionOAuthTokens | null> {
    const result = await chrome.storage.local.get(`${NOTION_CONFIG.STORAGE_KEY_PREFIX}.tokens`);
    return result[`${NOTION_CONFIG.STORAGE_KEY_PREFIX}.tokens`] || null;
}

/**
 * Clear stored tokens
 */
async function clearTokens(): Promise<void> {
    await chrome.storage.local.remove(`${NOTION_CONFIG.STORAGE_KEY_PREFIX}.tokens`);
}

export {
    generateState,
    createCodeVerifier,
    createCodeChallenge,
    buildAuthUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    isTokenExpired,
    storeTokens,
    getStoredTokens,
    clearTokens
};
