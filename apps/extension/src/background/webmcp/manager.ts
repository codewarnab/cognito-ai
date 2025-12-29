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
 * ## Security
 * 
 * Tool execution includes multiple validation layers:
 * - **Origin validation**: Tool's domain must match the active tab's domain
 * - **Tab ID validation**: Tool must belong to the currently active tab
 * - **Schema validation**: Arguments are validated against the tool's inputSchema
 * 
 * @module background/webmcp
 * @see {@link file://./README.md | WebMCP Module README}
 */

import { createLogger } from '~logger';
import type { WebMCPTool, WebMCPToolsState } from '@/types/webmcp';

const log = createLogger('WebMCP-Manager', 'WEBMCP_MANAGER');

// In-memory state for active tab's WebMCP tools
let state: WebMCPToolsState = {
  tools: [],
  activeTabId: null,
  activeDomain: null,
  activeOrigin: null,
  isDiscovering: false,
  lastUpdated: 0,
};

// Listeners for tool updates (used to notify UI)
const toolUpdateListeners: Set<(tools: WebMCPTool[]) => void> = new Set();

/**
 * Extract origin from URL (protocol + hostname + port)
 * Used to detect same-site navigation vs cross-site navigation
 */
function extractOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.origin;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Security Validation Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that a tool's origin matches the expected domain
 * Prevents tool shadowing attacks where malicious sites register tools
 * with names that match legitimate tools from other domains
 * 
 * @param tool - The WebMCP tool to validate
 * @param expectedDomain - The domain we expect the tool to belong to
 * @returns true if origin is valid, false otherwise
 */
function validateToolOrigin(tool: WebMCPTool, expectedDomain: string | null): boolean {
  if (!expectedDomain) {
    log.warn('Cannot validate tool origin: no expected domain', { toolName: tool.name });
    return false;
  }

  if (tool.domain !== expectedDomain) {
    log.error('Tool origin mismatch - potential security issue', {
      toolName: tool.name,
      toolDomain: tool.domain,
      expectedDomain,
    });
    return false;
  }

  return true;
}

/**
 * Validate that a tool belongs to the expected tab
 * Ensures tools can only be executed on the tab that registered them
 * 
 * @param tool - The WebMCP tool to validate
 * @param expectedTabId - The tab ID we expect the tool to belong to
 * @returns true if tab ID is valid, false otherwise
 */
function validateToolTabId(tool: WebMCPTool, expectedTabId: number | null): boolean {
  if (!expectedTabId) {
    log.warn('Cannot validate tool tab: no expected tab ID', { toolName: tool.name });
    return false;
  }

  if (tool.tabId !== expectedTabId) {
    log.error('Tool tab ID mismatch - potential security issue', {
      toolName: tool.name,
      toolTabId: tool.tabId,
      expectedTabId,
    });
    return false;
  }

  return true;
}

/**
 * Validate arguments against a tool's input schema
 * Ensures only expected parameters are passed to tool execution
 * 
 * @param args - The arguments to validate
 * @param inputSchema - The tool's declared input schema
 * @returns Object with validation result and any errors
 */
function validateArgsAgainstSchema(
  args: Record<string, unknown>,
  inputSchema: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // If no schema defined, allow any args (but log warning)
  if (!inputSchema || typeof inputSchema !== 'object') {
    log.debug('No input schema defined for tool, skipping validation');
    return { valid: true, errors: [] };
  }

  const schema = inputSchema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };

  // Schema must be an object type
  if (schema.type && schema.type !== 'object') {
    errors.push(`Invalid schema type: expected 'object', got '${schema.type}'`);
    return { valid: false, errors };
  }

  const properties = schema.properties || {};
  const required = schema.required || [];

  // Check for required properties
  for (const requiredProp of required) {
    if (!(requiredProp in args) || args[requiredProp] === undefined) {
      errors.push(`Missing required property: ${requiredProp}`);
    }
  }

  // Validate property types
  for (const [key, value] of Object.entries(args)) {
    const propSchema = properties[key] as { type?: string } | undefined;

    // Check for unexpected properties (if additionalProperties is false)
    if (!propSchema && schema.additionalProperties === false) {
      errors.push(`Unexpected property: ${key}`);
      continue;
    }

    // Skip type validation if no schema for this property
    if (!propSchema?.type) continue;

    // Basic type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    const expectedType = propSchema.type;

    // Handle type mismatches (with some flexibility)
    if (expectedType === 'integer' && actualType === 'number') {
      if (!Number.isInteger(value)) {
        errors.push(`Property '${key}' must be an integer, got float`);
      }
    } else if (expectedType === 'number' && actualType !== 'number') {
      errors.push(`Property '${key}' must be a number, got ${actualType}`);
    } else if (expectedType === 'string' && actualType !== 'string') {
      errors.push(`Property '${key}' must be a string, got ${actualType}`);
    } else if (expectedType === 'boolean' && actualType !== 'boolean') {
      errors.push(`Property '${key}' must be a boolean, got ${actualType}`);
    } else if (expectedType === 'array' && actualType !== 'array') {
      errors.push(`Property '${key}' must be an array, got ${actualType}`);
    } else if (expectedType === 'object' && (actualType !== 'object' || value === null)) {
      errors.push(`Property '${key}' must be an object, got ${actualType}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

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
  tools: WebMCPTool[],
  url?: string
): void {
  // Only accept tools from the active tab
  if (tabId !== state.activeTabId) {
    log.debug('Ignoring tools from non-active tab', {
      tabId,
      activeTabId: state.activeTabId,
    });
    return;
  }

  // Extract origin from URL for same-site detection
  const origin = extractOrigin(url);

  log.info('Registering WebMCP tools', {
    tabId,
    domain,
    origin,
    count: tools.length,
    tools: tools.map((t) => t.name),
  });

  state = {
    ...state,
    tools,
    activeDomain: domain,
    activeOrigin: origin ?? state.activeOrigin, // Keep existing origin if not provided
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
    activeOrigin: null,
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

  // Get the tab's URL to extract origin
  let tabOrigin: string | null = null;
  try {
    const tab = await chrome.tabs.get(tabId);
    tabOrigin = extractOrigin(tab.url);
  } catch {
    // Tab might not exist or be accessible
    log.debug('Could not get tab URL for origin', { tabId });
  }

  // Clear existing tools
  clearWebMCPTools();

  // Update active tab with origin
  state = {
    ...state,
    activeTabId: tabId,
    activeOrigin: tabOrigin,
    isDiscovering: true,
  };

  // Request tools from the new active tab
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'webmcp/tools/refresh' });
  } catch {
    // Tab might not have content script or WebMCP - this is expected
    log.debug('Could not request tools from tab', { tabId });
  }

  state.isDiscovering = false;
}

/**
 * Execute a WebMCP tool on the active tab
 * 
 * Security validations performed:
 * 1. Tool exists in current state
 * 2. Tool origin matches active domain (prevents tool shadowing)
 * 3. Tool tab ID matches active tab (prevents cross-tab execution)
 * 4. Arguments match tool's declared inputSchema (prevents injection)
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

  // Security: Validate tool origin matches active domain
  if (!validateToolOrigin(tool, state.activeDomain)) {
    return {
      success: false,
      error: `Security error: Tool origin mismatch. Tool domain '${tool.domain}' does not match active domain '${state.activeDomain}'`,
    };
  }

  // Security: Validate tool belongs to active tab
  if (!validateToolTabId(tool, state.activeTabId)) {
    return {
      success: false,
      error: `Security error: Tool tab mismatch. Tool registered on tab ${tool.tabId} but active tab is ${state.activeTabId}`,
    };
  }

  // Security: Validate arguments against tool's input schema
  const schemaValidation = validateArgsAgainstSchema(args, tool.inputSchema);
  if (!schemaValidation.valid) {
    log.warn('Schema validation failed for WebMCP tool', {
      toolName,
      errors: schemaValidation.errors,
    });
    return {
      success: false,
      error: `Schema validation failed: ${schemaValidation.errors.join(', ')}`,
    };
  }

  const requestId = crypto.randomUUID();

  log.info('Executing WebMCP tool', {
    toolName,
    originalName: tool.originalName,
    tabId: state.activeTabId,
    domain: tool.domain,
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
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tabId !== state.activeTabId) return;

    // Check if this is a navigation that requires re-discovery
    if (changeInfo.status === 'complete') {
      const newOrigin = extractOrigin(tab.url);
      const previousOrigin = state.activeOrigin;

      // Skip refresh if origin hasn't changed (same-site path navigation)
      if (previousOrigin && newOrigin && previousOrigin === newOrigin) {
        log.debug('Same-origin navigation, skipping WebMCP refresh', {
          origin: newOrigin,
          url: tab.url,
        });
        return;
      }

      // Origin changed or first load - clear and re-discover
      log.info('Active tab navigated to new origin, re-discovering tools', {
        from: previousOrigin,
        to: newOrigin,
      });

      // Clear tools but preserve activeTabId
      state = {
        ...state,
        tools: [],
        activeDomain: null,
        activeOrigin: newOrigin,
        isDiscovering: true,
        lastUpdated: Date.now(),
      };
      notifyToolUpdateListeners();

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
