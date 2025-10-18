# Discovery Hints Issue - Specification Violation Analysis

## Problem Summary

The current implementation uses **hardcoded OAuth discovery hints** that bypass the proper MCP specification metadata discovery process defined in [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) (OAuth 2.0 Protected Resource Metadata) and [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) (Authorization Server Metadata).

## Current Implementation (Non-Compliant)

### File: `src/background.ts` (lines 266-284)

```typescript
// Check if we have discovery hints in server config
const specificConfig = SERVER_SPECIFIC_CONFIGS[serverId];
const hints = serverConfig.oauth?.discoveryHints || specificConfig?.discoveryHints;

if (hints?.registrationEndpoint && hints?.authorizationEndpoint && hints?.tokenEndpoint) {
    console.log(`[Background:${serverId}] Using discovery hints from config`);
    endpoints = {
        authorization_endpoint: hints.authorizationEndpoint,
        token_endpoint: hints.tokenEndpoint,
        registration_endpoint: hints.registrationEndpoint,
        resource: serverConfig.oauth?.resource
    };
} else if (!endpoints) {
    // Perform full OAuth discovery
    console.log(`[Background:${serverId}] Performing OAuth discovery...`);
    endpoints = await discoverOAuthEndpoints(serverConfig.url);
}
```

### File: `src/constants.ts` (lines 53-64)

```typescript
export const SERVER_SPECIFIC_CONFIGS: Record<string, {
    customHeaders?: Record<string, string>;
    discoveryHints?: {
        registrationEndpoint?: string;
        authorizationEndpoint?: string;
        tokenEndpoint?: string;
    };
}> = {
    notion: {
        // Notion-specific HTTP headers
        customHeaders: {
            'Notion-Version': '2022-06-28'
        },
        // Optional: Provide hints to skip discovery (faster connection)
        discoveryHints: {
            registrationEndpoint: "https://mcp.notion.com/register",
            authorizationEndpoint: "https://mcp.notion.com/authorize",
            tokenEndpoint: "https://mcp.notion.com/token"
        }
    }
};
```

## Why This Violates the MCP Specification

### Required Discovery Flow per MCP Spec (§2.3 Authorization Server Discovery)

The specification defines a **mandatory multi-step discovery process**:

#### Step 1: Protected Resource Metadata Discovery (RFC 9728)

MCP servers MUST advertise their authorization servers via Protected Resource Metadata. Clients MUST fetch this using **one of two methods**:

**Method A - WWW-Authenticate Header:**
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource",
                         scope="files:read"
```

**Method B - Well-Known Endpoints (RFC 9728 §7.1):**
- Primary: `https://server/{path}/.well-known/oauth-protected-resource/{path}`
- Fallback: `https://server/.well-known/oauth-protected-resource`

**What we're missing:** The hardcoded hints skip this entirely.

#### Step 2: Authorization Server Metadata Discovery (RFC 8414 + OpenID Connect)

Once authorization servers are identified from Protected Resource Metadata, clients MUST discover their metadata by trying multiple well-known endpoints:

**For URLs with paths** (e.g., `https://auth.example.com/tenant1`):
1. `https://auth.example.com/.well-known/oauth-authorization-server/tenant1`
2. `https://auth.example.com/.well-known/openid-configuration/tenant1`
3. `https://auth.example.com/tenant1/.well-known/openid-configuration`

**For URLs without paths** (e.g., `https://auth.example.com`):
1. `https://auth.example.com/.well-known/oauth-authorization-server`
2. `https://auth.example.com/.well-known/openid-configuration`

**Critical requirement:** Must verify PKCE support (spec §3.4):
```typescript
if (!metadata.code_challenge_methods_supported || 
    metadata.code_challenge_methods_supported.length === 0) {
    // Must refuse to proceed
    throw new Error('Server does not support PKCE');
}
```

**What we're missing:** No PKCE validation when using hardcoded hints.

#### Step 3: Endpoint Consolidation

