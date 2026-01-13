/**
 * Tools Store
 *
 * Manages tool configuration, enabled states, and mode management.
 * Synced with Chrome storage for persistence.
 * Replaces useToolsPopover hook state management.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_ENABLED_TOOLS, TOOLS_DISABLED_BY_DEFAULT } from '@/ai/tools/enabledTools';
import {
  getEnabledToolsOverride,
  getToolsMode,
  setToolsMode,
  getChatModeTools,
  getAgentModeTools,
  setModeTools,
} from '@/utils/settings';
import {
  TOOL_CATEGORIES,
  SUPERMEMORY_TOOLS,
  WORKFLOW_ONLY_TOOLS,
  WEB_SEARCH_ONLY_TOOLS,
} from '@/constants/toolDescriptions';
import { isSupermemoryReady } from '@/utils/supermemory';
import { sendMcpMessage, sendMcpStaticMessage } from '@/lib/messaging';
import { createLogger } from '~logger';
import {
  TOOL_WARNING_THRESHOLD,
  CHAT_MODE_TOOLS,
  AGENT_MODE_TOOLS,
  ADAPTIVE_MODE_TOOLS,
} from '@/components/features/chat/components/modals/ToolPopover/constants';
import type { ToolsState, ToolMode, McpToolWithServer } from './types';

const log = createLogger('toolsStore', 'STORAGE_SYNC');

// Mode tool presets imported from constants

// Get all available tools (excluding workflow-only and web-search-only)
const getAllTools = (): string[] =>
  DEFAULT_ENABLED_TOOLS.filter(
    (t) => !WORKFLOW_ONLY_TOOLS.includes(t) && !WEB_SEARCH_ONLY_TOOLS.includes(t)
  );

// Build an enabled map from a mode preset
const buildDefaultMap = (mode: ToolMode, supermemoryConfigured: boolean): Record<string, boolean> => {
  const allTools = getAllTools();
  let toolsToEnable: string[] = [];

  if (mode === 'chat') {
    toolsToEnable = [...CHAT_MODE_TOOLS];
  } else if (mode === 'agent') {
    toolsToEnable = [...AGENT_MODE_TOOLS];
  } else if (mode === 'adaptive') {
    toolsToEnable = [...ADAPTIVE_MODE_TOOLS];
  }

  // Filter out supermemory tools if not configured
  if (!supermemoryConfigured) {
    toolsToEnable = toolsToEnable.filter((t) => !SUPERMEMORY_TOOLS.includes(t));
  }

  const map: Record<string, boolean> = {};
  allTools.forEach((t) => {
    map[t] = toolsToEnable.includes(t);
  });
  return map;
};

// Convert an enabled map to a list of enabled tool names
const mapToList = (map: Record<string, boolean>): string[] =>
  Object.entries(map)
    .filter(([, v]) => v)
    .map(([k]) => k);

// Calculate initial tool count synchronously for initial state
const getInitialToolCount = (): number => {
  const disabledByDefaultSet = new Set(TOOLS_DISABLED_BY_DEFAULT);
  return getAllTools().filter((t) => !disabledByDefaultSet.has(t)).length;
};

export const useToolsStore = create<ToolsState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    enabledMap: {},
    chatModeMap: {},
    agentModeMap: {},
    currentMode: 'agent',
    justModified: false,
    mcpTools: [],
    mcpDisabledTools: {},
    mcpLoading: false,
    webMcpToolsCount: 0,
    supermemoryConfigured: false,
    enabledBuiltInCount: getInitialToolCount(),
    enabledMcpCount: 0,
    totalEnabledCount: getInitialToolCount(),
    totalToolCount: getAllTools().length,
    isTooManyTools: false,
    showToolsModal: false,
    expandedCategories: {},
    toolSearchQuery: '',
    isInitialized: false,
    isLoading: false,


    // Actions - Mode
    /**
     * Sets the tool mode and switches to that mode's persisted tools.
     * @param mode - The tool mode to set ('chat', 'agent', or 'adaptive')
     */
    setMode: async (mode) => {
      const { chatModeMap, agentModeMap, supermemoryConfigured } = get();

      // Get the appropriate map for this mode
      let newEnabledMap: Record<string, boolean>;

      if (mode === 'chat') {
        // If chat mode has saved tools, use them; otherwise use defaults
        const hasCustomChatTools = Object.keys(chatModeMap).length > 0;
        newEnabledMap = hasCustomChatTools ? { ...chatModeMap } : buildDefaultMap('chat', supermemoryConfigured);
      } else if (mode === 'agent') {
        // If agent mode has saved tools, use them; otherwise use defaults
        const hasCustomAgentTools = Object.keys(agentModeMap).length > 0;
        newEnabledMap = hasCustomAgentTools ? { ...agentModeMap } : buildDefaultMap('agent', supermemoryConfigured);
      } else {
        // Adaptive mode uses fixed tools (read-only)
        newEnabledMap = buildDefaultMap('adaptive', supermemoryConfigured);
      }

      set({
        enabledMap: newEnabledMap,
        currentMode: mode,
      });

      // Persist mode change
      await setToolsMode(mode);

      get().recalculateCounts();
      log.info('Mode changed', { mode, toolCount: Object.values(newEnabledMap).filter(Boolean).length });
    },

    // Actions - Built-in tools
    /**
     * Toggles a built-in tool's enabled state.
     * Persists to the current mode's tool map.
     * @param toolName - The tool identifier
     * @param enabled - Whether to enable or disable the tool
     */
    toggleTool: async (toolName, enabled) => {
      const { enabledMap, currentMode, supermemoryConfigured } = get();

      // Block enabling supermemory tools if not configured
      if (enabled && SUPERMEMORY_TOOLS.includes(toolName) && !supermemoryConfigured) {
        log.warn('Cannot enable supermemory tool - not configured', { toolName });
        return;
      }

      // Adaptive mode is read-only
      if (currentMode === 'adaptive') {
        log.warn('Cannot toggle tools in adaptive mode');
        return;
      }

      const newMap = { ...enabledMap, [toolName]: enabled };

      // Update the mode-specific map
      const updatedMaps: Partial<ToolsState> = {
        enabledMap: newMap,
        justModified: true,
      };

      if (currentMode === 'chat') {
        updatedMaps.chatModeMap = newMap;
      } else if (currentMode === 'agent') {
        updatedMaps.agentModeMap = newMap;
      }

      set(updatedMaps);

      // Clear justModified after a short delay for fade effect
      setTimeout(() => {
        set({ justModified: false });
      }, 1500);

      // Persist to storage
      const enabledList = Object.entries(newMap)
        .filter(([, v]) => v)
        .map(([k]) => k);

      try {
        await setModeTools(currentMode, enabledList);
      } catch (err) {
        log.error('Failed to save tool config', err);
      }

      get().recalculateCounts();
    },

    /**
     * Toggles all tools in a category on or off.
     * @param category - The category name
     * @param tools - Array of tool names in the category
     * @param enabled - Whether to enable or disable the tools
     */
    toggleCategory: async (category, tools, enabled) => {
      const { enabledMap, currentMode, supermemoryConfigured } = get();

      // Adaptive mode is read-only
      if (currentMode === 'adaptive') {
        log.warn('Cannot toggle tools in adaptive mode');
        return;
      }

      // Filter out supermemory tools if enabling and not configured
      const toolsToUpdate =
        enabled && !supermemoryConfigured
          ? tools.filter((t) => !SUPERMEMORY_TOOLS.includes(t))
          : tools;

      if (toolsToUpdate.length === 0) {
        log.warn('No tools to update in category', { category });
        return;
      }

      const newMap = { ...enabledMap };
      toolsToUpdate.forEach((t) => {
        newMap[t] = enabled;
      });

      // Update the mode-specific map
      const updatedMaps: Partial<ToolsState> = {
        enabledMap: newMap,
        justModified: true,
      };

      if (currentMode === 'chat') {
        updatedMaps.chatModeMap = newMap;
      } else if (currentMode === 'agent') {
        updatedMaps.agentModeMap = newMap;
      }

      set(updatedMaps);

      // Clear justModified after a short delay for fade effect
      setTimeout(() => {
        set({ justModified: false });
      }, 1500);

      // Persist to storage
      const enabledList = Object.entries(newMap)
        .filter(([, v]) => v)
        .map(([k]) => k);

      try {
        await setModeTools(currentMode, enabledList);
      } catch (err) {
        log.error('Failed to save tool category config', err);
      }

      get().recalculateCounts();
    },

    /**
     * Resets the current mode's tools to their default configuration.
     * For 'chat' and 'agent' modes, resets to mode defaults.
     * Adaptive mode is read-only, so this is a no-op for adaptive.
     */
    resetModeToDefault: async () => {
      const { currentMode, supermemoryConfigured } = get();

      // Adaptive mode is read-only
      if (currentMode === 'adaptive') {
        log.warn('Cannot reset adaptive mode - it is read-only');
        return;
      }

      // Build default map for the current mode
      const defaultMap = buildDefaultMap(currentMode, supermemoryConfigured);

      // Update state
      const updatedMaps: Partial<ToolsState> = {
        enabledMap: defaultMap,
        justModified: true,
      };

      if (currentMode === 'chat') {
        updatedMaps.chatModeMap = defaultMap;
      } else if (currentMode === 'agent') {
        updatedMaps.agentModeMap = defaultMap;
      }

      set(updatedMaps);

      // Clear justModified after a short delay for fade effect
      setTimeout(() => {
        set({ justModified: false });
      }, 1500);

      // Persist to storage
      const enabledList = mapToList(defaultMap);

      try {
        await setModeTools(currentMode, enabledList);
        log.info('Reset mode to defaults', { mode: currentMode, toolCount: enabledList.length });
      } catch (err) {
        log.error('Failed to save reset tool config', err);
      }

      get().recalculateCounts();
    },

    setEnabledMap: (map) => {
      set({ enabledMap: map });
      get().recalculateCounts();
    },

    setJustModified: (val) => {
      set({ justModified: val });
    },


    // Actions - MCP tools
    /**
     * Loads MCP tools from all connected servers.
     * Fetches tool lists and disabled tool configurations.
     */
    loadMcpTools: async () => {
      set({ mcpLoading: true });

      try {
        const response = await sendMcpStaticMessage('mcp/tools/list');

        if (response?.success && response.data?.tools) {
          const tools = response.data.tools as McpToolWithServer[];
          const serverIds = [...new Set(tools.map((t) => t.serverId))];
          const disabledByServer: Record<string, string[]> = {};

          for (const serverId of serverIds) {
            try {
              const configResponse = await sendMcpMessage(serverId, 'tools/config/get');
              if (configResponse?.success && Array.isArray(configResponse.data)) {
                disabledByServer[serverId] = configResponse.data;
              }
            } catch (err) {
              log.error(`Failed to load disabled tools for server ${serverId}`, err);
            }
          }

          set({
            mcpTools: tools,
            mcpDisabledTools: disabledByServer,
          });
        }
      } catch (err) {
        log.error('Failed to load MCP tools', err);
      } finally {
        set({ mcpLoading: false });
        get().recalculateCounts();
      }
    },

    /**
     * Toggles an MCP tool's enabled state.
     * @param serverId - The MCP server identifier
     * @param toolName - The tool name to toggle
     * @param enabled - Whether to enable or disable the tool
     */
    toggleMcpTool: async (serverId, toolName, enabled) => {
      const { mcpDisabledTools } = get();
      const currentDisabled = mcpDisabledTools[serverId] || [];

      const newDisabled = enabled
        ? currentDisabled.filter((t) => t !== toolName)
        : [...currentDisabled, toolName];

      set({
        mcpDisabledTools: {
          ...mcpDisabledTools,
          [serverId]: newDisabled,
        },
      });

      try {
        await sendMcpMessage(serverId, 'tools/config/set', { disabledTools: newDisabled });
      } catch (err) {
        log.error('Failed to save MCP tool config', err);
      }

      get().recalculateCounts();
    },

    toggleMcpCategory: async (serverId, tools, enabled) => {
      const { mcpDisabledTools } = get();
      const newDisabled = enabled ? [] : tools.map((t) => t.name);

      set({
        mcpDisabledTools: {
          ...mcpDisabledTools,
          [serverId]: newDisabled,
        },
      });

      try {
        await sendMcpMessage(serverId, 'tools/config/set', { disabledTools: newDisabled });
      } catch (err) {
        log.error('Failed to save MCP tool config', err);
      }

      get().recalculateCounts();
    },

    // Actions - WebMCP
    setWebMcpToolsCount: (count) => {
      set({ webMcpToolsCount: count });
      get().recalculateCounts();
    },

    // Actions - Supermemory
    checkSupermemory: async () => {
      try {
        const ready = await isSupermemoryReady();
        set({ supermemoryConfigured: ready });
      } catch (err) {
        log.error('Failed to check Supermemory status', err);
        set({ supermemoryConfigured: false });
      }
    },


    // Actions - UI
    setShowToolsModal: (show) => set({ showToolsModal: show }),

    setExpandedCategories: (categories) => set({ expandedCategories: categories }),

    toggleCategoryExpanded: (category) => {
      const { expandedCategories } = get();
      set({
        expandedCategories: {
          ...expandedCategories,
          [category]: !expandedCategories[category],
        },
      });
    },

    setToolSearchQuery: (query) => {
      set({ toolSearchQuery: query });

      // Auto-expand all categories when searching
      if (query) {
        const allTools = getAllTools();
        const categories = new Set<string>();

        allTools.forEach((tool) => {
          for (const [cat, tools] of Object.entries(TOOL_CATEGORIES)) {
            if (tools.includes(tool)) {
              categories.add(cat);
              break;
            }
          }
        });

        const expanded: Record<string, boolean> = {};
        categories.forEach((cat) => {
          expanded[cat] = true;
        });
        set({ expandedCategories: expanded });
      }
    },

    // Actions - Initialization
    initialize: async () => {
      if (get().isInitialized) return;

      set({ isLoading: true });

      try {
        await get().checkSupermemory();
        await get().loadFromStorage();
        await get().loadMcpTools();

        set({ isInitialized: true });
        log.info('Tools store initialized');
      } catch (err) {
        log.error('Failed to initialize tools store', err);
      } finally {
        set({ isLoading: false });
      }
    },

    loadFromStorage: async () => {
      try {
        const savedMode = await getToolsMode();
        const chatTools = await getChatModeTools();
        const agentTools = await getAgentModeTools();
        const legacyOverride = await getEnabledToolsOverride();
        const { supermemoryConfigured } = get();

        const allTools = getAllTools();

        // Build chat mode map
        let chatModeMap: Record<string, boolean>;
        if (chatTools && chatTools.length > 0) {
          const chatSet = new Set(chatTools);
          chatModeMap = {};
          allTools.forEach((t) => {
            chatModeMap[t] = chatSet.has(t);
          });
        } else {
          // Use defaults for chat mode
          chatModeMap = buildDefaultMap('chat', supermemoryConfigured);
        }

        // Build agent mode map
        let agentModeMap: Record<string, boolean>;
        if (agentTools && agentTools.length > 0) {
          const agentSet = new Set(agentTools);
          agentModeMap = {};
          allTools.forEach((t) => {
            agentModeMap[t] = agentSet.has(t);
          });
        } else if (legacyOverride && legacyOverride.length > 0) {
          // Migrate from legacy storage - assume it was agent mode
          const legacySet = new Set(legacyOverride);
          agentModeMap = {};
          allTools.forEach((t) => {
            agentModeMap[t] = legacySet.has(t);
          });
        } else {
          // Use defaults for agent mode
          agentModeMap = buildDefaultMap('agent', supermemoryConfigured);
        }

        // Determine which mode to use and set the active map
        const currentMode = savedMode || 'agent';
        let enabledMap: Record<string, boolean>;

        if (currentMode === 'chat') {
          enabledMap = { ...chatModeMap };
        } else if (currentMode === 'agent') {
          enabledMap = { ...agentModeMap };
        } else {
          // Adaptive mode uses fixed tools (read-only)
          enabledMap = buildDefaultMap('adaptive', supermemoryConfigured);
        }

        set({
          chatModeMap,
          agentModeMap,
          enabledMap,
          currentMode,
        });

        get().recalculateCounts();
        log.info('Loaded tools from storage', {
          mode: currentMode,
          chatTools: mapToList(chatModeMap).length,
          agentTools: mapToList(agentModeMap).length
        });
      } catch (err) {
        log.error('Failed to load enabled tools', err);
      }
    },

    recalculateCounts: () => {
      const { enabledMap, mcpTools, mcpDisabledTools, webMcpToolsCount } = get();

      // Count enabled built-in tools
      const enabledBuiltInCount = Object.values(enabledMap).filter((v) => v).length;

      // Count enabled MCP tools
      let enabledMcpCount = 0;
      mcpTools.forEach((tool) => {
        const serverDisabled = mcpDisabledTools[tool.serverId] || [];
        if (!serverDisabled.includes(tool.name)) {
          enabledMcpCount++;
        }
      });

      const totalEnabledCount = enabledBuiltInCount + enabledMcpCount + webMcpToolsCount;
      const totalToolCount = getAllTools().length + mcpTools.length;

      set({
        enabledBuiltInCount,
        enabledMcpCount,
        totalEnabledCount,
        totalToolCount,
        isTooManyTools: totalEnabledCount > TOOL_WARNING_THRESHOLD,
      });
    },
  }))
);


