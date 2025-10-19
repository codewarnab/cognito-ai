/**
 * MCP Client Manager for AI SDK v5
 * Handles dynamic MCP server connections and tool integration
 */

import { experimental_createMCPClient as createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLogger } from '../logger';

const log = createLogger('MCP-Client');

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  type: 'sse' | 'http';
  headers?: KeyValuePair[];
  enabled?: boolean;
  sessionId?: string; // For session persistence and reconnection
}

export interface MCPClientManager {
  tools: Record<string, any>;
  clients: any[];
  cleanup: () => Promise<void>;
  sessionIds: Map<string, string>; // Track session IDs for persistence
}

/**
 * Load stored session ID for a server from chrome.storage
 */
async function getStoredSessionId(serverId: string): Promise<string | undefined> {
  try {
    const result = await chrome.storage.local.get(`mcp.${serverId}.sessionId`);
    return result[`mcp.${serverId}.sessionId`];
  } catch (error) {
    log.warn(`⚠️ Failed to load session ID for ${serverId}:`, error);
    return undefined;
  }
}

/**
 * Get enabled MCP server configurations from background script
 * This ensures we get the most up-to-date configurations and tokens
 */
async function getEnabledMCPServers(): Promise<MCPServerConfig[]> {
  const servers: MCPServerConfig[] = [];

  log.info('Requesting enabled MCP server configs from background script...');
  try {
    // Request server configurations from background script
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'mcp/servers/get' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    log.info('Received MCP server configs from background:', response);

    if (response.success && response.data) {
      // Convert background server configs to our format
      for (const server of response.data) {
        log.info(`Retrieved MCP server config: ${server.name}`, {
          id: server.id,
          type: server.type,
          url: server.url,
          enabled: server.enabled
        });
        if (server.enabled) {
          servers.push({
            id: server.id,
            name: server.name,
            url: server.url,
            type: server.type,
            headers: server.headers,
            enabled: server.enabled,
            sessionId: server.sessionId
          });

          log.info(`✅ MCP server configured: ${server.name}`, {
            id: server.id,
            type: server.type,
            url: server.url
          });
        }
      }
    } else {
      log.warn('⚠️ Failed to get MCP server configs from background:', response.error);
    }

  } catch (error) {
    log.error('Error getting enabled MCP servers from background:', error);
  }

  return servers;
}

/**
 * Initialize MCP clients for AI SDK
 * This creates connections to enabled MCP servers and retrieves their tools
 */
