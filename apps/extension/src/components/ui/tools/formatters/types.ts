/**
 * Type definitions for Tool Action Formatter
 */

export interface ToolInput {
    [key: string]: unknown;
}

export interface ToolOutput {
    [key: string]: unknown;
}

export interface ActionFormatterContext {
    toolName: string;
    state: 'loading' | 'success' | 'error' | 'pending-approval';
    input?: ToolInput;
    output?: ToolOutput;
}

export interface FormattedAction {
    action: string;
    description?: string;
    customIcon?: 'upload' | string; // Optional custom icon identifier
    faviconUrl?: string; // Optional favicon URL for WebMCP tools
    mcpServerId?: string; // Optional MCP server ID for MCP tools
}

export type ActionFormatter = (ctx: ActionFormatterContext) => FormattedAction;
