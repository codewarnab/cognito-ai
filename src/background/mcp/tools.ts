/**
 * MCP Tools Module
 * 
 * Handles tool discovery, health checks, and tool execution for MCP servers.
 */

import { McpSSEClient } from '../../mcp/sseClient';
import type { McpExtensionResponse, McpTool } from '../../mcp/types';
import { getServerState, getServerConfig, serverStates } from '../../mcp/state';
import { ensureValidToken, refreshServerToken } from '../../mcp/authHelpers';
import { MCP_OAUTH_CONFIG } from '@constants';
import { MCP_SERVERS } from '@constants/mcpServers';
import { createLogger } from '~logger';

const mcpLog = createLogger('Background-MCP', 'MCP_CLIENT');
const backgroundLog = createLogger('Background', 'BACKGROUND');

/**
 * Get available tools for a server
 */
export async function getServerTools(serverId: string): Promise<McpTool[]> {
    const state = getServerState(serverId);
    return state.status?.tools || [];
}

/**
 * Perform health check on MCP server
 * Validates connection and retrieves available tools
 * Uses custom SSE client that supports both Streamable HTTP and HTTP+SSE transports
 */
export async function performHealthCheck(serverId: string): Promise<McpExtensionResponse> {
    let healthCheckClient: McpSSEClient | undefined = undefined;
    const serverConfig = getServerConfig(serverId);

    if (!serverConfig || !serverConfig.url) {
        return {
            success: false,
            error: 'Server configuration not found'
        };
    }

    try {
        mcpLog.info(`[${serverId}] Performing MCP health check with custom client`);

        let accessToken: string | null = null;
        if (serverConfig.requiresAuthentication) {
            accessToken = await ensureValidToken(serverId, refreshServerToken);
            if (!accessToken) {
                return {
                    success: false,
                    error: 'No valid access token available'
                };
            }
        } else {
            accessToken = '';
            mcpLog.info(`[${serverId}] Server does not require authentication, performing health check without token`);
        }

        try {
            healthCheckClient = new McpSSEClient(
                `${serverId}-health`,
                serverConfig.url,
                accessToken,
                {
                    onStatusChange: (status) => {
                        mcpLog.info(`[${serverId}] Health check status:`, status.state);
                    },
                    onMessage: (_message) => {
                        // Ignore messages during health check
                    }
                },
                {
                    reconnectMinDelay: MCP_OAUTH_CONFIG.RECONNECT_MIN_DELAY,
                    reconnectMaxDelay: MCP_OAUTH_CONFIG.RECONNECT_MAX_DELAY,
                    reconnectMultiplier: MCP_OAUTH_CONFIG.RECONNECT_MULTIPLIER
                }
            );

            mcpLog.info(`[${serverId}] Connecting to MCP server (auto-detect transport)...`);

            await healthCheckClient.connect();
            mcpLog.info(`[${serverId}] Connected successfully`);

            await healthCheckClient.initialize();
            mcpLog.info(`[${serverId}] Initialized successfully`);

            const status = healthCheckClient.getStatus();
            mcpLog.info(`[${serverId}] Server status:`, status);

            healthCheckClient.disconnect();

            if (status.tools && status.tools.length > 0) {
                mcpLog.info(`[${serverId}] Health check passed. Tools available:`, status.tools.length);

                return {
                    success: true,
                    data: {
                        state: 'connected',
                        tools: status.tools,
                        toolCount: status.tools.length
                    }
                };
            } else {
                return {
                    success: false,
                    error: 'No tools available from server'
                };
            }
        } catch (transportError) {
            mcpLog.error(`[${serverId}] Health check failed:`, transportError);

            if (healthCheckClient) {
                try {
                    (healthCheckClient as McpSSEClient).disconnect();
                } catch (closeError) {
                    mcpLog.error(`[${serverId}] Error closing client:`, closeError);
                }
            }

            return {
                success: false,
                error: transportError instanceof Error ? transportError.message : 'Connection failed'
            };
        }
    } catch (error) {
        mcpLog.error(`[${serverId}] Health check error:`, error);

        if (healthCheckClient) {
            try {
                (healthCheckClient as McpSSEClient).disconnect();
            } catch (closeError) {
                mcpLog.error(`[${serverId}] Error closing client:`, closeError);
            }
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Health check failed'
        };
    }
}

