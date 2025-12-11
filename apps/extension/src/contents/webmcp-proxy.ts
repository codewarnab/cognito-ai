/**
 * WebMCP Proxy Content Script
 *
 * Discovers WebMCP tools from the current page and relays them to the background service.
 * This content script:
 * 1. Connects to any WebMCP server on the page via TabClientTransport
 * 2. Reports discovered tools to the background script
 * 3. Executes tool calls from the background and returns results
 *
 * Only runs on the main frame, not iframes.
 */

import type { PlasmoCSConfig } from 'plasmo';
import { TabClientTransport } from '@mcp-b/transports';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import type { WebMCPTool } from '@/types/webmcp';

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  all_frames: false,
  run_at: 'document_idle',
};

// Module state
let client: Client | null = null;
let transport: TabClientTransport | null = null;
let isConnected = false;
let currentTabId: number | null = null;
let connectionAttempted = false;

// Rate limiting for tool execution
const toolExecutionTimestamps = new Map<string, number>();
const RATE_LIMIT_MS = 100;

/**
 * Extract domain from URL for tool naming
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    // Include port for localhost to differentiate dev servers
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `localhost${urlObj.port ? '_' + urlObj.port : ''}`;
    }
    return hostname.replace(/\./g, '_');
  } catch {
    return 'unknown';
  }
}

/**
 * Get the favicon URL for the current page
 */
function getFaviconUrl(): string | undefined {
  // Try to find favicon from link tags
  const iconLink = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  );
  if (iconLink?.href) {
    return iconLink.href;
  }

  // Fallback to default favicon location
  try {
    return new URL('/favicon.ico', window.location.origin).href;
  } catch {
    return undefined;
  }
}

/**
 * Sanitize tool name for safe use in our system
 * Only allows alphanumeric and underscore, max 64 chars
 */
function sanitizeToolName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
    .slice(0, 64);
}

/**
 * Validate and sanitize tool arguments
 */
function validateToolArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return {};
  }
  // Deep clone to prevent prototype pollution
  try {
    return JSON.parse(JSON.stringify(args));
  } catch {
    return {};
  }
}


/**
 * Check if tool execution is rate limited
 */
function isRateLimited(toolName: string): boolean {
  const lastExecution = toolExecutionTimestamps.get(toolName) || 0;
  const now = Date.now();

  if (now - lastExecution < RATE_LIMIT_MS) {
    return true;
  }

  toolExecutionTimestamps.set(toolName, now);
  return false;
}

/**
 * Send discovered tools to background service
 */
async function sendToolsToBackground(tools: WebMCPTool[]): Promise<void> {
  if (currentTabId === null) {
    console.debug('[WebMCP Proxy] No tab ID, cannot send tools');
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'webmcp/tools/register',
      tools,
      tabId: currentTabId,
      domain: extractDomain(window.location.href),
      url: window.location.href,
    });
    console.debug('[WebMCP Proxy] Sent tools to background:', tools.length);
  } catch (error) {
    // Extension context may be invalidated
    console.debug('[WebMCP Proxy] Failed to send tools:', error);
  }
}

/**
 * Fetch tools from the page's WebMCP server and report to background
 */
async function fetchAndReportTools(): Promise<void> {
  if (!client || !isConnected) {
    console.debug('[WebMCP Proxy] Not connected, cannot fetch tools');
    return;
  }

  try {
    const result = await client.listTools();
    const domain = extractDomain(window.location.href);

    const favicon = getFaviconUrl();
    const webmcpTools: WebMCPTool[] = result.tools.map((tool) => ({
      ...tool,
      originalName: tool.name,
      name: `webmcp_${sanitizeToolName(domain)}_${sanitizeToolName(tool.name)}`,
      domain,
      tabId: currentTabId!,
      url: window.location.href,
      favicon,
    }));

    await sendToolsToBackground(webmcpTools);
    console.log('[WebMCP Proxy] Discovered tools:', webmcpTools.map((t) => t.originalName));
  } catch (error) {
    console.debug('[WebMCP Proxy] Failed to fetch tools:', error);
    // Send empty tools on error to clear any stale tools
    await sendToolsToBackground([]);
  }
}

/**
 * Execute a tool call from the background service
 */
