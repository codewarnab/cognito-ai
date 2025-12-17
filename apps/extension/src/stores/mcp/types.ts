/**
 * MCP Store Types
 *
 * Type definitions for the MCP (Model Context Protocol) Zustand store.
 */

import type { McpConnectionState, McpTool } from '@/mcp/types';

/**
 * Server status in the store
 */
export interface McpServerStatus {
  serverId: string;
  isEnabled: boolean;
  isAuthenticated: boolean;
  state: McpConnectionState;
  lastError?: string;
  tools: McpTool[];
}

/**
 * Custom server data stored in chrome.storage
 */
export interface CustomServerData {
  id: string;
  name: string;
  url: string;
  description: string;
  image?: string;
  requiresAuthentication: boolean;
  initialEnabled?: boolean;
  initialAuthenticated?: boolean;
  isCustom: boolean;
}

/**
 * MCP Store State
 */
export interface McpState {
  // Server statuses (keyed by server ID)
  serverStatuses: Record<string, McpServerStatus>;

  // Custom servers loaded from storage
  customServers: CustomServerData[];

  // Tool counts
  mcpToolCount: number;
  cloudToolCount: number;
  totalToolCount: number;

  // UI state
  searchQuery: string;
  activeView: 'list' | 'tools' | 'add-custom';
  selectedServerId: string | null;

  // Initialization
  isInitialized: boolean;

  // Actions - Server Status
  setServerStatus: (serverId: string, status: Partial<McpServerStatus>) => void;
  loadServerStatuses: () => Promise<void>;

  // Actions - Custom Servers
  loadCustomServers: () => Promise<void>;
  addCustomServer: (server: Omit<CustomServerData, 'isCustom'>) => Promise<void>;
  deleteCustomServer: (serverId: string) => Promise<void>;

  // Actions - Tool Counts
  refreshToolCounts: () => Promise<void>;

  // Actions - UI
  setSearchQuery: (query: string) => void;
  setActiveView: (view: 'list' | 'tools' | 'add-custom') => void;
  setSelectedServerId: (serverId: string | null) => void;
  navigateToTools: (serverId: string) => void;
  navigateToList: () => void;
  navigateToAddCustom: () => void;

  // Actions - Server Operations
  enableServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  disableServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  authenticateServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  disconnectServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  healthCheckServer: (serverId: string) => Promise<{ success: boolean; toolCount?: number; error?: string }>;

  // Initialize
  initialize: () => Promise<void>;
}