// Listen for storage changes to sync across contexts
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.userSettings) {
      // Reload from storage when settings change externally
      const store = useToolsStore.getState();
      if (store.isInitialized) {
        store.loadFromStorage();
      }
    }
  });
}

// Listen for MCP server status changes and reload tools
// This ensures ComposerToolbar updates immediately when servers are enabled/disabled
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  let mcpReloadTimeout: ReturnType<typeof setTimeout> | null = null;

  chrome.runtime.onMessage.addListener((message: { type?: string; payload?: unknown }) => {
    // Match MCP status update messages (e.g., 'mcp/server-id/status/update')
    const match = message.type?.match(/^mcp\/([^/]+)\/status\/update$/);
    if (match) {
      const store = useToolsStore.getState();
      if (store.isInitialized) {
        // Debounce to prevent multiple rapid reloads
        if (mcpReloadTimeout) {
          clearTimeout(mcpReloadTimeout);
        }
        mcpReloadTimeout = setTimeout(() => {
          log.info('MCP server status changed, reloading tools');
          store.loadMcpTools();
          mcpReloadTimeout = null;
        }, 100);
      }
    }
  });
}

// Selectors for optimized subscriptions
export const selectEnabledMap = (state: ToolsState) => state.enabledMap;
export const selectCurrentMode = (state: ToolsState) => state.currentMode;
export const selectJustModified = (state: ToolsState) => state.justModified;
export const selectMcpTools = (state: ToolsState) => state.mcpTools;
export const selectMcpDisabledTools = (state: ToolsState) => state.mcpDisabledTools;
export const selectTotalEnabledCount = (state: ToolsState) => state.totalEnabledCount;
export const selectIsTooManyTools = (state: ToolsState) => state.isTooManyTools;
export const selectShowToolsModal = (state: ToolsState) => state.showToolsModal;
export const selectToolSearchQuery = (state: ToolsState) => state.toolSearchQuery;
export const selectExpandedCategories = (state: ToolsState) => state.expandedCategories;
export const selectSupermemoryConfigured = (state: ToolsState) => state.supermemoryConfigured;
export const selectIsInitialized = (state: ToolsState) => state.isInitialized;

