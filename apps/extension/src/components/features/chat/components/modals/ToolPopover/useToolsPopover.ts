/**
 * useToolsPopover Hook
 *
 * Connects the ToolsPopover component to the tools store.
 * Handles UI interactions and delegates state management to the store.
 */

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createLogger } from '~logger';
import {
  useUINavigationStore,
  useToolsStore,
  type UINavigationState,
  type ToolsState,
} from '@/stores';
import { TOOL_CATEGORIES, SUPERMEMORY_TOOLS } from '@/constants/toolDescriptions';
import { useWebMCPTools } from '@/hooks/webmcp';
import { ADAPTIVE_ONLY_TOOLS } from './constants';
import type { ToolMode, McpToolWithServer } from './types';

const log = createLogger('ToolsPopover', 'UI_CHAT');

export function useToolsPopover(isOpen: boolean, onClose: () => void) {
  // Store state
  const enabledMap = useToolsStore((state: ToolsState) => state.enabledMap);
  const currentMode = useToolsStore((state: ToolsState) => state.currentMode);
  const hasUserModified = useToolsStore((state: ToolsState) => state.hasUserModified);
  const mcpTools = useToolsStore((state: ToolsState) => state.mcpTools);
  const mcpDisabledTools = useToolsStore((state: ToolsState) => state.mcpDisabledTools);
  const mcpLoading = useToolsStore((state: ToolsState) => state.mcpLoading);
  const supermemoryConfigured = useToolsStore((state: ToolsState) => state.supermemoryConfigured);
  const expandedCategories = useToolsStore((state: ToolsState) => state.expandedCategories);
  const toolSearchQuery = useToolsStore((state: ToolsState) => state.toolSearchQuery);
  const enabledBuiltInCount = useToolsStore((state: ToolsState) => state.enabledBuiltInCount);
  const enabledMcpCount = useToolsStore((state: ToolsState) => state.enabledMcpCount);
  const totalEnabledCount = useToolsStore((state: ToolsState) => state.totalEnabledCount);
  const totalToolCount = useToolsStore((state: ToolsState) => state.totalToolCount);
  const isTooManyTools = useToolsStore((state: ToolsState) => state.isTooManyTools);
  const isInitialized = useToolsStore((state: ToolsState) => state.isInitialized);

  // Store actions
  const initialize = useToolsStore((state: ToolsState) => state.initialize);
  const setMode = useToolsStore((state: ToolsState) => state.setMode);
  const toggleTool = useToolsStore((state: ToolsState) => state.toggleTool);
  const toggleCategory = useToolsStore((state: ToolsState) => state.toggleCategory);
  const loadMcpTools = useToolsStore((state: ToolsState) => state.loadMcpTools);
  const toggleMcpTool = useToolsStore((state: ToolsState) => state.toggleMcpTool);
  const toggleMcpCategory = useToolsStore((state: ToolsState) => state.toggleMcpCategory);
  const setWebMcpToolsCount = useToolsStore((state: ToolsState) => state.setWebMcpToolsCount);
  const setToolSearchQuery = useToolsStore((state: ToolsState) => state.setToolSearchQuery);
  const toggleCategoryExpanded = useToolsStore((state: ToolsState) => state.toggleCategoryExpanded);
  const setExpandedCategories = useToolsStore((state: ToolsState) => state.setExpandedCategories);
  const checkSupermemory = useToolsStore((state: ToolsState) => state.checkSupermemory);

  // Local UI state (not persisted)
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const [showSupermemoryTooltip, setShowSupermemoryTooltip] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const lastDiscoveredDomainRef = useRef<string | null>(null);

  // WebMCP tools (managed by separate hook)
  const {
    tools: webmcpTools,
    isLoading: webmcpLoading,
    disabledTools: webmcpDisabledTools,
    toggleTool: toggleWebMCPTool,
    enabledCount: enabledWebMCPCount,
    refresh: refreshWebMCPTools,
    discover: discoverWebMCPTools,
    currentDomain: webmcpCurrentDomain,
  } = useWebMCPTools();


  // Sync WebMCP count to store
  useEffect(() => {
    setWebMcpToolsCount(enabledWebMCPCount);
  }, [enabledWebMCPCount, setWebMcpToolsCount]);

  // Computed display mode
  const displayMode: ToolMode = hasUserModified ? 'custom' : currentMode;

  // Initialize store when popover opens
  useEffect(() => {
    if (isOpen && !isInitialized) {
      initialize();
    }
  }, [isOpen, isInitialized, initialize]);

  // Refresh data when popover opens (if already initialized)
  useEffect(() => {
    if (isOpen && isInitialized) {
      checkSupermemory();
      loadMcpTools();
    }
  }, [isOpen, isInitialized, checkSupermemory, loadMcpTools]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Hide voice FAB when popover is open
  const setVoiceFabVisibility = useUINavigationStore(
    (state: UINavigationState) => state.setVoiceFabVisibility
  );

  useEffect(() => {
    setVoiceFabVisibility(!isOpen);
  }, [isOpen, setVoiceFabVisibility]);

  // Note: Location permission watching is now handled globally in toolsStore.initialize()

  // WebMCP discovery
  useEffect(() => {
    if (!isOpen) return;

    refreshWebMCPTools();

    const checkAndDiscoverWebMCP = async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.url) return;

        const currentTabDomain = new URL(activeTab.url).hostname;

        if (webmcpCurrentDomain === currentTabDomain && webmcpTools.length > 0) {
          log.debug('WebMCP tools already loaded for current domain', { domain: currentTabDomain });
          return;
        }

        if (lastDiscoveredDomainRef.current === currentTabDomain) {
          log.debug('Already attempted discovery for this domain', { domain: currentTabDomain });
          return;
        }

        log.info('Triggering WebMCP discovery for new domain', { domain: currentTabDomain });
        lastDiscoveredDomainRef.current = currentTabDomain;
        await discoverWebMCPTools();
      } catch (err) {
        log.debug('Failed to check/discover WebMCP tools', err);
      }
    };

    checkAndDiscoverWebMCP();
  }, [isOpen, refreshWebMCPTools, discoverWebMCPTools, webmcpCurrentDomain, webmcpTools.length]);


  // Handler for mode change
  const handleModeChange = useCallback(
    async (mode: ToolMode) => {
      if (mode === 'custom') return;
      await setMode(mode);
      log.info('Mode changed via handler', { mode });
    },
    [setMode]
  );

  // Handler for toggling individual tool
  const handleToggleTool = useCallback(
    async (tool: string, checked: boolean) => {
      if (checked && SUPERMEMORY_TOOLS.includes(tool) && !supermemoryConfigured) {
        setShowSupermemoryTooltip(tool);
        return;
      }

      await toggleTool(tool, checked);
    },
    [supermemoryConfigured, toggleTool]
  );

  // Handler for toggling category
  const handleToggleCategory = useCallback(
    async (e: React.MouseEvent, category: string, tools: string[]) => {
      e.stopPropagation();
      const allEnabled = tools.every((t) => enabledMap[t] === true);
      const newState = !allEnabled;

      const toolsToUpdate =
        newState && !supermemoryConfigured
          ? tools.filter((t) => !SUPERMEMORY_TOOLS.includes(t))
          : tools;

      if (toolsToUpdate.length === 0) {
        setShowSupermemoryTooltip(tools[0] || null);
        return;
      }

      await toggleCategory(category, toolsToUpdate, newState);
    },
    [enabledMap, supermemoryConfigured, toggleCategory]
  );

  // Handler for toggling MCP tool
  const handleToggleMcpTool = useCallback(
    async (serverId: string, toolName: string, checked: boolean) => {
      await toggleMcpTool(serverId, toolName, checked);
    },
    [toggleMcpTool]
  );

  // Handler for toggling MCP category
  const handleToggleMcpCategory = useCallback(
    async (e: React.MouseEvent, serverId: string, serverTools: McpToolWithServer[]) => {
      e.stopPropagation();
      const currentDisabled = mcpDisabledTools[serverId] || [];
      const enabledCount = serverTools.filter((t) => !currentDisabled.includes(t.name)).length;
      const allEnabled = enabledCount === serverTools.length;

      await toggleMcpCategory(serverId, serverTools, !allEnabled);
    },
    [mcpDisabledTools, toggleMcpCategory]
  );

  // Handler for toggling WebMCP category
  const handleToggleWebMcpCategoryAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const allEnabled = enabledWebMCPCount === webmcpTools.length;
      const newState = !allEnabled;

      webmcpTools.forEach((tool) => {
        const isCurrentlyEnabled = !webmcpDisabledTools.includes(tool.name);
        if (isCurrentlyEnabled !== newState) {
          toggleWebMCPTool(tool.name, newState);
        }
      });
    },
    [enabledWebMCPCount, webmcpTools, webmcpDisabledTools, toggleWebMCPTool]
  );

  // Filtered tools based on search
  const filteredTools = useMemo(() => {
    const tools = Object.keys(enabledMap);
    if (!toolSearchQuery) return tools;
    return tools.filter((t) => t.toLowerCase().includes(toolSearchQuery.toLowerCase()));
  }, [enabledMap, toolSearchQuery]);

  // Filtered MCP tools based on search
  const filteredMcpTools = useMemo(() => {
    if (!toolSearchQuery) return mcpTools;
    return mcpTools.filter((t) => t.name.toLowerCase().includes(toolSearchQuery.toLowerCase()));
  }, [mcpTools, toolSearchQuery]);

  // MCP server groups
  const mcpServerGroups = useMemo(() => {
    const groups: Record<string, { name: string; tools: McpToolWithServer[] }> = {};
    filteredMcpTools.forEach((tool) => {
      if (!groups[tool.serverId]) {
        groups[tool.serverId] = { name: tool.serverName, tools: [] };
      }
      groups[tool.serverId]!.tools.push(tool);
    });
    return groups;
  }, [filteredMcpTools]);

  // Filtered WebMCP tools based on search
  const filteredWebMCPTools = useMemo(() => {
    if (!toolSearchQuery) return webmcpTools;
    const query = toolSearchQuery.toLowerCase();
    return webmcpTools.filter(
      (t) =>
        t.originalName.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
    );
  }, [webmcpTools, toolSearchQuery]);

  // Grouped tools by category
  const groupedTools = useMemo(() => {
    const groups: Record<string, string[]> = {};
    filteredTools.forEach((tool) => {
      // Hide adaptive-only tools when not in adaptive mode
      if (currentMode !== 'adaptive' && ADAPTIVE_ONLY_TOOLS.includes(tool)) {
        return;
      }

      let category = 'Other';
      for (const [cat, categoryTools] of Object.entries(TOOL_CATEGORIES)) {
        if (categoryTools.includes(tool)) {
          category = cat;
          break;
        }
      }
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category]!.push(tool);
    });
    return groups;
  }, [filteredTools, currentMode]);

  // Auto-expand categories when searching
  // Note: We only depend on toolSearchQuery to avoid infinite loops
  // groupedTools is derived from enabledMap which is stable
  useEffect(() => {
    if (toolSearchQuery) {
      const newExpanded: Record<string, boolean> = {};
      Object.keys(groupedTools).forEach((category) => {
        newExpanded[category] = true;
      });
      setExpandedCategories(newExpanded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSearchQuery]);

  return {
    popoverRef,
    enabledMap,
    toolSearchQuery,
    setToolSearchQuery,
    expandedCategories,
    showInfoTooltip,
    setShowInfoTooltip,
    supermemoryConfigured,
    showSupermemoryTooltip,
    setShowSupermemoryTooltip,
    displayMode,
    hasUserModified,
    mcpTools,
    mcpDisabledTools,
    mcpLoading,
    webmcpTools,
    webmcpLoading,
    webmcpDisabledTools,
    toggleWebMCPTool,
    enabledWebMCPCount,
    filteredTools,
    filteredMcpTools,
    filteredWebMCPTools,
    groupedTools,
    mcpServerGroups,
    enabledExtensionCount: enabledBuiltInCount,
    enabledMcpCount,
    totalEnabledCount,
    totalToolCount,
    isTooManyTools,
    handleModeChange,
    handleToggleTool,
    handleToggleCategory,
    handleToggleMcpTool,
    handleToggleMcpCategory,
    handleToggleWebMcpCategoryAll,
    toggleCategory: toggleCategoryExpanded,
  };
}
