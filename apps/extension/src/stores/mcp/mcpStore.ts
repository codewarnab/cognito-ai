/**
 * MCP Store
 *
 * Zustand store for managing MCP (Model Context Protocol) server state.
 * Uses Immer for clean nested state updates.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getCloudToolsCount } from '@/ai/tools';
import { MCP_SERVERS } from '@/constants/mcpServers';
import { sendMcpMessage, sendMcpStaticMessage } from '@/lib/messaging';
import type { McpState, CustomServerData } from './types';
import type { McpConnectionState } from '@/mcp/types';

/**
 * Helper to determine if a state is authenticated
 */
const isAuthenticatedState = (state: McpConnectionState): boolean => {
  return ['authenticated', 'connected', 'connecting', 'token-refresh'].includes(state);
};

/**
 * Helper to determine if a state is enabled/connected
 */
const isEnabledState = (state: McpConnectionState): boolean => {
  return state === 'connected';
};

export const useMcpStore = create<McpState>()(
  immer((set, get) => ({
    // Initial state
    serverStatuses: {},
    customServers: [],
    mcpToolCount: 0,
    cloudToolCount: 0,
    totalToolCount: 0,
    searchQuery: '',
    activeView: 'list',
    selectedServerId: null,
    isInitialized: false,

    // Actions - Server Status
    setServerStatus: (serverId, status) =>
      set((state) => {
        if (!state.serverStatuses[serverId]) {
          state.serverStatuses[serverId] = {
            serverId,
            isEnabled: false,
            isAuthenticated: false,
            state: 'disconnected',
            tools: [],
          };
        }
        const serverStatus = state.serverStatuses[serverId]!;
        Object.assign(serverStatus, status);
      }),

    loadServerStatuses: async () => {
      const { customServers } = get();
      const allServers = [...MCP_SERVERS, ...customServers.map((s) => ({ id: s.id }))];

      const statusPromises = allServers.map(async (server) => {
        try {
          const response = await sendMcpMessage(server.id, 'status/get');
          if (response.success && response.data) {
            const status = response.data;
            const isAuth = isAuthenticatedState(status.state);
            return {
              serverId: server.id,
              status: {
                serverId: server.id,
                isEnabled: isEnabledState(status.state),
                isAuthenticated: isAuth,
                state: status.state as McpConnectionState,
                tools: status.tools || [],
              },
            };
          }
          return null;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(statusPromises);

      set((state) => {
        results.forEach((result) => {
          if (result) {
            state.serverStatuses[result.serverId] = result.status;
          }
        });
      });
    },

    // Actions - Custom Servers
    loadCustomServers: async () => {
      try {
        const result = await chrome.storage.local.get('customMcpServers');
        const stored = result.customMcpServers;
        if (stored && Array.isArray(stored)) {
          set({ customServers: stored });
        } else {
          set({ customServers: [] });
        }
      } catch (error) {
        console.error('Failed to load custom MCP servers:', error);
        set({ customServers: [] });
      }
    },

    addCustomServer: async (server) => {
      try {
        const newServer: CustomServerData = { ...server, isCustom: true };
        const result = await chrome.storage.local.get('customMcpServers');
        const servers = result.customMcpServers || [];
        servers.push(newServer);
        await chrome.storage.local.set({ customMcpServers: servers });

        // Notify background to reload custom servers cache
        await sendMcpStaticMessage('mcp/custom-servers/reload');

        set((state) => {
          state.customServers.push(newServer);
        });
      } catch (error) {
        console.error('Failed to add custom MCP server:', error);
        throw error;
      }
    },

    deleteCustomServer: async (serverId) => {
      try {
        const result = await chrome.storage.local.get('customMcpServers');
        const servers = result.customMcpServers || [];
        const updatedServers = servers.filter((s: CustomServerData) => s.id !== serverId);
        await chrome.storage.local.set({ customMcpServers: updatedServers });

        // Notify background to reload custom servers cache
        await sendMcpStaticMessage('mcp/custom-servers/reload');

        set((state) => {
          state.customServers = state.customServers.filter((s) => s.id !== serverId);
          delete state.serverStatuses[serverId];
        });
      } catch (error) {
        console.error('Failed to delete custom MCP server:', error);
        throw error;
      }
    },

    // Actions - Tool Counts
    refreshToolCounts: async () => {
      try {
        // Get MCP tool count
        const response = await sendMcpStaticMessage('mcp/tools/list');
        const mcpCount = response.success && response.data?.tools ? response.data.tools.length : 0;

        // Get cloud tool count
        const cloudCount = getCloudToolsCount();

        set({
          mcpToolCount: mcpCount,
          cloudToolCount: cloudCount,
          totalToolCount: mcpCount + cloudCount,
        });
      } catch (error) {
        console.error('Failed to refresh tool counts:', error);
      }
    },

    // Actions - UI
    setSearchQuery: (query) => set({ searchQuery: query }),

    setActiveView: (view) => set({ activeView: view }),

    setSelectedServerId: (serverId) => set({ selectedServerId: serverId }),

    navigateToTools: (serverId) =>
      set({
        activeView: 'tools',
        selectedServerId: serverId,
      }),

    navigateToList: () =>
      set({
        activeView: 'list',
        selectedServerId: null,
      }),

    navigateToAddCustom: () => set({ activeView: 'add-custom' }),

    // Actions - Server Operations
    /**
     * Enables an MCP server and establishes connection.
     * @param serverId - The server identifier to enable
     * @returns Promise with success status and optional error message
     */
    enableServer: async (serverId) => {
      try {
        const response = await sendMcpMessage(serverId, 'enable');
        if (response.success) {
          set((state) => {
            const status = state.serverStatuses[serverId];
            if (status) {
              status.isEnabled = true;
              status.state = 'connected';
            }
          });
          // Refresh tool counts after enabling
          await get().refreshToolCounts();
        }
        return { success: response.success, error: response.error };
      } catch (error) {
        return { success: false, error: 'Failed to enable server' };
      }
    },

    /**
     * Disables an MCP server and closes connection.
     * @param serverId - The server identifier to disable
     * @returns Promise with success status and optional error message
     */
    disableServer: async (serverId) => {
      try {
        const response = await sendMcpMessage(serverId, 'disable');
        if (response.success) {
          set((state) => {
            const status = state.serverStatuses[serverId];
            if (status) {
              status.isEnabled = false;
            }
          });
          // Refresh tool counts after disabling
          await get().refreshToolCounts();
        }
        return { success: response.success, error: response.error };
      } catch (error) {
        return { success: false, error: 'Failed to disable server' };
      }
    },

    /**
     * Initiates authentication flow for an MCP server.
     * @param serverId - The server identifier to authenticate
     * @returns Promise with success status and optional error message
     */
    authenticateServer: async (serverId) => {
      try {
        const response = await sendMcpMessage(serverId, 'auth/start');
        if (response.success) {
          // Reload status to get actual state after auth
          await get().loadServerStatuses();
        }
        return { success: response.success, error: response.error };
      } catch (error) {
        return { success: false, error: 'Authentication failed' };
      }
    },

    disconnectServer: async (serverId) => {
      try {
        const response = await sendMcpMessage(serverId, 'disconnect');
        if (response.success) {
          set((state) => {
            const status = state.serverStatuses[serverId];
            if (status) {
              status.isAuthenticated = false;
              status.isEnabled = false;
              status.state = 'disconnected';
            }
          });
          // Refresh tool counts after disconnect
          await get().refreshToolCounts();
        }
        return { success: response.success, error: response.error };
      } catch (error) {
        return { success: false, error: 'Failed to disconnect server' };
      }
    },

    healthCheckServer: async (serverId) => {
      try {
        const response = await sendMcpMessage(serverId, 'health/check');
        if (response.success) {
          const toolCount = response.data?.toolCount || 0;
          return { success: true, toolCount };
        }
        return { success: false, error: response.error };
      } catch (error) {
        return { success: false, error: 'Health check failed' };
      }
    },

    // Initialize
    initialize: async () => {
      if (get().isInitialized) return;

      // Load custom servers first
      await get().loadCustomServers();

      // Then load server statuses
      await get().loadServerStatuses();

      // Get tool counts
      await get().refreshToolCounts();

      // Set up message listener for status updates
      const handleMessage = (message: { type?: string; payload?: any }) => {
        const match = message.type?.match(/^mcp\/([^/]+)\/status\/update$/);
        if (match && match[1]) {
          const serverId = match[1];
          const status = message.payload;
          const isAuth = isAuthenticatedState(status.state);

          set((state) => {
            state.serverStatuses[serverId] = {
              serverId,
              isEnabled: isEnabledState(status.state),
              isAuthenticated: isAuth,
              state: status.state,
              tools: status.tools || state.serverStatuses[serverId]?.tools || [],
            };
          });

          // Refresh tool counts when server status changes
          get().refreshToolCounts();
        }
      };

      chrome.runtime.onMessage.addListener(handleMessage);

      set({ isInitialized: true });
    },
  }))
);

// Selectors
export const selectServerStatuses = (state: McpState) => state.serverStatuses;
export const selectCustomServers = (state: McpState) => state.customServers;
export const selectMcpToolCount = (state: McpState) => state.mcpToolCount;
export const selectCloudToolCount = (state: McpState) => state.cloudToolCount;
export const selectTotalToolCount = (state: McpState) => state.totalToolCount;
export const selectSearchQuery = (state: McpState) => state.searchQuery;
export const selectActiveView = (state: McpState) => state.activeView;
export const selectSelectedServerId = (state: McpState) => state.selectedServerId;
export const selectIsInitialized = (state: McpState) => state.isInitialized;
