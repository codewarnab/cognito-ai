/**
 * OAuth utilities for Notion MCP authentication
 * Implements OAuth 2.0 PKCE (Proof Key for Code Exchange) flow
 * for Notion's hosted MCP server (no client secret)
 */

import { buffer } from 'node:stream/consumers';
import { NOTION_CONFIG } from '../constants';
import type { NotionOAuthTokens } from './types';

/**
 * Dynamic client credentials from registration
 */
interface DynamicClientCredentials {
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
 * Register a dynamic client with Notion MCP OAuth server
 * This is called before starting the OAuth flow
 */
async function registerDynamicClient(redirectUri: string): Promise<DynamicClientCredentials> {
    const registrationPayload = {
        client_name: "Chrome AI Extension - Notion MCP",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "read write",
        token_endpoint_auth_method: "client_secret_basic"
    };

    console.log('[OAuth] Registering dynamic client with payload:', registrationPayload);

    const response = await fetch(NOTION_CONFIG.OAUTH_REGISTER_URL, {
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

    console.log('[OAuth] Client registered successfully:', {
        client_id: data.client_id,
        redirect_uris: data.redirect_uris
    });

    return {
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
 * Build Notion MCP OAuth authorization URL (standard OAuth, no PKCE)
 */
function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        owner: 'user',
        state: state
    });

    return `${NOTION_CONFIG.OAUTH_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens using dynamic client credentials
 */
async function exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
): Promise<NotionOAuthTokens> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    console.log('[OAuth] Exchange code for tokens with client:', clientId);
    
    // Create x-www-form-urlencoded body for OAuth token exchange
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
    });

    console.log('[OAuth] Exchange code for tokens body (urlencoded):', params.toString());
    console.log('[OAuth] Exchange code for tokens URL:', NOTION_CONFIG.OAUTH_TOKEN_URL);

    const response = await fetch(NOTION_CONFIG.OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Notion-Version': '2022-06-28'
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
        refresh_token: data.refresh_token,
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
 * Refresh access token using refresh token and dynamic client credentials
 */
async function refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
): Promise<NotionOAuthTokens> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    const response = await fetch(NOTION_CONFIG.OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Notion-Version': '2022-06-28'
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
        refresh_token: data.refresh_token || refreshToken,
        token_type: data.token_type || 'Bearer',
        expires_at: expiresAt,
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

/**
 * Store dynamic client credentials in chrome.storage.local
 */
async function storeClientCredentials(credentials: DynamicClientCredentials): Promise<void> {
    await chrome.storage.local.set({
        [`${NOTION_CONFIG.STORAGE_KEY_PREFIX}.client`]: credentials
    });
}

/**
 * Retrieve dynamic client credentials from chrome.storage.local
 */
async function getStoredClientCredentials(): Promise<DynamicClientCredentials | null> {
    const result = await chrome.storage.local.get(`${NOTION_CONFIG.STORAGE_KEY_PREFIX}.client`);
    return result[`${NOTION_CONFIG.STORAGE_KEY_PREFIX}.client`] || null;
}

/**
 * Clear stored client credentials
 */
async function clearClientCredentials(): Promise<void> {
    await chrome.storage.local.remove(`${NOTION_CONFIG.STORAGE_KEY_PREFIX}.client`);
}

export {
    registerDynamicClient,
    generateState,
    createCodeVerifier,
    createCodeChallenge,
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
};

export type { DynamicClientCredentials };
