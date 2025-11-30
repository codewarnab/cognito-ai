/**
 * Hook to access WebMCP tools from the active tab
 * Provides real-time updates when tools change due to tab switches or page navigation
 */

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '~logger';
import type { WebMCPTool, WebMCPToolsState } from '@/types/webmcp';
import { WEBMCP_DISABLED_TOOLS_KEY } from '@/types/webmcp';

const log = createLogger('useWebMCPTools', 'WEBMCP');

interface UseWebMCPToolsReturn {
  /** WebMCP tools from the active tab */
  tools: WebMCPTool[];
  /** Whether tools are being discovered */
  isLoading: boolean;
  /** Error message if discovery failed */
  error: string | null;
  /** Manually refresh tools from cache */
  refresh: () => Promise<void>;
  /** Force discovery on the active tab (triggers content script) */
  discover: () => Promise<void>;
  /** Full WebMCP state */
  state: WebMCPToolsState | null;
  /** Disabled tool names */
  disabledTools: string[];
  /** Toggle a tool's enabled state */
  toggleTool: (toolName: string, enabled: boolean) => Promise<void>;
  /** Count of enabled tools */
  enabledCount: number;
  /** Current domain of the tools */
  currentDomain: string | null;
}

/**
 * Hook to access WebMCP tools from the active tab
 */
export function useWebMCPTools(): UseWebMCPToolsReturn {
  const [tools, setTools] = useState<WebMCPTool[]>([]);
  const [state, setState] = useState<WebMCPToolsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disabledTools, setDisabledTools] = useState<string[]>([]);

  // Load disabled tools from storage
  const loadDisabledTools = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(WEBMCP_DISABLED_TOOLS_KEY);
      const disabled = result[WEBMCP_DISABLED_TOOLS_KEY];
      if (Array.isArray(disabled)) {
        setDisabledTools(disabled);
      }
    } catch (err) {
      log.error('Failed to load disabled WebMCP tools', err);
    }
  }, []);

  // Fetch tools from background
  const fetchTools = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await chrome.runtime.sendMessage({
        type: 'webmcp/tools/list',
      });

      if (response?.success) {
        setTools(response.data?.tools || []);
      } else {
        setError(response?.error || 'Failed to fetch WebMCP tools');
      }

      // Also fetch state
      const stateResponse = await chrome.runtime.sendMessage({
        type: 'webmcp/tools/state',
      });

      if (stateResponse?.success) {
        setState(stateResponse.data);
      }
    } catch (err) {
      log.debug('WebMCP tools not available', err);
      setTools([]);
      setError(null); // Don't show error - WebMCP is optional
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Toggle tool enabled state
  const toggleTool = useCallback(async (toolName: string, enabled: boolean) => {
    let newDisabled: string[];

    if (enabled) {
      newDisabled = disabledTools.filter(t => t !== toolName);
    } else {
      newDisabled = [...disabledTools, toolName];
    }

    setDisabledTools(newDisabled);

    try {
      await chrome.storage.local.set({ [WEBMCP_DISABLED_TOOLS_KEY]: newDisabled });
    } catch (err) {
      log.error('Failed to save WebMCP tool config', err);
      // Revert on error
      setDisabledTools(disabledTools);
    }
  }, [disabledTools]);

  // Force discovery on the active tab
  const discover = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await chrome.runtime.sendMessage({
        type: 'webmcp/tools/discover',
      });

      if (response?.success) {
        log.info('WebMCP discovery triggered', { tabId: response.tabId });
        // Tools will be updated via the 'webmcp/tools/updated' message listener
      } else {
        log.debug('WebMCP discovery not available', { error: response?.error });
      }
    } catch (err) {
      log.debug('WebMCP discovery failed', err);
    } finally {
      // Keep loading state for a bit to allow discovery to complete
      setTimeout(() => setIsLoading(false), 500);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTools();
    loadDisabledTools();
  }, [fetchTools, loadDisabledTools]);

  // Listen for tool updates from background
  useEffect(() => {
    const handleMessage = (message: { type: string; tools?: WebMCPTool[] }) => {
      if (message.type === 'webmcp/tools/updated') {
        log.info('WebMCP tools updated', { count: message.tools?.length });
        setTools(message.tools || []);
        setIsLoading(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Listen for storage changes (disabled tools)
  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === 'local' && changes[WEBMCP_DISABLED_TOOLS_KEY]) {
        const newValue = changes[WEBMCP_DISABLED_TOOLS_KEY].newValue;
        if (Array.isArray(newValue)) {
          setDisabledTools(newValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Calculate enabled count
  const enabledCount = tools.filter(t => !disabledTools.includes(t.name)).length;

  // Get current domain from state or first tool
  const currentDomain = state?.activeDomain || tools[0]?.domain || null;

  return {
    tools,
    isLoading,
    error,
    refresh: fetchTools,
    discover,
    state,
    disabledTools,
    toggleTool,
    enabledCount,
    currentDomain,
  };
}
