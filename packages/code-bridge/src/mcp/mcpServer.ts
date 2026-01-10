/**
 * MCP Server Instance for Code Bridge
 *
 * Creates and configures the MCP server that exposes extension tools
 * to CLI agents like Gemini CLI and Claude Code.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const VERSION = '0.1.0';

/**
 * Create configured MCP server instance
 */
export function createMcpServer(): McpServer {
    const server = new McpServer({
        name: 'cognito-code-bridge',
        version: VERSION,
    });

    return server;
}