async function executeTool(
  originalToolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  if (!client || !isConnected) {
    return { success: false, error: 'WebMCP client not connected' };
  }

  // Rate limit check
  if (isRateLimited(originalToolName)) {
    return { success: false, error: 'Tool execution rate limited' };
  }

  // Validate arguments
  const validatedArgs = validateToolArgs(args);

  try {
    console.log('[WebMCP Proxy] Executing tool:', originalToolName, validatedArgs);

    const result = await client.callTool({
      name: originalToolName,
      arguments: validatedArgs,
    });

    console.log('[WebMCP Proxy] Tool result:', originalToolName);
    return { success: true, result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WebMCP Proxy] Tool execution failed:', originalToolName, errorMessage);
    return { success: false, error: errorMessage };
  }
}


/**
 * Attempt to connect to the page's WebMCP server
 */
async function attemptConnection(): Promise<void> {
  if (connectionAttempted) {
    console.debug('[WebMCP Proxy] Connection already attempted');
    return;
  }

  connectionAttempted = true;

  // Skip pages that shouldn't have WebMCP
  const url = window.location.href;
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://')
  ) {
    console.debug('[WebMCP Proxy] Skipping protected page');
    return;
  }

  try {
    client = new Client({
      name: 'ChromeAI-WebMCP-Proxy',
      version: '1.0.0',
    });

    transport = new TabClientTransport({
      targetOrigin: window.location.origin,
    });

    // Handle transport close
    transport.onclose = () => {
      console.log('[WebMCP Proxy] Transport closed');
      isConnected = false;
      client = null;
      transport = null;
      // Notify background that tools are gone
      sendToolsToBackground([]);
    };

    // Attempt connection with timeout
    const connectionPromise = client.connect(transport);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    await Promise.race([connectionPromise, timeoutPromise]);

    isConnected = true;
    console.log('[WebMCP Proxy] Connected to page WebMCP server');

    // Get server capabilities
    const capabilities = client.getServerCapabilities?.() || {};

    // Initial tool fetch
    await fetchAndReportTools();

    // Listen for tool list changes if supported
    if (capabilities?.tools?.listChanged) {
      client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
        console.log('[WebMCP Proxy] Tool list changed notification');
        await fetchAndReportTools();
      });
    }
  } catch (error) {
    // Most pages won't have WebMCP - this is expected
    console.debug('[WebMCP Proxy] No WebMCP server on this page (expected for most sites)');
    isConnected = false;
    client = null;
    transport = null;
  }
}

/**
 * Clean up resources
 */
function cleanup(): void {
  if (transport) {
    try {
      transport.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  client = null;
  transport = null;
  isConnected = false;
  connectionAttempted = false;
}

/**
 * Handle messages from background service
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle tool execution request
  if (message.type === 'webmcp/tool/execute') {
    const { originalToolName, args, requestId } = message;

    executeTool(originalToolName, args || {})
      .then((result) => {
        sendResponse({
          type: 'webmcp/tool/result',
          requestId,
          ...result,
        });
      })
      .catch((error) => {
        sendResponse({
          type: 'webmcp/tool/result',
          requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    return true; // Async response
  }

  // Handle tools refresh request
  if (message.type === 'webmcp/tools/refresh') {
    if (isConnected) {
      fetchAndReportTools()
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
    } else {
      // Try to connect if not already connected
      attemptConnection()
        .then(() => sendResponse({ success: isConnected }))
        .catch(() => sendResponse({ success: false }));
    }
    return true; // Async response
  }

  return false;
});

/**
 * Initialize the WebMCP proxy
 */
async function initialize(): Promise<void> {
  try {
    // Get current tab ID from background
    const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_ID' });

    if (response?.tabId) {
      currentTabId = response.tabId;
      console.debug('[WebMCP Proxy] Initialized with tab ID:', currentTabId);

      // Attempt connection after a short delay to let page scripts initialize
      setTimeout(() => {
        attemptConnection();
      }, 1000);
    } else {
      console.debug('[WebMCP Proxy] Could not get tab ID');
    }
  } catch (error) {
    // Extension context may not be ready
    console.debug('[WebMCP Proxy] Initialization error:', error);
  }
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);

// Handle visibility changes (tab becomes hidden/visible)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isConnected) {
    // Refresh tools when tab becomes visible
    fetchAndReportTools();
  }
});

// Start initialization
initialize();
