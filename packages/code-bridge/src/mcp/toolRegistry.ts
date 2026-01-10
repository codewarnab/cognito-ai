/**
 * Tool Registry for MCP Server
 *
 * Dynamically registers extension tools with the MCP server.
 * Fetches tool definitions from the code-bridge tool bridge endpoint
 * and proxies execution back to the extension.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeToolOnExtension } from './toolStore.js';

/**
 * Tool definition from extension
 */
export interface ExtensionTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

/**
 * Tool call result from extension
 */
export interface ToolCallResult {
    success: boolean;
    result?: unknown;
    error?: string;
}

/**
 * Convert JSON Schema to Zod schema for MCP tool registration
 * This is a simplified converter for common JSON Schema types
 */
function jsonSchemaToZod(jsonSchema: ExtensionTool['inputSchema']): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const properties = jsonSchema.properties || {};
    const required = jsonSchema.required || [];

    const zodProperties: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(properties)) {
        const propSchema = prop as {
            type?: string;
            description?: string;
            default?: unknown;
            enum?: unknown[];
        };

        let zodType: z.ZodTypeAny;

        switch (propSchema.type) {
            case 'string':
                zodType = z.string();
                break;
            case 'number':
            case 'integer':
                zodType = z.number();
                break;
            case 'boolean':
                zodType = z.boolean();
                break;
            case 'array':
                zodType = z.array(z.unknown());
                break;
            case 'object':
                zodType = z.record(z.string(), z.unknown());
                break;
            default:
                zodType = z.unknown();
        }

        // Add description if present
        if (propSchema.description) {
            zodType = zodType.describe(propSchema.description);
        }

        // Handle enum
        if (propSchema.enum && Array.isArray(propSchema.enum)) {
            zodType = z.enum(propSchema.enum as [string, ...string[]]);
        }

        // Handle default
        if (propSchema.default !== undefined) {
            zodType = zodType.default(propSchema.default);
        }

        // Make optional if not required
        if (!required.includes(key)) {
            zodType = zodType.optional();
        }

        zodProperties[key] = zodType;
    }

    return z.object(zodProperties);
}

/**
 * Fetch available tools from the extension via bridge
 */
export async function fetchExtensionTools(bridgePort: number): Promise<ExtensionTool[]> {
    try {
        const response = await fetch(`http://127.0.0.1:${bridgePort}/bridge/tools`);

        if (!response.ok) {
            console.error('[MCP] Failed to fetch extension tools:', response.status);
            return [];
        }

        const data = await response.json() as { tools: ExtensionTool[] };
        return data.tools || [];
    } catch (error) {
        console.error('[MCP] Error fetching extension tools:', error);
        return [];
    }
}

/**
 * Call a tool on the extension via bridge
 */
export async function callExtensionTool(
    bridgePort: number,
    toolName: string,
    args: unknown
): Promise<ToolCallResult> {
    try {
        // Note: tool execution happens in the extension. Since the MCP server
        // runs in the same process as the bridge, call the tool store directly
        // instead of round-tripping through HTTP.
        void bridgePort; // Keep signature stable for external callers

        const result = await executeToolOnExtension(toolName, args);
        return {
            success: result.success,
            result: result.result,
            error: result.error,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Register extension tools with MCP server
 *
 * Fetches tool definitions from the extension and registers them
 * with the MCP server for discovery by CLI agents.
 *
 * @param mcpServer - The MCP server instance
 * @param bridgePort - The port the code-bridge is running on
 * @returns Number of tools registered
 */
export async function registerExtensionTools(
    mcpServer: McpServer,
    bridgePort: number
): Promise<number> {
    const tools = await fetchExtensionTools(bridgePort);

    if (tools.length === 0) {
        console.log('[MCP] No extension tools available to register');
        return 0;
    }

    for (const tool of tools) {
        try {
            const zodSchema = jsonSchemaToZod(tool.inputSchema);

            mcpServer.tool(
                tool.name,
                tool.description,
                zodSchema.shape,
                async (args) => {
                    const result = await callExtensionTool(bridgePort, tool.name, args);

                    if (!result.success) {
                        return {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: `Error: ${result.error || 'Unknown error'}`,
                                },
                            ],
                            isError: true,
                        };
                    }

                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: typeof result.result === 'string'
                                    ? result.result
                                    : JSON.stringify(result.result, null, 2),
                            },
                        ],
                    };
                }
            );

            console.log(`[MCP] Registered tool: ${tool.name}`);
        } catch (error) {
            console.error(`[MCP] Failed to register tool ${tool.name}:`, error);
        }
    }

    console.log(`[MCP] Registered ${tools.length} extension tools`);
    return tools.length;
}
