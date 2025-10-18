/**
 * MCP Client Manager for AI SDK v5
 * Handles dynamic MCP server connections and tool integration
 */

import { experimental_createMCPClient as createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLogger } from '../logger';
import { NOTION_CONFIG } from '../constants';
import { getStoredTokens } from '../mcp/oauth';
import type { NotionOAuthTokens } from '../mcp/types';

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
}

export interface MCPClientManager {
  tools: Record<string, any>;
  clients: any[];
  cleanup: () => Promise<void>;
}

/**
 * Get enabled MCP server configurations from background script
 * This ensures we get the most up-to-date configurations and tokens
 */
async function getEnabledMCPServers(): Promise<MCPServerConfig[]> {
  const servers: MCPServerConfig[] = [];
  
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
    
    if (response.success && response.data) {
      // Convert background server configs to our format
      for (const server of response.data) {
        if (server.enabled) {
          servers.push({
            id: server.id,
            name: server.name,
            url: server.url,
            type: server.type,
            headers: server.headers,
            enabled: server.enabled
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
    
    // Fallback: try to get Notion MCP directly (for backward compatibility)
    try {
      const { 'mcp.notion.enabled': notionEnabled } = await chrome.storage.local.get('mcp.notion.enabled');
      
      if (notionEnabled) {
        const tokens = await getStoredTokens();
        
        if (tokens?.access_token) {
          servers.push({
            id: 'notion',
            name: 'Notion MCP',
            url: NOTION_CONFIG.MCP_SSE_URL,
            type: 'sse',
            headers: [
              { key: 'Authorization', value: `Bearer ${tokens.access_token}` },
              { key: 'Accept', value: 'application/json, text/event-stream' }
            ],
            enabled: true
          });
          
          log.info('✅ Notion MCP server configured (fallback)', { 
            url: NOTION_CONFIG.MCP_SSE_URL,
            hasToken: !!tokens.access_token 
          });
        }
      }
    } catch (fallbackError) {
      log.error('Error in fallback MCP server configuration:', fallbackError);
    }
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
          const httpTransport = new StreamableHTTPClientTransport(new URL(url), {
            requestInit: { headers }
          });
          mcpClient = await createMCPClient({ transport: httpTransport as any });
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
        
        // Log detailed tool information for debugging
        Object.entries(mcpTools).forEach(([toolName, toolDef]: [string, any]) => {
          log.info(`📦 Tool: ${toolName}`, {
            description: toolDef?.description,
            hasExecute: typeof toolDef?.execute === 'function',
            hasInputSchema: !!toolDef?.inputSchema
          });
        });
        
        // Add MCP tools directly (AI SDK handles tool naming)
        // Don't prefix the tools - the AI SDK expects the original names
        tools = { ...tools, ...mcpTools };
        
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
    cleanup: async () => await cleanupMCPClients(mcpClients)
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
        if (client.close) {
          await client.close();
        } else if (client.disconnect) {
          await client.disconnect();
        }
        log.info(`✅ MCP client ${index + 1} cleaned up`);
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
