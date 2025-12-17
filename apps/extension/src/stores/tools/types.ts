/**
 * Tools Store Types
 *
 * Types for tool configuration, enabled states, and mode management.
 * Synced with Chrome storage for persistence.
 */

// Re-export shared types from ToolPopover (single source of truth)
export type { ToolMode, McpToolWithServer, WebMcpTool } from '@/components/features/chat/components/modals/ToolPopover/types';

export interface ToolsState {
  // Built-in tools enabled state
  enabledMap: Record<string, boolean>;

  // Mode management
  currentMode: ToolMode;
  hasUserModified: boolean;

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
  getDisplayMode: () => ToolMode;

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

  // Actions - Initialization
  initialize: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  recalculateCounts: () => void;
}
