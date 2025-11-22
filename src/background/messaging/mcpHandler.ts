/**
 * MCP Message Handler
 * 
 * Handles all MCP-related messages (type starts with 'mcp/')
 */

import { createLogger } from '~logger';
import type { McpExtensionResponse } from '../../mcp/types';
import { getServerState } from '../../mcp/state';
import { getDisabledTools, setDisabledTools } from '../../mcp/toolsConfig';
import { refreshServerToken } from '../../mcp/authHelpers';
import { startOAuthFlow, disconnectServerAuth } from '../mcp/auth';
import { enableMcpServer, disableMcpServer } from '../mcp/manager';
import { performHealthCheck, getAllMCPTools, getServerTools, callServerTool, getMCPServerConfigs } from '../mcp/tools';

const backgroundLog = createLogger('Background-MCP-Handler', 'BACKGROUND');
const mcpLog = createLogger('Background-MCP', 'MCP_CLIENT');

/**
 * Get current MCP server status
 */
function getServerStatus(serverId: string) {
    const state = getServerState(serverId);
    return state.status;
}

/**
 * Handle all MCP-related messages
 */
export async function handleMcpMessage(
    message: any,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
): Promise<void> {
    // Handle tools list request - get all tools from persistent connections
    if (message.type === 'mcp/tools/list') {
        try {
            const result = await getAllMCPTools();
            backgroundLog.info(' Sending MCP tools list:', result);
            sendResponse(result);
        } catch (error) {
            backgroundLog.error(' Error getting MCP tools:', error);
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get MCP tools'
            });
        }
        return;
    }

    // Handle servers list request
    if (message.type === 'mcp/servers/get') {
        try {
            const servers = await getMCPServerConfigs();
            backgroundLog.info(' Sending MCP server configs:', servers);
            sendResponse({ success: true, data: servers });
        } catch (error) {
            backgroundLog.error(' Error getting MCP server configs:', error);
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get server configs'
            });
        }
        return;
    }

    // Handle server-specific messages (format: mcp/{serverId}/{action})
    const parts = message.type.split('/');
    if (parts.length < 3) {
        sendResponse({ success: false, error: 'Invalid message format' });
        return;
    }

    const serverId = parts[1];
    const action = parts.slice(2).join('/');

    let response: McpExtensionResponse;

    backgroundLog.info(` Handling MCP message for ${serverId}:`, action);

    switch (action) {
        case 'auth/start':
            response = await startOAuthFlow(serverId);
            break;

        case 'enable':
            response = await enableMcpServer(serverId);
            break;

        case 'disable':
            response = await disableMcpServer(serverId);
            break;

        case 'disconnect':
            response = await disconnectServerAuth(serverId);
            break;

        case 'status/get':
            response = { success: true, data: getServerStatus(serverId) };
            break;

        case 'auth/refresh':
            const refreshed = await refreshServerToken(serverId);
            response = refreshed
                ? { success: true, data: { state: 'authenticated' } }
                : { success: false, error: 'Token refresh failed' };
            break;

        case 'tool/call':
            response = await callServerTool(
                serverId,
                message.payload?.name,
                message.payload?.arguments
            );
            break;

        case 'health/check':
            response = await performHealthCheck(serverId);
            break;

        case 'tools/list':
            const tools = await getServerTools(serverId);
            response = { success: true, data: tools };
            break;

        case 'tools/config/get':
            const disabledTools = await getDisabledTools(serverId);
            response = { success: true, data: disabledTools };
            break;

        case 'tools/config/set':
            await setDisabledTools(serverId, message.payload?.disabledTools || []);
            response = { success: true };
            break;

        default:
            response = { success: false, error: `Unknown action: ${action}` };
    }

    mcpLog.info(`[${serverId}] Sending MCP response:`, response);
    sendResponse(response);
}
