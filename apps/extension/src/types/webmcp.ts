/**
 * WebMCP (Browser-based MCP) type definitions
 * For discovering and executing tools from websites with WebMCP servers
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * WebMCP tool discovered from a website
 * Extends the standard MCP Tool with browser-specific metadata
 */
export interface WebMCPTool extends Tool {
  /** Original tool name from the page's MCP server */
  originalName: string;
  /** Prefixed name for our system (webmcp_{domain}_{name}) */
  name: string;
  /** Domain where tool was discovered */
  domain: string;
  /** Tab ID where tool exists */
  tabId: number;
  /** Full URL of the page */
  url: string;
  /** Favicon URL of the website */
  favicon?: string;
}

/**
 * State of WebMCP tools for the active tab
 */
export interface WebMCPToolsState {
  /** Currently active tab's WebMCP tools */
  tools: WebMCPTool[];
  /** Active tab ID */
  activeTabId: number | null;
  /** Domain of active tab */
  activeDomain: string | null;
  /** Whether discovery is in progress */
  isDiscovering: boolean;
  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Message to execute a WebMCP tool
 */
export interface WebMCPToolExecutionRequest {
  type: 'webmcp/tool/execute';
  /** Prefixed tool name */
  toolName: string;
  /** Original tool name from the page */
  originalToolName: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Unique request ID for tracking */
  requestId: string;
}

/**
 * Result of a WebMCP tool execution
 */
export interface WebMCPToolExecutionResult {
  type: 'webmcp/tool/result';
  /** Request ID this result corresponds to */
  requestId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Tool result on success */
  result?: unknown;
  /** Error message on failure */
  error?: string;
}

/**
 * Message to register tools from a content script
 */
export interface WebMCPToolsRegisterMessage {
  type: 'webmcp/tools/register';
  /** Tools discovered on the page */
  tools: WebMCPTool[];
  /** Tab ID where tools were discovered */
  tabId: number;
  /** Domain of the page */
  domain: string;
  /** Full URL of the page */
  url: string;
}

/**
 * Message to request tools list
 */
export interface WebMCPToolsListRequest {
  type: 'webmcp/tools/list';
}

/**
 * Response with tools list
 */
export interface WebMCPToolsListResponse {
  success: boolean;
  data?: {
    tools: WebMCPTool[];
  };
  error?: string;
}

/**
 * Message to get full WebMCP state
 */
export interface WebMCPStateRequest {
  type: 'webmcp/tools/state';
}

/**
 * Response with full WebMCP state
 */
export interface WebMCPStateResponse {
  success: boolean;
  data?: WebMCPToolsState;
  error?: string;
}

/**
 * Message to call a WebMCP tool
 */
export interface WebMCPToolCallRequest {
  type: 'webmcp/tool/call';
  payload: {
    toolName: string;
    args: Record<string, unknown>;
  };
}

/**
 * Message to refresh tools from content script
 */
export interface WebMCPToolsRefreshRequest {
  type: 'webmcp/tools/refresh';
}

/**
 * Notification that tools have been updated
 */
export interface WebMCPToolsUpdatedMessage {
  type: 'webmcp/tools/updated';
  tools: WebMCPTool[];
}

/**
 * Union type of all WebMCP message types
 */
export type WebMCPMessage =
  | WebMCPToolExecutionRequest
  | WebMCPToolExecutionResult
  | WebMCPToolsRegisterMessage
  | WebMCPToolsListRequest
  | WebMCPStateRequest
  | WebMCPToolCallRequest
  | WebMCPToolsRefreshRequest
  | WebMCPToolsUpdatedMessage;

/**
 * WebMCP tool configuration for enabling/disabling tools
 */
export interface WebMCPToolConfig {
  /** Tool names that are disabled */
  disabledTools: string[];
}

/**
 * Storage key for WebMCP disabled tools
 */
export const WEBMCP_DISABLED_TOOLS_KEY = 'webmcp.tools.disabled';
