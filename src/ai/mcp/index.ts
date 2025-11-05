/**
 * MCP (Model Context Protocol) Module
 * 
 * This module handles Model Context Protocol integration:
 * - client.ts: MCP client management and direct connections
 * - proxy.ts: Proxy interface to background service worker's persistent connections
 */

// MCP Client (direct connections)
export {
    initializeMCPClients,
    getMCPStatus,
    clearSessionId,
    refreshMCPConnections,
    type MCPClientManager,
    type MCPServerConfig,
    type KeyValuePair
} from './client';

// MCP Proxy (background service worker connections)
export {
    getMCPToolsFromBackground
} from './proxy';
