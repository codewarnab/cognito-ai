/**
 * MCP-Specific Message Types
 *
 * Handles both static MCP messages and dynamic server ID patterns: mcp/${serverId}/${action}
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

import type { McpTool, McpResource, McpPrompt, McpConnectionState } from '@/mcp/types';

// =============================================================================
// MCP STATIC MESSAGES (no server ID)
// =============================================================================

/**
 * Static MCP messages that don't require a server ID
 */
export interface McpStaticMessageRegistry {
    /** List all tools from all connected MCP servers */
    'mcp/tools/list': {
        payload: undefined;
        response: {
            success: boolean;
            data?: {
                tools: Array<McpTool & { serverId: string; serverName?: string }>;
            };
            error?: string;
        };
    };

    /** Reload custom MCP servers from storage */
    'mcp/custom-servers/reload': {
        payload: undefined;
        response: { success: boolean; error?: string };
    };

    /** Get list of all MCP servers */
    'mcp/servers/get': {
        payload: undefined;
        response: {
            success: boolean;
            data?: Array<{
                id: string;
                name: string;
                state: McpConnectionState;
                tools?: McpTool[];
            }>;
            error?: string;
        };
    };
}

/** Static MCP message types */
export type McpStaticMessageType = keyof McpStaticMessageRegistry;

// =============================================================================
// MCP DYNAMIC MESSAGES (with server ID)
// =============================================================================

/**
 * All available actions for MCP servers with dynamic IDs
 */
export type McpServerAction =
    | 'auth/start'
    | 'auth/complete'
    | 'auth/refresh'
    | 'enable'
    | 'disable'
    | 'disconnect'
    | 'status/get'
    | 'status/update'
    | 'health/check'
    | 'tool/call'
    | 'tools/list'
    | 'tools/config/get'
    | 'tools/config/set'
    | 'resource/read';

/**
 * Payload types for each MCP server action
 */
export interface McpServerMessagePayloads {
    /** Start OAuth authentication flow */
    'auth/start': undefined;

    /** Complete OAuth authentication with authorization code */
    'auth/complete': { code: string };

    /** Refresh OAuth token */
    'auth/refresh': undefined;

    /** Enable/connect to the MCP server */
    'enable': undefined;

    /** Disable/pause the MCP server */
    'disable': undefined;

    /** Fully disconnect from the MCP server (logout) */
    'disconnect': undefined;

    /** Get current server status */
    'status/get': undefined;

    /** Update server status (internal use) */
    'status/update': {
        state: McpConnectionState;
        error?: string;
        tools?: McpTool[];
    };

    /** Perform health check on server */
    'health/check': undefined;

    /** Call a specific tool on the server */
    'tool/call': {
        name: string;
        arguments?: Record<string, unknown>;
    };

    /** List all tools available on this server */
    'tools/list': undefined;

    /** Get tool configuration (disabled tools list) */
    'tools/config/get': undefined;

    /** Set tool configuration (disabled tools list) */
    'tools/config/set': {
        disabledTools: string[];
    };

    /** Read a resource from the server */
    'resource/read': {
        uri: string;
    };
}

/**
 * Response types for each MCP server action
 */
export interface McpServerMessageResponses {
    /** Auth start opens OAuth popup, returns redirect info */
    'auth/start': {
        success: boolean;
        authUrl?: string;
        error?: string;
    };

    /** Auth complete returns success status */
    'auth/complete': {
        success: boolean;
        error?: string;
    };

    /** Auth refresh returns success status */
    'auth/refresh': {
        success: boolean;
        error?: string;
    };

    /** Enable returns success status */
    'enable': {
        success: boolean;
        error?: string;
    };

    /** Disable returns success status */
    'disable': {
        success: boolean;
        error?: string;
    };

    /** Disconnect returns success status */
    'disconnect': {
        success: boolean;
        error?: string;
    };

    /** Status get returns server status */
    'status/get': {
        success: boolean;
        data?: {
            serverId: string;
            state: McpConnectionState;
            error?: string;
            lastConnected?: number;
            tools?: McpTool[];
            resources?: McpResource[];
            prompts?: McpPrompt[];
        };
        error?: string;
    };

    /** Status update returns success status */
    'status/update': {
        success: boolean;
        error?: string;
    };

    /** Health check returns success and tool count */
    'health/check': {
        success: boolean;
        data?: {
            healthy: boolean;
            toolCount: number;
        };
        error?: string;
    };

    /** Tool call returns the tool result */
    'tool/call': {
        success: boolean;
        data?: unknown;
        error?: string;
    };

