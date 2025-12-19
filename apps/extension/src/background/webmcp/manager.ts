/**
 * WebMCP Manager - State Management for Web-based Model Context Protocol
 * 
 * WebMCP (Web-based Model Context Protocol) extends the MCP standard to enable
 * tool discovery and execution directly from websites. This manager handles the
 * state and lifecycle of WebMCP tools discovered from the active browser tab.
 * 
 * ## What is WebMCP?
 * 
 * WebMCP allows websites to expose tools that AI assistants can discover and execute.
 * Unlike traditional MCP servers that run as separate services, WebMCP tools are
 * embedded in web pages and executed in the browser context.
 * 
 * ## Active Tab Only Design
 * 
 * Unlike some WebMCP implementations that track all tabs, this manager intentionally
 * tracks **only the active tab**. This design choice:
 * 
 * - **Reduces memory usage** - No need to store tools from all tabs
 * - **Simplifies state** - Clear mental model for users
 * - **Avoids stale data** - Tools are always fresh from current page
 * - **Improves security** - Only interacts with the tab user is viewing
 * 
 * ## State Management
 * 
 * The manager maintains an in-memory state that includes:
 * - Currently discovered tools from the active tab
 * - Active tab ID and domain
 * - Discovery status
 * - Last update timestamp
 * 
 * ## Event Flow
 * 
 * 1. Tab activation triggers `setActiveTab()`
 * 2. Manager sends `webmcp/tools/refresh` to content script
 * 3. Content script discovers tools and sends `webmcp/tools/register`
 * 4. Manager updates state and notifies listeners
 * 5. UI receives `webmcp/tools/updated` broadcast
 * 
 * @module background/webmcp
 * @see {@link file://./README.md | WebMCP Module README}
 */

import { createLogger } from '~logger';
import type { WebMCPTool, WebMCPToolsState } from '@/types/webmcp';

const log = createLogger('WebMCP-Manager', 'WEBMCP');

// In-memory state for active tab's WebMCP tools
let state: WebMCPToolsState = {
  tools: [],
  activeTabId: null,
  activeDomain: null,
  isDiscovering: false,
  lastUpdated: 0,
};

// Listeners for tool updates (used to notify UI)
const toolUpdateListeners: Set<(tools: WebMCPTool[]) => void> = new Set();

/**
 * Get current WebMCP tools state (immutable copy)
 */
export function getWebMCPState(): WebMCPToolsState {
  return { ...state, tools: [...state.tools] };
}

/**
 * Get WebMCP tools for the active tab
 */
export function getActiveTabWebMCPTools(): WebMCPTool[] {
  return [...state.tools];
}

/**
 * Register tools from a tab (called by content script via message handler)
 * Only accepts tools from the active tab
 */
export function registerWebMCPTools(
  tabId: number,
  domain: string,
  tools: WebMCPTool[]
): void {
  // Only accept tools from the active tab
  if (tabId !== state.activeTabId) {
    log.debug('Ignoring tools from non-active tab', {
      tabId,
      activeTabId: state.activeTabId,
    });
    return;
  }

  log.info('Registering WebMCP tools', {
    tabId,
    domain,
    count: tools.length,
    tools: tools.map((t) => t.name),
  });

  state = {
    ...state,
    tools,
    activeDomain: domain,
    isDiscovering: false,
    lastUpdated: Date.now(),
  };

  // Notify listeners
  notifyToolUpdateListeners();
}


/**
 * Clear WebMCP tools (called on tab switch or close)
 */
export function clearWebMCPTools(): void {
  log.info('Clearing WebMCP tools');
  state = {
    ...state,
    tools: [],
    activeDomain: null,
    isDiscovering: false,
    lastUpdated: Date.now(),
  };
  notifyToolUpdateListeners();
}

/**
 * Set active tab and request tools discovery
 */
