/**
 * OAuth Discovery Module for MCP Servers
 * Implements RFC 9728 (Protected Resource Metadata) and RFC 8414 (Authorization Server Metadata)
 */

import type {
    ProtectedResourceMetadata,
    AuthorizationServerMetadata,
    ScopeChallenge,
    OAuthEndpoints
} from './types';

const DISCOVERY_TIMEOUT = 10000; // 10 seconds

/**
 * Parse WWW-Authenticate header for Bearer challenges
 * Extracts scope, error, error_description, and resource_metadata
 */
export function parseScopeChallenge(wwwAuthHeader: string): ScopeChallenge | null {
    if (!wwwAuthHeader || !wwwAuthHeader.toLowerCase().startsWith('bearer ')) {
        return null;
    }

    const challenge: ScopeChallenge = {};
    
    // Remove "Bearer " prefix
    const params = wwwAuthHeader.substring(7);
    
    // Parse key=value pairs, handling quoted values
    const regex = /(\w+)=(?:"([^"]*)"|([^\s,]*))/g;
    let match;
    
    while ((match = regex.exec(params)) !== null) {
        const key = match[1];
        const value = match[2] || match[3];
        
        if (key === 'scope') {
            challenge.scope = value;
        } else if (key === 'error') {
            challenge.error = value;
        } else if (key === 'error_description') {
            challenge.error_description = value;
        } else if (key === 'resource_metadata') {
            challenge.resource_metadata = value;
        }
    }
    
    return Object.keys(challenge).length > 0 ? challenge : null;
}

/**
 * Discover Protected Resource Metadata (RFC 9728)
 * Tries multiple discovery methods with graceful 404 handling
 */
export async function discoverProtectedResourceMetadata(
    mcpUrl: string
): Promise<ProtectedResourceMetadata | null> {
    const url = new URL(mcpUrl);
    
    console.log(`[Discovery] Starting Protected Resource Metadata discovery for ${mcpUrl}`);
    
    // Method 1: Try to get WWW-Authenticate header from 401 response
    try {
        console.log(`[Discovery] Method 1: Attempting GET ${mcpUrl} for WWW-Authenticate header`);
        const response = await fetch(mcpUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(DISCOVERY_TIMEOUT)
        });
        
        if (response.status === 401) {
            const wwwAuth = response.headers.get('WWW-Authenticate');
            if (wwwAuth) {
                const challenge = parseScopeChallenge(wwwAuth);
                if (challenge?.resource_metadata) {
                    console.log(`[Discovery] Found resource_metadata URL in WWW-Authenticate: ${challenge.resource_metadata}`);
                    const metadata = await fetchProtectedResourceMetadata(challenge.resource_metadata);
                    if (metadata) return metadata;
                }
            }
        }
    } catch (error) {
        console.log(`[Discovery] Method 1 failed (expected):`, error instanceof Error ? error.message : 'unknown');
    }
    
    // Method 2: Try /.well-known/oauth-protected-resource/{path}
    if (url.pathname && url.pathname !== '/') {
        const wellKnownUrl = `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`;
        console.log(`[Discovery] Method 2: Trying ${wellKnownUrl}`);
        const metadata = await fetchProtectedResourceMetadata(wellKnownUrl);
        if (metadata) return metadata;
    }
    
    // Method 3: Try /.well-known/oauth-protected-resource (root)
    const rootWellKnownUrl = `${url.origin}/.well-known/oauth-protected-resource`;
    console.log(`[Discovery] Method 3: Trying ${rootWellKnownUrl}`);
    const metadata = await fetchProtectedResourceMetadata(rootWellKnownUrl);
    if (metadata) return metadata;
    
    console.log(`[Discovery] Protected Resource Metadata not found for ${mcpUrl}`);
    return null;
}

/**
 * Fetch Protected Resource Metadata from a URL
 */
