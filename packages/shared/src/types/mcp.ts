
/**
 * Configuration for a Standard I/O MCP server.
 */
export interface StdioMcpConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

/**
 * Payload for discovering tools from a StdIO MCP server.
 */
export interface McpDiscoveryRequest extends StdioMcpConfig { }

/**
 * Response from tool discovery.
 */
export interface McpDiscoveryResponse {
    tools: Array<{
        name: string;
        description?: string;
        inputSchema?: any; // JSON Schema
    }>;
}
