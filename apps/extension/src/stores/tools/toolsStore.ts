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
  setEnabledToolsOverride,
  getToolsMode,
  setToolsMode,
} from '@/utils/settings';
import {
  TOOL_CATEGORIES,
  SUPERMEMORY_TOOLS,
  WORKFLOW_ONLY_TOOLS,
  WEB_SEARCH_ONLY_TOOLS,
} from '@/constants/toolDescriptions';
import { isSupermemoryReady } from '@/utils/supermemory';
import { watchLocationPermission } from '@/utils/geolocation';
import { sendMcpMessage, sendMcpStaticMessage } from '@/lib/messaging';
import { createLogger } from '~logger';
import {
  TOOL_WARNING_THRESHOLD,
  CHAT_MODE_TOOLS,
  AGENT_MODE_TOOLS,
  ADAPTIVE_MODE_TOOLS,
} from '@/components/features/chat/components/modals/ToolPopover/constants';
import type { ToolsState, ToolMode, McpToolWithServer } from './types';

const log = createLogger('toolsStore', 'STORAGE');

// Store cleanup function for location permission watcher
let locationPermissionCleanup: (() => void) | null = null;

// Mode tool presets imported from constants

// Get all available tools (excluding workflow-only and web-search-only)
const getAllTools = (): string[] =>
  DEFAULT_ENABLED_TOOLS.filter(
    (t) => !WORKFLOW_ONLY_TOOLS.includes(t) && !WEB_SEARCH_ONLY_TOOLS.includes(t)
  );


// Helper to detect which mode matches the current enabled tools
const getToolsMatchingMode = (enabledMap: Record<string, boolean>): ToolMode | null => {
  const enabledList = Object.entries(enabledMap)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const chatSet = new Set(CHAT_MODE_TOOLS);
  const isChatMode =
    enabledList.length === CHAT_MODE_TOOLS.length && enabledList.every((t) => chatSet.has(t));
  if (isChatMode) return 'chat';

  const agentSet = new Set(AGENT_MODE_TOOLS);
  const isAgentMode =
    enabledList.length === AGENT_MODE_TOOLS.length && enabledList.every((t) => agentSet.has(t));
  if (isAgentMode) return 'agent';

  const adaptiveSet = new Set(ADAPTIVE_MODE_TOOLS);
  const isAdaptiveMode =
    enabledList.length === ADAPTIVE_MODE_TOOLS.length &&
    enabledList.every((t) => adaptiveSet.has(t));
  if (isAdaptiveMode) return 'adaptive';

  return null;
};

// Get tools for a specific mode
const getToolsForMode = (mode: ToolMode, supermemoryConfigured: boolean): string[] => {
  let tools: string[] = [];

  if (mode === 'chat') {
    tools = [...CHAT_MODE_TOOLS];
  } else if (mode === 'agent') {
    tools = [...AGENT_MODE_TOOLS];
  } else if (mode === 'adaptive') {
    tools = [...ADAPTIVE_MODE_TOOLS];
  }

  // Filter out supermemory tools if not configured
  if (!supermemoryConfigured) {
    tools = tools.filter((t) => !SUPERMEMORY_TOOLS.includes(t));
  }

  return tools;
};

// Calculate initial tool count synchronously for initial state
const getInitialToolCount = (): number => {
  const disabledByDefaultSet = new Set(TOOLS_DISABLED_BY_DEFAULT);
  return getAllTools().filter((t) => !disabledByDefaultSet.has(t)).length;
};

