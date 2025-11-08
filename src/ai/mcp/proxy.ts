/**
 * MCP Proxy - Frontend interface to background service worker's persistent MCP connections
 * 
 * Instead of creating new MCP clients on every chat, this module:
 * 1. Fetches tool definitions from the background's persistent connections
 * 2. Creates proxy tool executors that send requests to background for execution
 * 
 * Benefits:
 * - Zero connection overhead per chat
 * - Leverages background service worker's keep-alive
 * - Single source of truth for MCP state
 */

import { createLogger } from '../../logger';
import { z } from 'zod';
import { registerToolServer } from '../../utils/toolMetadataStore';

const log = createLogger('MCP-Proxy', 'MCP_EXECUTION');

/**
 * Tool definition from MCP server
 */
interface MCPToolDefinition {
    name: string;
    description?: string;
    inputSchema?: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
    serverId: string;
    serverName: string;
}

/**
 * Get all available MCP tools from background service worker's persistent connections
 */
export async function getMCPToolsFromBackground(): Promise<{
    tools: Record<string, any>;
    sessionIds: Map<string, string>;
    cleanup: () => Promise<void>;
}> {
    log.info('🔍 Fetching MCP tools from background service worker...');

    try {
        // Request tools from background's persistent connections
        const response = await chrome.runtime.sendMessage({
            type: 'mcp/tools/list'
        });

        if (!response.success) {
            log.error('❌ Failed to fetch MCP tools from background:', response.error);
            return {
                tools: {},
                sessionIds: new Map(),
                cleanup: async () => { }
            };
        }

        const toolDefinitions: MCPToolDefinition[] = response.data.tools || [];
        log.info(`📦 Received ${toolDefinitions.length} tools from background`);

        // Convert MCP tool definitions to AI SDK tool format with proxy executors
        const tools: Record<string, any> = {};

        for (const toolDef of toolDefinitions) {
            try {
                // Convert MCP input schema to Zod schema
                const zodSchema = convertMCPSchemaToZod(toolDef.inputSchema);

                // Create tool in AI SDK v5 format with proxy executor
                tools[toolDef.name] = {
                    description: toolDef.description || `Tool from ${toolDef.serverName}`,
                    parameters: zodSchema,
                    execute: async (args: any) => {
                        log.info(`🔧 Executing ${toolDef.name} via background proxy`, {
                            server: toolDef.serverName,
                            args
                        });

                        // Execute via background service worker's persistent connection
                        const result = await chrome.runtime.sendMessage({
                            type: `mcp/${toolDef.serverId}/tool/call`,
                            payload: {
                                name: toolDef.name,
                                arguments: args
                            }
                        });

                        if (!result.success) {
                            log.error(`❌ Tool execution failed: ${toolDef.name}`, result.error);
                            throw new Error(result.error || 'Tool execution failed');
                        }

                        log.info(`✅ Tool execution successful: ${toolDef.name}`);
                        return result.data;
                    }
                };

                // Register tool→server mapping for icon resolution
                registerToolServer(toolDef.name, toolDef.serverId);

                log.info(`✅ Registered proxy tool: ${toolDef.name} (from ${toolDef.serverName})`, {
                    toolName: toolDef.name,
                    serverId: toolDef.serverId,
                    serverName: toolDef.serverName,
                    hasDescription: !!toolDef.description,
                    hasInputSchema: !!toolDef.inputSchema
                });
            } catch (error) {
                log.error(`❌ Failed to register tool ${toolDef.name}:`, error);
            }
        }

        const registeredToolNames = Object.keys(tools);
        log.info(`🎉 Total proxy tools registered: ${registeredToolNames.length}`, {
            count: registeredToolNames.length,
            toolNames: registeredToolNames
        });

        // Debug: Log the registry for troubleshooting
        if (registeredToolNames.length > 0) {
            const { debugRegistry } = await import('../../utils/toolMetadataStore');
            debugRegistry();
        }

        // No session IDs needed - background manages sessions
        // No cleanup needed - background manages persistent connections
        return {
            tools,
            sessionIds: new Map(), // Empty - sessions managed by background
            cleanup: async () => {
                log.info('🔄 No cleanup needed - background manages persistent connections');
            }
        };
    } catch (error) {
        log.error('❌ Error fetching MCP tools from background:', error);
        return {
            tools: {},
            sessionIds: new Map(),
            cleanup: async () => { }
        };
    }
}

/**
 * Convert MCP input schema to Zod schema
 */
function convertMCPSchemaToZod(inputSchema?: any): z.ZodType<any> {
    if (!inputSchema || inputSchema.type !== 'object') {
        return z.object({});
    }

    const properties = inputSchema.properties || {};
    const required = inputSchema.required || [];

    const zodShape: Record<string, z.ZodType<any>> = {};

    for (const [key, propSchema] of Object.entries(properties) as [string, any][]) {
        let zodType: z.ZodType<any>;

        // Convert based on JSON Schema type
        switch (propSchema.type) {
            case 'string':
                zodType = z.string();
                if (propSchema.description) {
                    zodType = zodType.describe(propSchema.description);
                }
                break;

            case 'number':
            case 'integer':
                zodType = z.number();
                if (propSchema.description) {
                    zodType = zodType.describe(propSchema.description);
                }
                break;

            case 'boolean':
                zodType = z.boolean();
                if (propSchema.description) {
                    zodType = zodType.describe(propSchema.description);
                }
                break;

            case 'array':
                zodType = z.array(z.any());
                if (propSchema.description) {
                    zodType = zodType.describe(propSchema.description);
                }
                break;

            case 'object':
                zodType = z.object({}).passthrough();
                if (propSchema.description) {
                    zodType = zodType.describe(propSchema.description);
                }
                break;

            default:
                zodType = z.any();
                if (propSchema.description) {
                    zodType = zodType.describe(propSchema.description);
                }
        }

        // Make optional if not required
        if (!required.includes(key)) {
            zodType = zodType.optional();
        }

        zodShape[key] = zodType;
    }

    return z.object(zodShape);
}