export async function initializeMCPClients(
  abortSignal?: AbortSignal
): Promise<MCPClientManager> {
  log.info('🚀 Initializing MCP clients...');

  // Initialize tools and clients
  let tools = {};
  const mcpClients: any[] = [];
  const sessionIds = new Map<string, string>(); // Track session IDs

  try {
    // Get enabled MCP server configurations
    const mcpServers = await getEnabledMCPServers();

    log.info('📋 Found MCP servers:', {
      count: mcpServers.length,
      servers: mcpServers.map(s => ({ id: s.id, name: s.name, type: s.type }))
    });

    // Process each MCP server configuration
    for (const mcpServer of mcpServers) {
      if (!mcpServer.enabled) {
        log.info(`⏭️ Skipping disabled server: ${mcpServer.name}`);
        continue;
      }

      try {
        log.info(`🔌 Connecting to MCP server: ${mcpServer.name} (${mcpServer.type})`);

        // Load stored session ID if available
        if (!mcpServer.sessionId) {
          mcpServer.sessionId = await getStoredSessionId(mcpServer.id);
          if (mcpServer.sessionId) {
            log.info(`🔄 Loaded stored session ID for ${mcpServer.name}: ${mcpServer.sessionId}`);
          }
        }

        // Convert headers array to object
        const headers = mcpServer.headers?.reduce((acc, header) => {
          if (header.key) acc[header.key] = header.value || '';
          return acc;
        }, {} as Record<string, string>);

        log.info(`📡 Transport config:`, {
          type: mcpServer.type,
          url: mcpServer.url,
          hasHeaders: !!headers,
          headerKeys: Object.keys(headers || {})
        });

        // Dynamically determine transport type based on URL suffix
        let mcpClient;
        const url = mcpServer.url;

        if (url.endsWith('/sse')) {
          log.info(`🔧 Creating MCP client with SSE transport`);
          mcpClient = await createMCPClient({
            transport: {
              type: 'sse',
              url: url,
              headers,
            }
          });
        } else if (url.endsWith('/mcp')) {
          log.info(`🔧 Creating MCP client with StreamableHTTP transport`);

          // Create StreamableHTTP transport with advanced features
          const httpTransport = new StreamableHTTPClientTransport(
            new URL(url),
            {
              // Custom request configuration
              requestInit: {
                headers,
                // Add CORS and credentials if needed
                // credentials: 'include',
                // mode: 'cors',
              },

              // Session ID for reconnection support (if available from previous connection)
              sessionId: mcpServer.sessionId,

              // Reconnection options with exponential backoff
              reconnectionOptions: {
                maxReconnectionDelay: 30000, // 30 seconds max
                initialReconnectionDelay: 1000, // 1 second initial
                reconnectionDelayGrowFactor: 1.5, // Exponential backoff factor
                maxRetries: 3, // Maximum retry attempts
              },

              // Custom fetch implementation (if needed for Chrome extension environment)
              // fetch: customFetch,
            }
          );

          // Set up event handlers for better error tracking and debugging
          httpTransport.onerror = (error: Error) => {
            log.error(`❌ Transport error for ${mcpServer.name}:`, error);
            // You could broadcast this error to UI or handle reconnection here
          };

          httpTransport.onclose = () => {
            log.info(`🔌 Transport closed for ${mcpServer.name}`);
            // Clean up or notify UI that connection was closed
          };

          httpTransport.onmessage = (message: any) => {
            log.info(`📨 Message from ${mcpServer.name}:`, message);
            // You can intercept and log messages here if needed
          };

          // Create MCP client with the configured transport
          mcpClient = await createMCPClient({ transport: httpTransport as any });

          // Store session ID for future reconnections (persistence)
          if ((httpTransport as any).sessionId) {
            const sessionId = (httpTransport as any).sessionId;
            sessionIds.set(mcpServer.id, sessionId);
            log.info(`📝 Session ID stored for ${mcpServer.name}: ${sessionId}`);

            // Optionally persist to chrome.storage for long-term persistence
            try {
              await chrome.storage.local.set({
                [`mcp.${mcpServer.id}.sessionId`]: sessionId
              });
              log.info(`💾 Session ID persisted to storage for ${mcpServer.name}`);
            } catch (storageError) {
              log.warn(`⚠️ Failed to persist session ID for ${mcpServer.name}:`, storageError);
            }
          }
        } else {
          log.warn(`⚠️ Skipping ${mcpServer.name}: URL must end with /sse or /mcp`);
          continue;
        }
        mcpClients.push(mcpClient);

        log.info(`✅ MCP client created successfully for ${mcpServer.name}`);

        // Get tools from the MCP server
        const mcpTools = await mcpClient.tools();

        log.info(`✅ MCP tools from ${mcpServer.name}:`, {
          count: Object.keys(mcpTools).length,
          tools: Object.keys(mcpTools)
        });

        // Get disabled tools from storage
        const disabledToolsResult = await chrome.storage.local.get(`mcp.${mcpServer.id}.tools.disabled`);
        const disabledTools: string[] = disabledToolsResult[`mcp.${mcpServer.id}.tools.disabled`] || [];

        log.info(`🔧 Disabled tools for ${mcpServer.name}:`, disabledTools);

        // Log detailed tool information for debugging
        Object.entries(mcpTools).forEach(([toolName, toolDef]: [string, any]) => {
          log.info(`📦 Tool: ${toolName}`, {
            description: toolDef?.description,
            hasExecute: typeof toolDef?.execute === 'function',
            hasInputSchema: !!toolDef?.inputSchema,
            isDisabled: disabledTools.includes(toolName)
          });
        });

        // Filter out disabled tools before adding to tools object
        const filteredTools = Object.entries(mcpTools).reduce((acc, [name, def]) => {
          if (!disabledTools.includes(name)) {
            acc[name] = def;
          }
          return acc;
        }, {} as Record<string, any>);

        log.info(`✅ Filtered MCP tools from ${mcpServer.name}:`, {
          total: Object.keys(mcpTools).length,
          enabled: Object.keys(filteredTools).length,
          disabled: disabledTools.length
        });

        // Add MCP tools directly (AI SDK handles tool naming)
        // Don't prefix the tools - the AI SDK expects the original names
        tools = { ...tools, ...filteredTools };

      } catch (error) {
        log.error(`❌ Failed to initialize MCP client for ${mcpServer.name}:`, error);
        // Continue with other servers instead of failing the entire request
      }
    }

    log.info('🎯 Total MCP tools loaded:', {
      count: Object.keys(tools).length,
      tools: Object.keys(tools)
    });

    // Register cleanup for all clients if an abort signal is provided
    if (abortSignal && mcpClients.length > 0) {
      abortSignal.addEventListener('abort', async () => {
        await cleanupMCPClients(mcpClients);
      });
    }

  } catch (error) {
    log.error('❌ Error initializing MCP clients:', error);
  }

  return {
    tools,
    clients: mcpClients,
    cleanup: async () => await cleanupMCPClients(mcpClients),
    sessionIds
  };
}