async function fetchProtectedResourceMetadata(url: string): Promise<ProtectedResourceMetadata | null> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(DISCOVERY_TIMEOUT)
        });
        
        if (response.status === 404) {
            console.log(`[Discovery] 404 Not Found: ${url} (gracefully continuing)`);
            return null;
        }
        
        if (!response.ok) {
            console.warn(`[Discovery] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            return null;
        }
        
        const metadata: ProtectedResourceMetadata = await response.json();
        
        // Validate required fields
        if (!metadata.authorization_servers || !Array.isArray(metadata.authorization_servers)) {
            console.warn(`[Discovery] Invalid metadata from ${url}: missing authorization_servers`);
            return null;
        }
        
        console.log(`[Discovery] Successfully discovered Protected Resource Metadata from ${url}`);
        return metadata;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.warn(`[Discovery] Timeout fetching ${url}`);
        } else {
            console.log(`[Discovery] Error fetching ${url}:`, error instanceof Error ? error.message : 'unknown');
        }
        return null;
    }
}

/**
 * Discover Authorization Server Metadata (RFC 8414 + OpenID Connect Discovery)
 * Tries multiple well-known endpoints with graceful 404 handling
 */
export async function discoverAuthorizationServerMetadata(
    issuerUrl: string
): Promise<AuthorizationServerMetadata | null> {
    const url = new URL(issuerUrl);
    const hasPath = url.pathname && url.pathname !== '/';
    
    console.log(`[Discovery] Starting Authorization Server Metadata discovery for ${issuerUrl}`);
    
    const endpoints: string[] = [];
    
    if (hasPath) {
        // For URLs with path components (e.g., https://auth.example.com/tenant1)
        const pathComponent = url.pathname;
        
        // Try OAuth 2.0 Authorization Server Metadata with path insertion
        endpoints.push(`${url.origin}/.well-known/oauth-authorization-server${pathComponent}`);
        
        // Try OpenID Connect Discovery with path insertion
        endpoints.push(`${url.origin}/.well-known/openid-configuration${pathComponent}`);
        
        // Try OpenID Connect Discovery path appending
        endpoints.push(`${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`);
    } else {
        // For URLs without path components (e.g., https://auth.example.com)
        // Try OAuth 2.0 Authorization Server Metadata
        endpoints.push(`${url.origin}/.well-known/oauth-authorization-server`);
        
        // Try OpenID Connect Discovery
        endpoints.push(`${url.origin}/.well-known/openid-configuration`);
    }
    
    // Try each endpoint in order
    for (const endpoint of endpoints) {
        console.log(`[Discovery] Trying ${endpoint}`);
        const metadata = await fetchAuthorizationServerMetadata(endpoint);
        
        if (metadata) {
            // Verify PKCE support as required by MCP spec
            if (!metadata.code_challenge_methods_supported || 
                metadata.code_challenge_methods_supported.length === 0) {
                console.warn(`[Discovery] Authorization server at ${endpoint} does not support PKCE (required by MCP spec)`);
                console.warn(`[Discovery] Missing code_challenge_methods_supported field`);
                // Continue to try other endpoints
                continue;
            }
            
            return metadata;
        }
    }
    
    console.log(`[Discovery] Authorization Server Metadata not found for ${issuerUrl}`);
    return null;
}

/**
 * Fetch Authorization Server Metadata from a URL
 */
async function fetchAuthorizationServerMetadata(url: string): Promise<AuthorizationServerMetadata | null> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(DISCOVERY_TIMEOUT)
        });
        
        if (response.status === 404) {
            console.log(`[Discovery] 404 Not Found: ${url} (trying next method)`);
            return null;
        }
        
        if (!response.ok) {
            console.warn(`[Discovery] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            return null;
        }
        
        const metadata: AuthorizationServerMetadata = await response.json();
        
        // Validate required fields per RFC 8414
        if (!metadata.issuer || !metadata.authorization_endpoint || !metadata.token_endpoint) {
            console.warn(`[Discovery] Invalid metadata from ${url}: missing required fields`);
            return null;
        }
        
        console.log(`[Discovery] Successfully discovered Authorization Server Metadata from ${url}`);
        console.log(`[Discovery] - Authorization endpoint: ${metadata.authorization_endpoint}`);
        console.log(`[Discovery] - Token endpoint: ${metadata.token_endpoint}`);
        console.log(`[Discovery] - Registration endpoint: ${metadata.registration_endpoint || 'not provided'}`);
        console.log(`[Discovery] - PKCE support: ${metadata.code_challenge_methods_supported?.join(', ') || 'none'}`);
        
        return metadata;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.warn(`[Discovery] Timeout fetching ${url}`);
        } else {
            console.log(`[Discovery] Error fetching ${url}:`, error instanceof Error ? error.message : 'unknown');
        }
        return null;
    }
}

/**
 * Complete OAuth discovery flow for an MCP server
 * Returns consolidated OAuth endpoints or null if discovery fails
 */
export async function discoverOAuthEndpoints(
    mcpUrl: string
): Promise<OAuthEndpoints | null> {
    console.log(`[Discovery] Starting full OAuth discovery for ${mcpUrl}`);
    
    // Step 1: Discover Protected Resource Metadata
    const resourceMetadata = await discoverProtectedResourceMetadata(mcpUrl);
    
    if (!resourceMetadata || !resourceMetadata.authorization_servers || 
        resourceMetadata.authorization_servers.length === 0) {
        console.log(`[Discovery] No authorization servers found for ${mcpUrl}`);
        return null;
    }
    
    // Step 2: Try each authorization server until one works
    for (const authServerUrl of resourceMetadata.authorization_servers) {
        console.log(`[Discovery] Attempting authorization server: ${authServerUrl}`);
        const authMetadata = await discoverAuthorizationServerMetadata(authServerUrl);
        
        if (authMetadata) {
            // Success! Consolidate into OAuthEndpoints
            const endpoints: OAuthEndpoints = {
                authorization_endpoint: authMetadata.authorization_endpoint,
                token_endpoint: authMetadata.token_endpoint,
                registration_endpoint: authMetadata.registration_endpoint,
                introspection_endpoint: authMetadata.introspection_endpoint,
                revocation_endpoint: authMetadata.revocation_endpoint,
                scopes_supported: resourceMetadata.scopes_supported || authMetadata.scopes_supported,
                resource: resourceMetadata.resource
            };
            
            console.log(`[Discovery] Successfully discovered OAuth endpoints for ${mcpUrl}`);
            return endpoints;
        }
    }
    
    console.log(`[Discovery] Failed to discover OAuth endpoints for ${mcpUrl}`);
    return null;
}