export async function setActiveTab(tabId: number): Promise<void> {
  if (state.activeTabId === tabId) return;

  log.info('Active tab changed', { from: state.activeTabId, to: tabId });

  // Clear existing tools
  clearWebMCPTools();

  // Update active tab
  state = {
    ...state,
    activeTabId: tabId,
    isDiscovering: true,
  };

  // Request tools from the new active tab
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'webmcp/tools/refresh' });
  } catch (error) {
    // Tab might not have content script or WebMCP - this is expected
    log.debug('Could not request tools from tab', { tabId });
  }

  state.isDiscovering = false;
}

/**
 * Execute a WebMCP tool on the active tab
 */
export async function executeWebMCPTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const tool = state.tools.find((t) => t.name === toolName);

  if (!tool) {
    return { success: false, error: `WebMCP tool not found: ${toolName}` };
  }

  if (!state.activeTabId) {
    return { success: false, error: 'No active tab' };
  }

  const requestId = crypto.randomUUID();

  log.info('Executing WebMCP tool', {
    toolName,
    originalName: tool.originalName,
    tabId: state.activeTabId,
    requestId,
  });

  try {
    const response = await chrome.tabs.sendMessage(state.activeTabId, {
      type: 'webmcp/tool/execute',
      toolName: tool.name,
      originalToolName: tool.originalName,
      args,
      requestId,
    });

    if (response?.success) {
      log.info('WebMCP tool executed successfully', { toolName, requestId });
    } else {
      log.warn('WebMCP tool execution failed', {
        toolName,
        requestId,
        error: response?.error,
      });
    }

    return response || { success: false, error: 'No response from content script' };
  } catch (error) {
    log.error('Failed to execute WebMCP tool', { toolName, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    };
  }
}

/**
 * Subscribe to tool updates
 * Returns unsubscribe function
 */
export function onToolsUpdate(
  callback: (tools: WebMCPTool[]) => void
): () => void {
  toolUpdateListeners.add(callback);
  return () => toolUpdateListeners.delete(callback);
}

/**
 * Notify all listeners of tool updates
 */
function notifyToolUpdateListeners(): void {
  const tools = [...state.tools];

  // Notify registered listeners
  toolUpdateListeners.forEach((listener) => {
    try {
      listener(tools);
    } catch (error) {
      log.error('Tool update listener error', { error });
    }
  });

  // Broadcast to all extension contexts (sidepanel, popup, etc.)
  try {
    chrome.runtime.sendMessage({
      type: 'webmcp/tools/updated',
      tools,
    }).catch(() => {
      // Ignore errors when no listeners are available
    });
  } catch {
    // Ignore errors when no listeners are available
  }
}


/**
 * Initialize WebMCP manager
 * Sets up Chrome event listeners for tab tracking
 */
export function initializeWebMCPManager(): void {
  // Track active tab changes
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      await setActiveTab(activeInfo.tabId);
    } catch (error) {
      log.error('Error handling tab activation', { error });
    }
  });

  // Track tab closes
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === state.activeTabId) {
      log.info('Active tab closed, clearing tools');
      clearWebMCPTools();
      state.activeTabId = null;
    }
  });

  // Track tab URL changes (navigation)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (tabId === state.activeTabId && changeInfo.status === 'complete') {
      // Page reloaded or navigated - clear and re-discover
      log.info('Active tab navigated, re-discovering tools');
      clearWebMCPTools();
      state.isDiscovering = true;

      try {
        await chrome.tabs.sendMessage(tabId, { type: 'webmcp/tools/refresh' });
      } catch {
        // Content script might not be ready yet - this is expected
      }

      state.isDiscovering = false;
    }
  });

  // Initialize with current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (chrome.runtime.lastError) {
      log.warn('Error querying active tab', {
        error: chrome.runtime.lastError.message,
      });
      return;
    }

    if (tabs[0]?.id) {
      try {
        await setActiveTab(tabs[0].id);
      } catch (error) {
        log.error('Error setting initial active tab', { error });
      }
    }
  });

  log.info('WebMCP Manager initialized');
}