/**
 * Clean up MCP clients
 */
async function cleanupMCPClients(clients: any[]): Promise<void> {
  log.info('🧹 Cleaning up MCP clients...', { count: clients.length });

  await Promise.all(
    clients.map(async (client, index) => {
      try {
        // Try different cleanup methods based on client type
        if (client.close) {
          await client.close();
          log.info(`✅ MCP client ${index + 1} closed`);
        } else if (client.disconnect) {
          await client.disconnect();
          log.info(`✅ MCP client ${index + 1} disconnected`);
        } else if (typeof client === 'object' && client.transport?.close) {
          await client.transport.close();
          log.info(`✅ MCP client ${index + 1} transport closed`);
        } else {
          log.warn(`⚠️ MCP client ${index + 1} has no known cleanup method`);
        }
      } catch (error) {
        log.error(`❌ Error cleaning up MCP client ${index + 1}:`, error);
      }
    })
  );

  log.info('✅ MCP client cleanup completed');
}

/**
 * Get current MCP server status
 * Returns information about enabled/disabled servers and their connection status
 */
export async function getMCPStatus(): Promise<{
  servers: Array<{
    id: string;
    name: string;
    enabled: boolean;
    connected: boolean;
    toolCount: number;
  }>;
  totalTools: number;
}> {
  const servers = await getEnabledMCPServers();
  const status = {
    servers: servers.map(server => ({
      id: server.id,
      name: server.name,
      enabled: server.enabled || false,
      connected: false, // TODO: Implement connection status check
      toolCount: 0 // TODO: Implement tool count
    })),
    totalTools: 0
  };

  return status;
}

/**
 * Clear stored session ID for a server
 */
export async function clearSessionId(serverId: string): Promise<void> {
  try {
    await chrome.storage.local.remove(`mcp.${serverId}.sessionId`);
    log.info(`🗑️ Cleared session ID for ${serverId}`);
  } catch (error) {
    log.error(`❌ Failed to clear session ID for ${serverId}:`, error);
  }
}

/**
 * Refresh MCP connections
 * Useful when tokens are updated or servers are enabled/disabled
 */
export async function refreshMCPConnections(): Promise<void> {
  log.info('🔄 Refreshing MCP connections...');

  // This would typically involve:
  // 1. Cleaning up existing connections
  // 2. Re-reading server configurations
  // 3. Re-establishing connections with updated tokens

  // For now, we'll just log that this was called
  // The actual refresh will happen on the next AI request
  log.info('✅ MCP connection refresh requested');
}
