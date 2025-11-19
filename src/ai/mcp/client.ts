/**
 * MCP Client Manager for AI SDK v5
 * Handles dynamic MCP server connections and tool integration
 * 
 * Enhanced with comprehensive error handling:
 * - Per-server error isolation (one server failure doesn't break all)
 * - Connection retry with exponential backoff
 * - Graceful degradation when servers are unavailable
 * - Validation of MCP server responses
 */

import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLogger } from '~logger';
import { MCPError } from '../../errors/errorTypes';
import { RetryManager, RetryPresets } from '../../errors/retryManager';
import { buildUserMessage } from '../../errors/errorMessages';

const log = createLogger('MCP-Client', 'MCP_CLIENT');
const toolsLog = createLogger('MCP-Tools', 'MCP_TOOLS');

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

// /**
//  * Load stored session ID for a server from chrome.storage
//  */
// async function getStoredSessionId(serverId: string): Promise<string | undefined> {
//   try {
//     const result = await chrome.storage.local.get(`mcp.${serverId}.sessionId`);
//     return result[`mcp.${serverId}.sessionId`];
//   } catch (error) {
//     log.warn(`⚠️ Failed to load session ID for ${serverId}:`, error);
//     return undefined;
//   }
// }

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
 * Initialize MCP clients for AI SDK with comprehensive error handling
 * 
 * Error handling features:
 * - Per-server error isolation: One server failure doesn't break all servers
 * - Graceful degradation: Continue loading tools from available servers
 * - Detailed error logging for debugging
 * - Validation of server responses
 * 
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
  const errors: Array<{ serverId: string; serverName: string; error: Error }> = [];

  try {
    // Get enabled MCP server configurations
    const mcpServers = await getEnabledMCPServers();

    log.info('📋 Found MCP servers:', {
      count: mcpServers.length,
      servers: mcpServers.map(s => ({ id: s.id, name: s.name, type: s.type }))
    });

    // Process each MCP server configuration with isolated error handling
    for (const mcpServer of mcpServers) {
      if (!mcpServer.enabled) {
        log.info(`⏭️ Skipping disabled server: ${mcpServer.name}`);
        continue;
      }

      try {
        log.info(`🔌 Connecting to MCP server: ${mcpServer.name} (${mcpServer.type})`);

        // Note: We don't load stored session IDs for new client instances
        // Session IDs should only be used by the background service worker for persistent connections
        // Each frontend client instance gets a fresh session from the server during initialization
        // This prevents "Invalid Request: Initialization requests must not include a sessionId" errors

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

          try {
            // Use RetryManager for connection with automatic retry
            const retryManager = new RetryManager({
              ...RetryPresets.Quick,
              onRetry: (attempt, _delay, _error) => {
                log.info(`🔄 Retrying SSE connection for ${mcpServer.name} (attempt ${attempt})`);
              }
            });

            mcpClient = await retryManager.execute(async () => {
              return await createMCPClient({
                transport: {
                  type: 'sse',
                  url: url,
                  headers,
                }
              });
            });
          } catch (transportError) {
            // Categorize transport creation errors
            const error = MCPError.connectionFailed(
              mcpServer.id,
              `SSE transport creation failed: ${transportError instanceof Error ? transportError.message : 'Unknown error'}`
            );
            errors.push({ serverId: mcpServer.id, serverName: mcpServer.name, error });
            const userMessage = buildUserMessage(error, { serverName: mcpServer.name });
            log.error(`❌ SSE transport error for ${mcpServer.name}: ${userMessage}`, error);
            continue; // Skip to next server
          }
        } else if (url.endsWith('/mcp')) {
          log.info(`🔧 Creating MCP client with StreamableHTTP transport`);

          try {
            // Use RetryManager for connection with automatic retry
            const retryManager = new RetryManager({
              ...RetryPresets.Standard,
              onRetry: (attempt, _delay, _error) => {
                log.info(`🔄 Retrying HTTP connection for ${mcpServer.name} (attempt ${attempt})`);
              }
            });

            const httpTransport = await retryManager.execute(async () => {
              // Create StreamableHTTP transport with advanced features
              const transport = new StreamableHTTPClientTransport(
                new URL(url),
                {
                  // Custom request configuration
                  requestInit: {
                    headers,
                    // Add CORS and credentials if needed
                    // credentials: 'include',
                    // mode: 'cors',
                  },

                  // DO NOT pass sessionId during initialization - let server assign a fresh one
                  // Session IDs are only for reconnection after disconnect, not initial connection
                  sessionId: undefined,

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

              return transport;
            });

            // Set up event handlers for better error tracking and debugging
            httpTransport.onerror = (error: Error) => {
              // Detect Cloudflare Worker errors (Error 1101)
              const errorMessage = error.message?.toLowerCase() || '';
              const isCloudflareWorkerError =
                errorMessage.includes('worker threw exception') ||
                errorMessage.includes('error 1101') ||
                errorMessage.includes('cloudflare');

              const mcpError = isCloudflareWorkerError
                ? MCPError.cloudflareWorkerError(
                  mcpServer.id,
                  `Cloudflare Worker error: ${error.message}`
                )
                : MCPError.connectionFailed(
                  mcpServer.id,
                  `Transport error: ${error.message}`
                );

              const userMessage = buildUserMessage(mcpError, { serverName: mcpServer.name });
              log.error(`❌ Transport error for ${mcpServer.name}: ${userMessage}`, error);
              // Error is logged but connection continues via retry logic
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
                // Non-critical error, continue
              }
            }
          } catch (transportError) {
            // Categorize transport creation errors
            const errorMessage = (transportError instanceof Error ? transportError.message : 'Unknown error').toLowerCase();
            const isCloudflareError =
              errorMessage.includes('worker threw exception') ||
              errorMessage.includes('error 1101') ||
              errorMessage.includes('cloudflare') ||
              (transportError instanceof Error && transportError.message?.includes('<title>'));

            const error = isCloudflareError
              ? MCPError.cloudflareWorkerError(
                mcpServer.id,
                `Cloudflare Worker error: ${transportError instanceof Error ? transportError.message : 'Unknown error'}`
              )
              : MCPError.connectionFailed(
                mcpServer.id,
                `StreamableHTTP transport creation failed: ${transportError instanceof Error ? transportError.message : 'Unknown error'}`
              );

            errors.push({ serverId: mcpServer.id, serverName: mcpServer.name, error });
            const userMessage = buildUserMessage(error, { serverName: mcpServer.name });
            log.error(`❌ StreamableHTTP transport error for ${mcpServer.name}: ${userMessage}`, error);
            continue; // Skip to next server
          }
        } else {
          log.warn(`⚠️ Skipping ${mcpServer.name}: URL must end with /sse or /mcp`);
          continue;
        }

        mcpClients.push(mcpClient);
        log.info(`✅ MCP client created successfully for ${mcpServer.name}`);

        // Get tools from the MCP server with error handling and retry
        let mcpTools;
        try {
          const retryManager = new RetryManager({
            ...RetryPresets.Quick,
            onRetry: (attempt, _delay) => {
              log.info(`🔄 Retrying tool retrieval for ${mcpServer.name} (attempt ${attempt})`);
            }
          });

          mcpTools = await retryManager.execute(async () => {
            const tools = await mcpClient.tools();

            // Validate tools response
            if (!tools || typeof tools !== 'object') {
              throw MCPError.connectionFailed(
                mcpServer.id,
                'Invalid tools response: expected object, got ' + typeof tools
              );
            }

            return tools;
          });
        } catch (toolsError) {
          const error = MCPError.connectionFailed(
            mcpServer.id,
            `Failed to retrieve tools: ${toolsError instanceof Error ? toolsError.message : 'Unknown error'}`
          );
          errors.push({ serverId: mcpServer.id, serverName: mcpServer.name, error });
          const userMessage = buildUserMessage(error, { serverName: mcpServer.name });
          log.error(`❌ Failed to get tools from ${mcpServer.name}: ${userMessage}`, error);
          continue; // Skip to next server
        }

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
        // Catch-all for any unhandled errors in server initialization
        const mcpError = MCPError.connectionFailed(
          mcpServer.id,
          `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        errors.push({ serverId: mcpServer.id, serverName: mcpServer.name, error: mcpError });
        const userMessage = buildUserMessage(mcpError, { serverName: mcpServer.name });
        log.error(`❌ Failed to initialize MCP client for ${mcpServer.name}: ${userMessage}`, error);
        // Continue with other servers instead of failing the entire request
      }
    }

    // Log summary of initialization
    const successCount = mcpClients.length;
    const failureCount = errors.length;
    const totalCount = successCount + failureCount;

    log.info(`📊 MCP initialization summary:`, {
      total: totalCount,
      successful: successCount,
      failed: failureCount,
      totalTools: Object.keys(tools).length
    });

    if (errors.length > 0) {
      log.warn(`⚠️ Some MCP servers failed to initialize:`, errors.map(e => ({
        server: e.serverName,
        error: e.error.message,
        userMessage: buildUserMessage(e.error, { serverName: e.serverName })
      })));
    }

    log.info('🎯 Total MCP tools loaded:', {
      count: Object.keys(tools).length,
      tools: Object.keys(tools)
    });

    // Note: We no longer clean up on abort since connections are persistent
    // The background service worker maintains connections with keep-alive
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        log.info('⏸️ Chat aborted but MCP connections remain active');
      });
    }

  } catch (error) {
    // Catch-all for catastrophic errors (shouldn't happen with per-server error handling)
    log.error('❌ Critical error initializing MCP clients:', error);
  }

  return {
    tools,
    clients: mcpClients,
    cleanup: async () => {
      // No-op cleanup - connections are persistent
      log.info('🔄 MCP connections persist across chat sessions');
    },
    sessionIds
  };
}/**
 * Clean up MCP clients
 */
// async function cleanupMCPClients(clients: any[]): Promise<void> {
//   log.info('🧹 Cleaning up MCP clients...', { count: clients.length });

//   await Promise.all(
//     clients.map(async (client, index) => {
//       try {
//         // Try different cleanup methods based on client type
//         if (client.close) {
//           await client.close();
//           log.info(`✅ MCP client ${index + 1} closed`);
//         } else if (client.disconnect) {
//           await client.disconnect();
//           log.info(`✅ MCP client ${index + 1} disconnected`);
//         } else if (typeof client === 'object' && client.transport?.close) {
//           await client.transport.close();
//           log.info(`✅ MCP client ${index + 1} transport closed`);
//         } else {
//           log.warn(`⚠️ MCP client ${index + 1} has no known cleanup method`);
//         }
//       } catch (error) {
//         log.error(`❌ Error cleaning up MCP client ${index + 1}:`, error);
//       }
//     })
//   );

//   log.info('✅ MCP client cleanup completed');
// }

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
  let totalToolsCount = 0;

  const serverStatuses = await Promise.all(
    servers.map(async (server) => {
      try {
        // Get connection status
        const statusResponse = await chrome.runtime.sendMessage({
          type: `mcp/${server.id}/status/get`
        });
        const isConnected = statusResponse?.success &&
          statusResponse.data?.state === 'connected';

        // Get tools and disabled tools
        const toolsResponse = await chrome.runtime.sendMessage({
          type: `mcp/${server.id}/tools/list`
        });
        const tools = toolsResponse?.success ? toolsResponse.data || [] : [];

        const disabledToolsKey = `mcp.${server.id}.tools.disabled`;
        const disabledResult = await chrome.storage.local.get(disabledToolsKey);
        const disabledTools = disabledResult[disabledToolsKey] || [];

        // Count only enabled tools
        const enabledToolCount = tools.length - disabledTools.filter(
          (dt: string) => tools.some((t: any) => t.name === dt)
        ).length;

        totalToolsCount += enabledToolCount;

        return {
          id: server.id,
          name: server.name,
          enabled: server.enabled || false,
          connected: isConnected,
          toolCount: enabledToolCount
        };
      } catch (error) {
        // Handle errors gracefully - default to disconnected with no tools
        log.error(`❌ Failed to get status for server ${server.id}:`, error);
        return {
          id: server.id,
          name: server.name,
          enabled: server.enabled || false,
          connected: false,
          toolCount: 0
        };
      }
    })
  );

  return {
    servers: serverStatuses,
    totalTools: totalToolsCount
  };
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

