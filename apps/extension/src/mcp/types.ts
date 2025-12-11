/**
 * Type definitions for MCP (Model Context Protocol) integration
 */

/**
 * MCP Server connection states
 */
export type McpConnectionState =
    | 'disconnected'      // Not connected, no auth (ready for servers without auth)
    | 'needs-auth'        // Needs OAuth authentication (for servers requiring auth)
    | 'registering'       // Registering dynamic OAuth client
    | 'authorizing'       // Authorizing with OAuth provider
    | 'authenticated'     // OAuth complete, not connected
    | 'connecting'        // Attempting SSE connection
    | 'connected'         // Fully connected and operational
    | 'error'             // Connection error
    | 'cloudflare-error'  // Cloudflare Worker error (Error 1101)
    | 'token-refresh'     // Refreshing expired token
    | 'invalid-token';    // Token format is invalid, needs re-auth

/**
 * Generic OAuth tokens stored in chrome.storage
 * Compatible with OAuth 2.1 standard
 */
export interface McpOAuthTokens {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_at: number; // Unix timestamp
    scope?: string; // Granted scopes
    created_at: number; // Unix timestamp
    // Server-specific metadata stored as JSON string
    metadata?: string;
}

/**
 * Legacy Notion OAuth tokens (for migration)
 * @deprecated Use McpOAuthTokens instead
 */
export interface NotionOAuthTokens extends McpOAuthTokens {
    bot_id?: string;
    workspace_id?: string;
    workspace_name?: string;
    workspace_icon?: string;
    duplicated_template_id?: string;
    owner?: {
        type: string;
        user?: {
            id: string;
            name?: string;
            avatar_url?: string;
        };
    };
}

/**
 * OAuth state for CSRF protection and PKCE
 * Includes code_verifier for PKCE flow with Notion MCP
 */
export interface OAuthState {
    state: string;
    codeVerifier: string;
    created_at: number;
}

/**
 * MCP Protocol Message Types
 */
export interface McpMessage {
    jsonrpc: '2.0';
    id?: string | number;
    method?: string;
    params?: Record<string, unknown>;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

/**
 * MCP Initialize Request
 */
export interface McpInitializeRequest extends McpMessage {
    method: 'initialize';
    params: {
        protocolVersion: string;
        capabilities: {
            experimental?: Record<string, unknown>;
            roots?: { listChanged?: boolean };
            sampling?: Record<string, unknown>;
        };
        clientInfo: {
            name: string;
            version: string;
        };
    };
}

/**
 * MCP Tool Definition
 */
export interface McpTool {
    name: string;
    description?: string;
    inputSchema: {
        type: 'object';
        properties?: Record<string, unknown>;
        required?: string[];
    };
}

/**
 * MCP Tools List Response
 */
export interface McpToolsListResponse {
    tools: McpTool[];
}

/**
 * MCP Tool Call Request
 */
export interface McpToolCallRequest extends McpMessage {
    method: 'tools/call';
    params: {
        name: string;
        arguments?: Record<string, any>;
    };
}

/**
 * MCP Resource
 */
export interface McpResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

/**
 * MCP Prompt
 */
export interface McpPrompt {
    name: string;
    description?: string;
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}

/**
 * MCP Server Status (generalized)
 */
export interface McpServerStatus {
    serverId: string;
    state: McpConnectionState;
    error?: string;
    lastConnected?: number;
    tools?: McpTool[];
    resources?: McpResource[];
    prompts?: McpPrompt[];
}

/**
 * Legacy Notion MCP Server Status (for backwards compatibility)
 * @deprecated Use McpServerStatus instead
 */
export interface NotionMcpStatus {
    state: McpConnectionState;
    error?: string;
    lastConnected?: number;
    tools?: McpTool[];
    resources?: McpResource[];
    prompts?: McpPrompt[];
}


/**
 * Response from background
 */
export interface NotionMcpResponse {
    success: boolean;
    data?: unknown;
    error?: string;
}

/**
 * Generic extension message type for MCP (replaces Notion-specific)
 */
export type McpExtensionMessageType =
    | `mcp/${string}/auth/start`
    | `mcp/${string}/auth/complete`
    | `mcp/${string}/auth/refresh`
    | `mcp/${string}/enable`
    | `mcp/${string}/disable`
    | `mcp/${string}/disconnect`
    | `mcp/${string}/status/get`
    | `mcp/${string}/status/update`
    | `mcp/${string}/health/check`
    | `mcp/${string}/tool/call`
    | `mcp/${string}/tools/list`
    | `mcp/${string}/resource/read`;

/**
 * Generic extension message structure for MCP
 */
export interface McpExtensionMessage {
    type: McpExtensionMessageType | string;
    payload?: unknown;
}

/**
 * Generic extension response structure for MCP
 */
export interface McpExtensionResponse {
    success: boolean;
    data?: unknown;
    error?: string;
}

/**
 * OAuth endpoints discovered or configured
 */
export interface OAuthEndpoints {
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint?: string;
    introspection_endpoint?: string;
    revocation_endpoint?: string;
    scopes_supported?: string[];
    resource?: string; // RFC 8707 resource parameter
}

/**
 * Protected Resource Metadata (RFC 9728)
 */
export interface ProtectedResourceMetadata {
    resource?: string;
    authorization_servers: string[];
    bearer_methods_supported?: string[];
    resource_signing_alg_values_supported?: string[];
    resource_documentation?: string;
    resource_policy_uri?: string;
    scopes_supported?: string[];
}

/**
 * Authorization Server Metadata (RFC 8414 / OpenID Connect Discovery)
 */
export interface AuthorizationServerMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint?: string;
    jwks_uri?: string;
    scopes_supported?: string[];
    response_types_supported?: string[];
    grant_types_supported?: string[];
    token_endpoint_auth_methods_supported?: string[];
    code_challenge_methods_supported?: string[]; // PKCE support
    introspection_endpoint?: string;
    revocation_endpoint?: string;
}

/**
 * Scope challenge from WWW-Authenticate header
 */
export interface ScopeChallenge {
    scope?: string;
    error?: string;
    error_description?: string;
    resource_metadata?: string;
}

/**
 * MCP Server OAuth configuration
 */
export interface McpServerOAuthConfig {
    discoveryHints?: {
        registrationEndpoint?: string;
        authorizationEndpoint?: string;
        tokenEndpoint?: string;
    };
    scopes?: string[];
    resource?: string; // RFC 8707 resource parameter
    customHeaders?: Record<string, string>;
}

/**
 * MCP Tool Configuration
 * Manages which tools are enabled/disabled for a specific server
 */
export interface McpToolConfig {
    serverId: string;
    disabledTools: string[]; // Tool names that are disabled
}