/**
 * Get all available tools from persistent MCP connections
 */
export async function getAllMCPTools(): Promise<McpExtensionResponse> {
    const allTools: any[] = [];

    try {
        for (const [serverId, state] of serverStates) {
            if (state.isEnabled && state.client && state.status.state === 'connected') {
                try {
                    const toolsList = await state.client.listTools();

                    if (toolsList && toolsList.tools) {
                        const serverTools = toolsList.tools.map((tool: any) => ({
                            ...tool,
                            serverId,
                            serverName: getServerConfig(serverId)?.name || serverId
                        }));

                        allTools.push(...serverTools);
                        mcpLog.info(`[${serverId}] Added ${serverTools.length} tools`);
                    }
                } catch (error) {
                    mcpLog.error(`[${serverId}] Error listing tools:`, error);
                }
            }
        }

        backgroundLog.info(` Total MCP tools available: ${allTools.length}`);
        return { success: true, data: { tools: allTools } };
    } catch (error) {
        backgroundLog.error(' Error getting all MCP tools:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get MCP tools'
        };
    }
}

/**
 * Call an MCP tool on any server
 */
export async function callServerTool(serverId: string, name: string, args?: Record<string, any>): Promise<McpExtensionResponse> {
    const state = getServerState(serverId);

    if (!state.client) {
        return { success: false, error: 'Not connected' };
    }

    try {
        const result = await state.client.callTool(name, args);
        return { success: true, data: result };
    } catch (error) {
        mcpLog.error(`[${serverId}] Tool call error:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Tool call failed'
        };
    }
}

/**
 * Get MCP server configurations for frontend
 */
export async function getMCPServerConfigs(): Promise<any[]> {
    backgroundLog.info(' getMCPServerConfigs called');
    const servers = [];

    try {
        backgroundLog.info(` Processing ${MCP_SERVERS.length} server configs`);

        for (const serverConfig of MCP_SERVERS) {
            const serverId = serverConfig.id;
            const state = getServerState(serverId);

            mcpLog.info(`[${serverId}] Checking server configuration:`, {
                name: serverConfig.name,
                url: serverConfig.url,
                hasTokens: !!state.tokens,
                hasAccessToken: !!state.tokens?.access_token,
                currentStatus: state.status.state
            });

            const { [`mcp.${serverId}.enabled`]: isEnabled } = await chrome.storage.local.get(`mcp.${serverId}.enabled`);
            mcpLog.info(`[${serverId}] Enabled status from storage:`, isEnabled);

            const serverType = serverConfig.url?.endsWith('/sse') ? 'sse' : 'mcp';

            const shouldAddServer = isEnabled && serverConfig.url && (
                !serverConfig.requiresAuthentication ||
                (serverConfig.requiresAuthentication && state.tokens?.access_token)
            );

            if (shouldAddServer) {
                mcpLog.info(`[${serverId}] ✓ Adding server to frontend config`);

                const headers = [
                    { key: 'Accept', value: 'application/json, text/event-stream' }
                ];

                if (serverConfig.requiresAuthentication && state.tokens?.access_token) {
                    headers.unshift({ key: 'Authorization', value: `Bearer ${state.tokens.access_token}` });
                }

                servers.push({
                    id: serverId,
                    name: serverConfig.name,
                    url: serverConfig.url,
                    type: serverType,
                    headers,
                    enabled: true,
                    status: state.status
                });

                mcpLog.info(`[${serverId}] ${serverConfig.name} configured for frontend (requiresAuth: ${serverConfig.requiresAuthentication})`);
            } else {
                mcpLog.info(`[${serverId}] ✗ Not adding to config - Conditions not met:`, {
                    isEnabled,
                    requiresAuthentication: serverConfig.requiresAuthentication,
                    hasAccessToken: !!state.tokens?.access_token,
                    hasUrl: !!serverConfig.url
                });
            }
        }

        backgroundLog.info(` Returning ${servers.length} configured server(s)`);
    } catch (error) {
        backgroundLog.error(' Error getting MCP server configs:', error);
    }

    return servers;
}