    /** Tools list returns server-specific tools */
    'tools/list': {
        success: boolean;
        data?: {
            tools: McpTool[];
        };
        error?: string;
    };

    /** Tools config get returns disabled tools */
    'tools/config/get': {
        success: boolean;
        data?: string[]; // Array of disabled tool names
        error?: string;
    };

    /** Tools config set returns success */
    'tools/config/set': {
        success: boolean;
        error?: string;
    };

    /** Resource read returns resource content */
    'resource/read': {
        success: boolean;
        data?: {
            uri: string;
            mimeType?: string;
            content: string | Blob;
        };
        error?: string;
    };
}

// =============================================================================
// TYPED MESSAGE STRUCTURES
// =============================================================================

/**
 * Typed MCP server message with dynamic server ID
 */
export interface McpServerMessage<A extends McpServerAction = McpServerAction> {
    type: `mcp/${string}/${A}`;
    payload?: McpServerMessagePayloads[A];
}

/**
 * Type-safe MCP message creator
 *
 * @example
 * const message = createMcpMessage('notion', 'enable');
 * // { type: 'mcp/notion/enable' }
 *
 * @example
 * const message = createMcpMessage('notion', 'tool/call', {
 *   name: 'search',
 *   arguments: { query: 'test' }
 * });
 * // { type: 'mcp/notion/tool/call', payload: { name: 'search', arguments: { query: 'test' } } }
 */
export function createMcpMessage<A extends McpServerAction>(
    serverId: string,
    action: A,
    ...args: McpServerMessagePayloads[A] extends undefined ? [] : [payload: McpServerMessagePayloads[A]]
): McpServerMessage<A> {
    const [payload] = args;

    if (payload !== undefined) {
        return {
            type: `mcp/${serverId}/${action}` as `mcp/${string}/${A}`,
            payload,
        };
    }

    return {
        type: `mcp/${serverId}/${action}` as `mcp/${string}/${A}`,
    };
}

// =============================================================================
// PARSING UTILITIES
// =============================================================================

/**
 * Parsed MCP message type structure
 */
export interface ParsedMcpMessageType {
    serverId: string;
    action: string;
}

/**
 * Parse an MCP message type string to extract server ID and action
 *
 * @example
 * parseMcpMessageType('mcp/notion/enable');
 * // { serverId: 'notion', action: 'enable' }
 *
 * @example
 * parseMcpMessageType('mcp/custom-server/tools/config/get');
 * // { serverId: 'custom-server', action: 'tools/config/get' }
 */
export function parseMcpMessageType(type: string): ParsedMcpMessageType | null {
    // Handle static MCP messages
    if (type === 'mcp/tools/list' || type === 'mcp/custom-servers/reload' || type === 'mcp/servers/get') {
        return null;
    }

    // Pattern: mcp/{serverId}/{action...}
    const match = type.match(/^mcp\/([^/]+)\/(.+)$/);
    if (!match || !match[1] || !match[2]) return null;

    return {
        serverId: match[1],
        action: match[2],
    };
}

/**
 * Check if a message type is an MCP message
 */
export function isMcpMessage(type: string): boolean {
    return type.startsWith('mcp/');
}

/**
 * Check if a message type is a static MCP message
 */
export function isStaticMcpMessage(type: string): type is McpStaticMessageType {
    return type === 'mcp/tools/list' || type === 'mcp/custom-servers/reload' || type === 'mcp/servers/get';
}

/**
 * Check if a message type is a dynamic MCP message (has server ID)
 */
export function isDynamicMcpMessage(type: string): boolean {
    return isMcpMessage(type) && !isStaticMcpMessage(type) && parseMcpMessageType(type) !== null;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for MCP server actions
 */
export function isMcpServerAction(action: string): action is McpServerAction {
    const validActions: McpServerAction[] = [
        'auth/start',
        'auth/complete',
        'auth/refresh',
        'enable',
        'disable',
        'disconnect',
        'status/get',
        'status/update',
        'health/check',
        'tool/call',
        'tools/list',
        'tools/config/get',
        'tools/config/set',
        'resource/read',
    ];
    return validActions.includes(action as McpServerAction);
}

/**
 * Type guard to check if a message is an MCP server message
 */
export function isMcpServerMessage(message: unknown): message is McpServerMessage {
    if (typeof message !== 'object' || message === null) return false;
    if (!('type' in message) || typeof (message as { type: unknown }).type !== 'string') return false;

    const parsed = parseMcpMessageType((message as { type: string }).type);
    return parsed !== null && isMcpServerAction(parsed.action);
}