export const useToolsStore = create<ToolsState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    enabledMap: {},
    currentMode: 'agent',
    hasUserModified: false,
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
    setMode: async (mode) => {
      if (mode === 'custom') return;

      const { supermemoryConfigured } = get();
      const toolsToEnable = getToolsForMode(mode, supermemoryConfigured);
      const allTools = getAllTools();

      const newMap: Record<string, boolean> = {};
      allTools.forEach((t) => {
        newMap[t] = toolsToEnable.includes(t);
      });

      set({
        enabledMap: newMap,
        currentMode: mode,
        hasUserModified: false,
      });

      // Persist to storage
      await setEnabledToolsOverride(toolsToEnable);
      await setToolsMode(mode);

      get().recalculateCounts();
      log.info('Mode changed', { mode, toolCount: toolsToEnable.length });
    },

    getDisplayMode: () => {
      const { hasUserModified, currentMode } = get();
      return hasUserModified ? 'custom' : currentMode;
    },

    // Actions - Built-in tools
    toggleTool: async (toolName, enabled) => {
      const { enabledMap, supermemoryConfigured } = get();

      // Block enabling supermemory tools if not configured
      if (enabled && SUPERMEMORY_TOOLS.includes(toolName) && !supermemoryConfigured) {
        log.warn('Cannot enable supermemory tool - not configured', { toolName });
        return;
      }

      const newMap = { ...enabledMap, [toolName]: enabled };
      const matchedMode = getToolsMatchingMode(newMap);

      set({
        enabledMap: newMap,
        currentMode: matchedMode || get().currentMode,
        hasUserModified: !matchedMode,
      });

      // Persist to storage
      const enabledList = Object.entries(newMap)
        .filter(([, v]) => v)
        .map(([k]) => k);

      try {
        await setEnabledToolsOverride(enabledList);
        await setToolsMode(matchedMode || 'custom');
      } catch (err) {
        log.error('Failed to save tool config', err);
      }

      get().recalculateCounts();
    },

    toggleCategory: async (category, tools, enabled) => {
      const { enabledMap, supermemoryConfigured } = get();

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

      const matchedMode = getToolsMatchingMode(newMap);

      set({
        enabledMap: newMap,
        currentMode: matchedMode || get().currentMode,
        hasUserModified: !matchedMode,
      });

      // Persist to storage
      const enabledList = Object.entries(newMap)
        .filter(([, v]) => v)
        .map(([k]) => k);

      try {
        await setEnabledToolsOverride(enabledList);
        await setToolsMode(matchedMode || 'custom');
      } catch (err) {
        log.error('Failed to save tool category config', err);
      }

      get().recalculateCounts();
    },

    setEnabledMap: (map) => {
      set({ enabledMap: map });
      get().recalculateCounts();
    },


    // Actions - MCP tools
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

        // Set up global location permission watcher
        // This runs even when the popover is closed
        if (locationPermissionCleanup) {
          locationPermissionCleanup();
        }
        locationPermissionCleanup = watchLocationPermission(async (state) => {
          const { enabledMap } = get();
          if (state === 'denied' && enabledMap['googleMaps']) {
            log.warn('Location permission revoked, disabling googleMaps tool');
            await get().toggleTool('googleMaps', false);
          }
        });

        set({ isInitialized: true });
        log.info('Tools store initialized');
      } catch (err) {
        log.error('Failed to initialize tools store', err);
      } finally {
        set({ isLoading: false });
      }
    },

    loadFromStorage: async () => {
      const allTools = getAllTools();

      try {
        const override = await getEnabledToolsOverride();
        const savedMode = await getToolsMode();
        const { supermemoryConfigured } = get();

        const initialMap: Record<string, boolean> = {};

        if (override && Array.isArray(override)) {
          const overrideSet = new Set(override);
          allTools.forEach((t) => {
            initialMap[t] = overrideSet.has(t);
          });

          if (savedMode && savedMode !== 'custom') {
            set({
              enabledMap: initialMap,
              currentMode: savedMode,
              hasUserModified: false,
            });
          } else if (savedMode === 'custom') {
            set({
              enabledMap: initialMap,
              hasUserModified: true,
            });
          } else {
            const detectedMode = getToolsMatchingMode(initialMap);
            set({
              enabledMap: initialMap,
              currentMode: detectedMode || 'agent',
              hasUserModified: !detectedMode,
            });
          }
        } else {
          // No override - use default mode
          const modeToUse = savedMode || 'agent';
          const toolsToEnable = getToolsForMode(
            modeToUse === 'custom' ? 'agent' : modeToUse,
            supermemoryConfigured
          );

          allTools.forEach((t) => {
            initialMap[t] = toolsToEnable.includes(t);
          });

          set({
            enabledMap: initialMap,
            currentMode: modeToUse === 'custom' ? 'agent' : modeToUse,
            hasUserModified: modeToUse === 'custom',
          });
        }

        get().recalculateCounts();
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

// Selectors for optimized subscriptions
export const selectEnabledMap = (state: ToolsState) => state.enabledMap;
export const selectCurrentMode = (state: ToolsState) => state.currentMode;
export const selectDisplayMode = (state: ToolsState) =>
  state.hasUserModified ? 'custom' : state.currentMode;
export const selectMcpTools = (state: ToolsState) => state.mcpTools;
export const selectMcpDisabledTools = (state: ToolsState) => state.mcpDisabledTools;
export const selectTotalEnabledCount = (state: ToolsState) => state.totalEnabledCount;
export const selectIsTooManyTools = (state: ToolsState) => state.isTooManyTools;
export const selectShowToolsModal = (state: ToolsState) => state.showToolsModal;
export const selectToolSearchQuery = (state: ToolsState) => state.toolSearchQuery;
export const selectExpandedCategories = (state: ToolsState) => state.expandedCategories;
export const selectSupermemoryConfigured = (state: ToolsState) => state.supermemoryConfigured;
export const selectIsInitialized = (state: ToolsState) => state.isInitialized;
