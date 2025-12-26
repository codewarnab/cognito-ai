/**
 * WebMCP Integration for Backend Mode
 *
 * Bridges WebMCP tool discovery with backend AI.
 * Tools discovered from websites are sent to backend as schemas,
 * and executed locally when the AI calls them.
 */

import { createLogger } from '~logger';
import { getToolSchemas as getBuiltinSchemas } from './frontendToolExecutor';

const log = createLogger('WebMCPBackend', 'WEBMCP_BACKEND');

interface WebMCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

/**
 * Get combined tool schemas including WebMCP tools
 */
export async function getCombinedToolSchemas(): Promise<
    Record<string, { description: string; parameters: Record<string, unknown> }>
> {
    // Get built-in tool schemas (includes extension, MCP, and WebMCP tools)
    const builtinSchemas = await getBuiltinSchemas();

    // Get WebMCP tools from active tab (additional discovery)
    const webmcpTools = await discoverWebMCPTools();

    // Merge, with WebMCP tools prefixed to avoid conflicts
    const combined = { ...builtinSchemas };

    for (const tool of webmcpTools) {
        const prefixedName = `webmcp_${tool.name}`;
        // Only add if not already present from getBuiltinSchemas
        if (!combined[prefixedName] && !combined[tool.name]) {
            combined[prefixedName] = {
                description: `[WebMCP] ${tool.description}`,
                parameters: tool.inputSchema as Record<string, unknown>,
            };
        }
    }

    log.info('Combined tool schemas:', {
        builtin: Object.keys(builtinSchemas).length,
        webmcp: webmcpTools.length,
        total: Object.keys(combined).length,
    });

    return combined;
}

/**
 * Discover WebMCP tools from current page
 */
async function discoverWebMCPTools(): Promise<WebMCPTool[]> {
    try {
        // Query the MCP hub in background for active tab tools
        const response = await chrome.runtime.sendMessage({
            type: 'webmcp/tools/list',
        });

        if (response?.success && response?.data?.tools) {
            const tools = response.data.tools as WebMCPTool[];
            log.info('Discovered WebMCP tools:', tools.length);
            return tools;
        }

        return [];
    } catch (error) {
        log.warn('Failed to discover WebMCP tools:', error);
        return [];
    }
}

/**
 * Execute a WebMCP tool
 */
export async function executeWebMCPTool(
    toolName: string,
    args: Record<string, unknown>
): Promise<unknown> {
    // Remove webmcp_ prefix if present
    const originalName = toolName.replace(/^webmcp_/, '');

    log.info('Executing WebMCP tool:', { toolName: originalName, args });

    const response = await chrome.runtime.sendMessage({
        type: 'webmcp/tool/call',
        payload: {
            toolName: originalName,
            args,
        },
    });

    if (!response?.success) {
        throw new Error(response?.error || 'WebMCP tool execution failed');
    }

    return response?.result;
}

/**
 * Check if a tool name is a WebMCP tool
 */
export function isWebMCPTool(toolName: string): boolean {
    return toolName.startsWith('webmcp_');
}