Only after successful discovery should endpoints be used, with full metadata including:
- Scopes supported (`scopes_supported`)
- Scope challenge requirements (from WWW-Authenticate)
- PKCE support verification
- Revocation/introspection endpoints

**What we're missing:** None of this metadata information is available in hardcoded hints.

### Specification References

Per [MCP Authorization §2.2 Overview](https://modelcontextprotocol.io/specification/draft/basic/authorization#heading-22-overview):

> 3. MCP servers MUST implement OAuth 2.0 Protected Resource Metadata ([RFC9728](https://datatracker.ietf.org/doc/html/rfc9728)). **MCP clients MUST use OAuth 2.0 Protected Resource Metadata for authorization server discovery.**
>
> 4. MCP authorization servers MUST provide at least one of the following discovery mechanisms:
>    - OAuth 2.0 Authorization Server Metadata ([RFC8414](https://datatracker.ietf.org/doc/html/rfc8414))
>    - OpenID Connect Discovery 1.0
>
> **MCP clients MUST support both discovery mechanisms** to obtain the information required to interact with the authorization server.

## Problems with Hardcoded Hints

### 1. **Specification Non-Compliance**
- ❌ Bypasses required Protected Resource Metadata discovery
- ❌ Bypasses required Authorization Server Metadata discovery  
- ❌ Skips PKCE support verification (§3.4 requirement)
- ❌ Misses scope challenge information (RFC 6750)

### 2. **Loss of Critical Metadata**
The discovery flow provides important information:
```typescript
// Discovery provides:
{
    authorization_endpoint: "...",
    token_endpoint: "...",
    registration_endpoint: "...",
    scopes_supported: ["scope1", "scope2"],  // ← Not available in hints!
    code_challenge_methods_supported: ["S256"],  // ← Not available in hints!
    issuer: "...",
    introspection_endpoint: "...",
    revocation_endpoint: "..."
}
```

### 3. **Not Scalable**
- Requires manual configuration for every MCP server
- Doesn't support dynamic server discovery
- Breaks for servers not in the hardcoded list

### 4. **Not Maintainable**
- If endpoints change, code must be updated
- No way to notify clients of endpoint changes
- Fragile - breaks if server configuration changes

### 5. **No Scope Handling**
- Can't parse scope requirements from 401 responses
- Can't handle scope challenges during runtime
- Fails scope selection strategy (spec §2.4.1)

### 6. **Security Issues**
- No PKCE verification leaves the client vulnerable
- Can't validate if server supports required security features
- No audience validation metadata

## Correct Implementation (from discovery.ts)

The codebase **already has the correct implementation**:

```typescript
// File: src/mcp/discovery.ts (lines 261-310)
export async function discoverOAuthEndpoints(mcpUrl: string): Promise<OAuthEndpoints | null> {
    // Step 1: Discover Protected Resource Metadata (RFC 9728)
    const resourceMetadata = await discoverProtectedResourceMetadata(mcpUrl);
    
    if (!resourceMetadata || !resourceMetadata.authorization_servers || 
        resourceMetadata.authorization_servers.length === 0) {
        console.log(`[Discovery] No authorization servers found for ${mcpUrl}`);
        return null;
    }
    
    // Step 2: Discover each authorization server's metadata (RFC 8414)
    for (const authServerUrl of resourceMetadata.authorization_servers) {
        console.log(`[Discovery] Attempting authorization server: ${authServerUrl}`);
        const authMetadata = await discoverAuthorizationServerMetadata(authServerUrl);
        
        if (authMetadata) {
            // Includes PKCE verification and scope information
            return endpoints; // With full metadata
        }
    }
}
```

This function:
- ✅ Performs Protected Resource Metadata discovery
- ✅ Performs Authorization Server Metadata discovery
- ✅ Verifies PKCE support
- ✅ Returns consolidated endpoints with metadata
- ✅ Implements spec-compliant scope handling

## Recommended Fix

### Option 1: Remove Hardcoded Hints (Recommended - Fully Spec Compliant)

**In `src/background.ts` (lines 260-285):**

```typescript
// Replace this:
let endpoints: OAuthEndpoints | null = state.oauthEndpoints;

const specificConfig = SERVER_SPECIFIC_CONFIGS[serverId];
const hints = serverConfig.oauth?.discoveryHints || specificConfig?.discoveryHints;

if (hints?.registrationEndpoint && hints?.authorizationEndpoint && hints?.tokenEndpoint) {
    // ... use hardcoded hints
} else if (!endpoints) {
    // ... do discovery
}

// With this:
let endpoints: OAuthEndpoints | null = state.oauthEndpoints;

if (!endpoints) {
    // Always perform spec-compliant OAuth discovery (RFC 9728 + RFC 8414)
    console.log(`[Background:${serverId}] Performing OAuth discovery...`);
    state.status = { ...state.status, state: 'connecting' };
    broadcastStatusUpdate(serverId, state.status);
    
    endpoints = await discoverOAuthEndpoints(serverConfig.url);

    if (!endpoints) {
        throw new Error('OAuth discovery failed. Server may not support OAuth or endpoints are not discoverable.');
    }

    // Cache discovered endpoints
    state.oauthEndpoints = endpoints;
}
```

**In `src/constants.ts` (lines 53-64):**

```typescript
// Remove discoveryHints entirely
export const SERVER_SPECIFIC_CONFIGS: Record<string, {
    customHeaders?: Record<string, string>;
}> = {
    notion: {
        customHeaders: {
            'Notion-Version': '2022-06-28'
        }
        // Remove discoveryHints - use proper discovery instead
    }
};
```

**Benefits:**
- ✅ Full MCP specification compliance
- ✅ Proper PKCE verification
- ✅ Dynamic server support
- ✅ Scope metadata available
- ✅ Automatically handles endpoint changes
- ✅ Works with any MCP server

### Option 2: Use Hints as Cache (Alternative - Hybrid Approach)

Only use hardcoded hints as a **fallback** if discovery fails:

```typescript
let endpoints: OAuthEndpoints | null = state.oauthEndpoints;

if (!endpoints) {
    // Step 1: Try proper discovery first (spec-compliant)
    console.log(`[Background:${serverId}] Performing OAuth discovery...`);
    endpoints = await discoverOAuthEndpoints(serverConfig.url);
    
    // Step 2: If discovery fails, fall back to hints (emergency only)
    if (!endpoints) {
        const specificConfig = SERVER_SPECIFIC_CONFIGS[serverId];
        const hints = specificConfig?.discoveryHints;
        
        if (hints?.registrationEndpoint && hints?.authorizationEndpoint && hints?.tokenEndpoint) {
            console.warn(`[Background:${serverId}] Discovery failed, using fallback hints`);
            endpoints = {
                authorization_endpoint: hints.authorizationEndpoint,
                token_endpoint: hints.tokenEndpoint,
                registration_endpoint: hints.registrationEndpoint,
                resource: serverConfig.oauth?.resource
            };
        } else {
            throw new Error('OAuth discovery failed and no fallback hints available');
        }
    }
    
    state.oauthEndpoints = endpoints;
}
```

**Benefits:**
- Spec-compliant by default
- Resilient fallback for offline/testing
- Maintains backward compatibility

## Impact Assessment

| Aspect | Current | Recommended |
|--------|---------|-------------|
| Spec Compliance | ❌ No | ✅ Yes |
| PKCE Verification | ❌ No | ✅ Yes |
| Scope Metadata | ❌ No | ✅ Yes |
| Dynamic Servers | ❌ No | ✅ Yes |
| Scalability | ❌ No | ✅ Yes |
| Maintainability | ❌ No | ✅ Yes |
| Performance | ✅ Fast | ⚠️ Slightly slower (cached) |

## References

- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [RFC 9728 - OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8414 - Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 6750 - OAuth 2.0 Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)
- [RFC 8707 - Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707)
- Existing implementation: `src/mcp/discovery.ts`
