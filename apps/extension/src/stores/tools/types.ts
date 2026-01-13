/**
 * Tools Store Types
 *
 * Types for tool configuration, enabled states, and mode management.
 * Synced with Chrome storage for persistence.
 * 
 * ## ToolsMode vs ToolMode
 * 
 * `ToolMode` is an alias for `ToolsMode` (from @/types/settings).
 * It determines which tools are available to the AI:
 * 
 * - `chat`: Minimal tools, focused on reading and Q&A
 * - `agent`: Full browser automation capabilities
 * - `adaptive`: On-demand tool discovery via `discoverTools` + `executeTools`
 */

import type { ToolsMode } from '@/types/settings';
import type { McpTool } from '@/mcp/types';

/**
 * ToolMode - alias for ToolsMode
 * 
 * Used throughout the tools store and UI components.
 */
export type ToolMode = ToolsMode;

/**
 * MCP Tool with server information attached
 */
export interface McpToolWithServer extends McpTool {
  serverId: string;
  serverName: string;
}

/**
 * WebMCP Tool definition
 */
export interface WebMcpTool {
  name: string;
  originalName: string;
  description?: string;
  domain?: string;
  favicon?: string;
}

export interface ToolsState {
  // Built-in tools enabled state (active view based on current mode)
  enabledMap: Record<string, boolean>;

  // Per-mode tool maps for independent persistence
  chatModeMap: Record<string, boolean>;
  agentModeMap: Record<string, boolean>;

  // Mode management
  currentMode: ToolMode;

  // Transient UI state for "modified" fade indicator
  justModified: boolean;

  // MCP tools
  mcpTools: McpToolWithServer[];
  mcpDisabledTools: Record<string, string[]>; // serverId -> disabled tool names
  mcpLoading: boolean;

  // WebMCP tools (managed by useWebMCPTools hook, counts tracked here)
  webMcpToolsCount: number;

  // Supermemory status
  supermemoryConfigured: boolean;

  // Computed counts
  enabledBuiltInCount: number;
  enabledMcpCount: number;
  totalEnabledCount: number;
  totalToolCount: number;
  isTooManyTools: boolean;

  // UI state
  showToolsModal: boolean;
  expandedCategories: Record<string, boolean>;
  toolSearchQuery: string;

  // Loading state
  isInitialized: boolean;
  isLoading: boolean;

  // Actions - Mode
  setMode: (mode: ToolMode) => Promise<void>;

  // Actions - Built-in tools
  toggleTool: (toolName: string, enabled: boolean) => Promise<void>;
  toggleCategory: (category: string, tools: string[], enabled: boolean) => Promise<void>;
  setEnabledMap: (map: Record<string, boolean>) => void;

  // Actions - MCP tools
  loadMcpTools: () => Promise<void>;
  toggleMcpTool: (serverId: string, toolName: string, enabled: boolean) => Promise<void>;
  toggleMcpCategory: (serverId: string, tools: McpToolWithServer[], enabled: boolean) => Promise<void>;

  // Actions - WebMCP (count tracking only, actual state in useWebMCPTools)
  setWebMcpToolsCount: (count: number) => void;

  // Actions - Supermemory
  checkSupermemory: () => Promise<void>;

  // Actions - UI
  setShowToolsModal: (show: boolean) => void;
  setExpandedCategories: (categories: Record<string, boolean>) => void;
  toggleCategoryExpanded: (category: string) => void;
  setToolSearchQuery: (query: string) => void;
  setJustModified: (val: boolean) => void;

  // Actions - Reset
  resetModeToDefault: () => Promise<void>;

  // Actions - Initialization
  initialize: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  recalculateCounts: () => void;
}

