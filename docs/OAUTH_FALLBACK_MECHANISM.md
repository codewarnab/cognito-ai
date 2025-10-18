# OAuth Fallback Mechanism Implementation

## Overview

This document describes the fallback mechanism implemented for OAuth 2.0 endpoint discovery when Authorization Server Metadata is not available.

## Background

Per the OAuth 2.0 specification, servers that do not implement OAuth 2.0 Authorization Server Metadata discovery **MUST** use the following default endpoint paths relative to the authorization base URL:

| Endpoint | Default Path | Description |
|----------|-------------|-------------|
| Authorization Endpoint | `/authorize` | Used for authorization requests |
| Token Endpoint | `/token` | Used for token exchange & refresh |
| Registration Endpoint | `/register` | Used for dynamic client registration |

## Implementation

### Discovery Flow

The OAuth discovery process now follows this enhanced flow:

1. **Primary Discovery**: Attempt to discover Protected Resource Metadata
   - Try WWW-Authenticate header
   - Try `.well-known/oauth-protected-resource/{path}`
   - Try `.well-known/oauth-protected-resource` (root)

2. **Authorization Server Discovery**: If resource metadata found, try each authorization server
   - Try OAuth 2.0 Authorization Server Metadata endpoints
   - Try OpenID Connect Discovery endpoints

3. **First Fallback**: If no resource metadata found
   - Use the MCP URL as the authorization base URL
   - Construct default endpoints: `/authorize`, `/token`, `/register`
   - Validate endpoints exist (not 404/500)

4. **Second Fallback**: If resource metadata found but all authorization servers failed
   - Use the first authorization server URL from resource metadata
   - Construct default endpoints
   - Validate endpoints exist
   - Include resource and scopes metadata if available

### Functions Added

#### `createFallbackEndpoints(authorizationBaseUrl: string): OAuthEndpoints`

Creates OAuth endpoints using default paths from a base URL.

**Parameters:**
- `authorizationBaseUrl`: The base URL for the authorization server

**Returns:**
- `OAuthEndpoints` object with:
  - `authorization_endpoint`: `{base}/authorize`
  - `token_endpoint`: `{base}/token`
  - `registration_endpoint`: `{base}/register`

#### `validateFallbackEndpoints(endpoints: OAuthEndpoints): Promise<boolean>`

Validates that fallback endpoints actually exist by making HEAD requests.

**Validation Logic:**
- Checks authorization endpoint (expects non-404, non-500)
- Checks token endpoint (expects non-404, non-500)
- Optionally checks registration endpoint
- Returns `true` if at least one required endpoint (auth or token) is valid

**Timeout:** 5 seconds per endpoint

## Example Scenarios

### Scenario 1: No Metadata Available

```
MCP URL: https://api.example.com/v1/mcp
No metadata found
→ Fallback to: https://api.example.com/v1/mcp
→ Endpoints:
  - https://api.example.com/v1/mcp/authorize
  - https://api.example.com/v1/mcp/token
  - https://api.example.com/v1/mcp/register
```

### Scenario 2: Metadata Found But Authorization Server Discovery Failed

```
MCP URL: https://api.example.com/v1/mcp
Resource metadata found:
  authorization_servers: ["https://auth.example.com"]
Authorization server metadata discovery failed
→ Fallback to: https://auth.example.com
→ Endpoints:
  - https://auth.example.com/authorize
  - https://auth.example.com/token
  - https://auth.example.com/register
```

## Benefits

1. **Robustness**: Works with servers that don't implement metadata discovery
2. **Standards Compliance**: Follows OAuth 2.0 fallback specification
3. **Validation**: Verifies endpoints exist before returning them
4. **Graceful Degradation**: Attempts discovery first, falls back only when necessary
5. **Logging**: Comprehensive logging for debugging

## Usage

The fallback mechanism is automatically used by the `discoverOAuthEndpoints()` function. No changes needed in calling code:

```typescript
const endpoints = await discoverOAuthEndpoints(mcpUrl);
if (endpoints) {
  // Use endpoints for OAuth flow
}
```

## Testing Recommendations

To test the fallback mechanism:

1. Test with a server that has no metadata endpoints (should use MCP URL as base)
2. Test with a server that has resource metadata but broken auth server (should use auth server URL as base)
3. Test with non-existent endpoints (validation should fail, return null)
4. Test with proper metadata (should not use fallback)

## Related Files

- `src/mcp/discovery.ts` - Main implementation
- `src/mcp/types.ts` - Type definitions for OAuthEndpoints
- `docs/MCP_INTEGRATION_SUMMARY.md` - Overall MCP integration overview
