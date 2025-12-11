/**
 * WebMCP Message Handler
 *
 * Handles all WebMCP-related messages (type starts with 'webmcp/')
 */

import { createLogger } from '~logger';
import {
  registerWebMCPTools,
  executeWebMCPTool,
  getActiveTabWebMCPTools,
  getWebMCPState,
} from '../webmcp/manager';
import { WEBMCP_DISABLED_TOOLS_KEY, type WebMCPTool } from '@/types/webmcp';

const log = createLogger('WebMCP-Handler', 'WEBMCP');

/**
 * Get list of disabled WebMCP tool names from storage
 */
async function getDisabledTools(): Promise<string[]> {
  try {
    const result = await chrome.storage.local.get(WEBMCP_DISABLED_TOOLS_KEY);
    const disabled = result[WEBMCP_DISABLED_TOOLS_KEY];
    return Array.isArray(disabled) ? disabled : [];
  } catch (error) {
    log.warn('Failed to get disabled tools from storage', { error });
    return [];
  }
}

/**
 * Check if a message is a WebMCP message
 */
export function isWebMCPMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof (message as { type: unknown }).type === 'string' &&
    (message as { type: string }).type.startsWith('webmcp/')
  );
}

/**
 * Handle WebMCP-related messages
 */
export async function handleWebMCPMessage(
  message: { type: string; [key: string]: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  const tabId = sender.tab?.id;

  log.debug('Handling WebMCP message', { type: message.type, tabId });

  try {
    switch (message.type) {
      case 'webmcp/tools/register': {
        if (!tabId) {
          sendResponse({ success: false, error: 'No tab ID in sender' });
          return;
        }

        const tools = message.tools as WebMCPTool[];
        const domain = message.domain as string;

        if (!Array.isArray(tools)) {
          sendResponse({ success: false, error: 'Invalid tools array' });
          return;
        }

        registerWebMCPTools(tabId, domain, tools);

        log.info('WebMCP tools registered', {
          tabId,
          domain,
          count: tools.length,
        });

        sendResponse({ success: true });
        break;
      }

      case 'webmcp/tools/list': {
        const allTools = getActiveTabWebMCPTools();
        const disabledTools = await getDisabledTools();
        
        // Filter out disabled tools for AI consumption
        const enabledTools = allTools.filter(
          (tool) => !disabledTools.includes(tool.name)
        );
        
        log.debug('Returning WebMCP tools list', {
          total: allTools.length,
          enabled: enabledTools.length,
          disabled: disabledTools.length,
        });
        
        sendResponse({ success: true, data: { tools: enabledTools } });
        break;
      }

      case 'webmcp/tools/state': {
        const state = getWebMCPState();
        sendResponse({ success: true, data: state });
        break;
      }

      case 'webmcp/tools/discover': {
        // Force discovery on the active tab
        const state = getWebMCPState();
        if (!state.activeTabId) {
          // Try to get the active tab
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.id) {
            const { setActiveTab } = await import('../webmcp/manager');
            await setActiveTab(activeTab.id);
          }
        }
        
        // Send refresh request to the active tab
        if (state.activeTabId) {
          try {
            await chrome.tabs.sendMessage(state.activeTabId, { type: 'webmcp/tools/refresh' });
            log.info('Triggered WebMCP discovery on active tab', { tabId: state.activeTabId });
            sendResponse({ success: true, tabId: state.activeTabId });
          } catch (err) {
            log.debug('Could not trigger discovery - content script may not be ready', { error: err });
            sendResponse({ success: false, error: 'Content script not available' });
          }
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
        break;
      }

      case 'webmcp/tool/call': {
        const payload = message.payload as {
          toolName?: string;
          args?: Record<string, unknown>;
        } | undefined;

        const toolName = payload?.toolName;
        const args = payload?.args || {};

        if (!toolName) {
          sendResponse({ success: false, error: 'Tool name required' });
          return;
        }

        log.info('Executing WebMCP tool call', { toolName });

        const result = await executeWebMCPTool(toolName, args);
        sendResponse(result);
        break;
      }

      default:
        log.warn('Unknown WebMCP message type', { type: message.type });
        sendResponse({
          success: false,
          error: `Unknown WebMCP action: ${message.type}`,
        });
    }
  } catch (error) {
    log.error('Error handling WebMCP message', {
      type: message.type,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
