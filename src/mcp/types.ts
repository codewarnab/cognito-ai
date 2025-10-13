/**
 * Type definitions for MCP (Model Context Protocol) integration
 */

/**
 * MCP Server connection states
 */
export type McpConnectionState =
    | 'disconnected'      // Not connected, no auth
    | 'needs-auth'        // Needs OAuth authentication
    | 'authenticated'     // OAuth complete, not connected
    | 'connecting'        // Attempting SSE connection
    | 'connected'         // Fully connected and operational
    | 'error'             // Connection error
    | 'token-refresh'     // Refreshing expired token
    | 'invalid-token';    // Token format is invalid, needs re-auth

/**
 * OAuth tokens stored in chrome.storage
 * Based on Notion OAuth API response
 */
export interface NotionOAuthTokens {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_at: number; // Unix timestamp
    bot_id?: string; // Identifier for this authorization
    workspace_id?: string;
    workspace_name?: string;
    workspace_icon?: string;
    duplicated_template_id?: string; // ID of duplicated template page (if any)
    owner?: {
        type: string;
        user?: {
            id: string;
            name?: string;
            avatar_url?: string;
        };
    };
    created_at: number; // Unix timestamp
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
    params?: any;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
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
            experimental?: Record<string, any>;
            roots?: { listChanged?: boolean };
            sampling?: Record<string, any>;
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
        properties?: Record<string, any>;
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
 * Notion MCP Server Status
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
 * Background message types for Notion MCP
 */
export type NotionMcpMessageType =
    | 'mcp/notion/auth/start'
    | 'mcp/notion/auth/complete'
    | 'mcp/notion/auth/refresh'
    | 'mcp/notion/enable'
    | 'mcp/notion/disable'
    | 'mcp/notion/disconnect'
    | 'mcp/notion/status/get'
    | 'mcp/notion/status/update'
    | 'mcp/notion/tool/call'
    | 'mcp/notion/tools/list'
    | 'mcp/notion/resource/read';

/**
 * Background message structure
 */
export interface NotionMcpMessage {
    type: NotionMcpMessageType;
    payload?: any;
}

/**
 * Response from background
 */
export interface NotionMcpResponse {
    success: boolean;
    data?: any;
    error?: string;
}
