/**
 * Frontend Tool Executor
 * 
 * Intercepts tool calls from the backend stream and executes them locally.
 * Returns results that can be sent back to continue the AI response.
 */

import { createLogger } from '~logger';
import { getAllTools } from '../tools/registryUtils';
import { enabledTools } from '../tools/enabledTools';
import { getMCPToolsFromBackground } from '../mcp/proxy';
import { getWebMCPToolsFromBackground } from '../tools/webmcpTools';
import { getYouTubeTranscript } from '../agents/youtube';
import { zodToJsonSchema } from '../utils/toolConverter';

const log = createLogger('FrontendToolExecutor', 'TOOLS_EXECUTION');

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export interface ToolResult {
    id: string;
    result: unknown;
    isError?: boolean;
}

/**
 * Cache for all available tools (extension + MCP + agents)
 * Refreshed when getToolSchemas is called
 */
let cachedTools: Record<string, any> | null = null;

/**
 * Get all available tools for frontend execution
 * Includes extension tools, MCP tools, and agent tools
 */
async function getAllAvailableTools(): Promise<Record<string, any>> {
    // Get extension tools
    const allExtensionTools = getAllTools();
    
    // Filter by enabled tools
    const extensionTools = Object.fromEntries(
        Object.entries(allExtensionTools).filter(([name]) => enabledTools.includes(name))
    );

    // Get MCP tools
    let mcpTools: Record<string, any> = {};
    try {
        const mcpManager = await getMCPToolsFromBackground();
        mcpTools = mcpManager.tools;
        log.info('MCP tools loaded for backend mode:', { count: Object.keys(mcpTools).length });
    } catch (error) {
        log.warn('MCP tools unavailable:', error);
    }

    // Get WebMCP tools
    let webmcpTools: Record<string, any> = {};
    try {
        const webmcpResult = await getWebMCPToolsFromBackground();
        webmcpTools = webmcpResult.tools;
        if (Object.keys(webmcpTools).length > 0) {
            log.info('WebMCP tools loaded for backend mode:', { count: Object.keys(webmcpTools).length });
        }
    } catch (error) {
        log.debug('WebMCP tools unavailable:', error);
    }

    // Add agent tools
    const agentTools: Record<string, any> = {};
    if (enabledTools.includes('getYouTubeTranscript')) {
        agentTools.getYouTubeTranscript = getYouTubeTranscript;
    }

    // Combine all tools
    const allTools = { ...extensionTools, ...mcpTools, ...webmcpTools, ...agentTools };
    
    log.info('All tools available for backend mode:', {
        total: Object.keys(allTools).length,
        extension: Object.keys(extensionTools).length,
        mcp: Object.keys(mcpTools).length,
        webmcp: Object.keys(webmcpTools).length,
        agent: Object.keys(agentTools).length,
    });

    return allTools;
}

/**
 * Execute a tool call locally in the browser
 */
export async function executeToolLocally(
    toolCall: ToolCall,
    abortSignal?: AbortSignal
): Promise<ToolResult> {
    log.info('Executing tool locally:', {
        id: toolCall.id,
        name: toolCall.name,
    });

    try {
        // Refresh tools cache if needed
        if (!cachedTools) {
            cachedTools = await getAllAvailableTools();
        }

        const tool = cachedTools[toolCall.name];

        if (!tool) {
            throw new Error(`Tool "${toolCall.name}" not found in registry`);
        }

        // Check if aborted before execution
        if (abortSignal?.aborted) {
            throw new Error('Operation cancelled');
        }

        // Execute the tool
        const result = await tool.execute(toolCall.arguments, abortSignal);

        log.info('Tool executed successfully:', {
            id: toolCall.id,
            name: toolCall.name,
            resultType: typeof result,
        });

        return {
            id: toolCall.id,
            result,
            isError: false,
        };
    } catch (error) {
        log.error('Tool execution failed:', {
            id: toolCall.id,
            name: toolCall.name,
            error,
        });

        return {
            id: toolCall.id,
            result: error instanceof Error ? error.message : String(error),
            isError: true,
        };
    }
}

/**
 * Get tool schemas for sending to backend
 * Extracts just the schema (no execute function) for each tool
 */
export async function getToolSchemas(): Promise<
    Record<string, { description: string; parameters: Record<string, unknown> }>
> {
    // Refresh tools cache
    cachedTools = await getAllAvailableTools();

    const schemas: Record<string, { description: string; parameters: Record<string, unknown> }> = {};

    for (const [name, tool] of Object.entries(cachedTools)) {
        if (!tool) continue;

        try {
            // Convert Zod schema to JSON Schema for sending to backend
            const inputSchema = tool.inputSchema || tool.parameters;
            const jsonSchema = inputSchema ? zodToJsonSchema(inputSchema) : { type: 'object', properties: {} };

            schemas[name] = {
                description: tool.description || `Tool: ${name}`,
                parameters: jsonSchema as Record<string, unknown>,
            };
        } catch (error) {
            log.warn(`Failed to convert schema for tool "${name}":`, error);
            // Include tool with empty parameters as fallback
            schemas[name] = {
                description: tool.description || `Tool: ${name}`,
                parameters: { type: 'object', properties: {} },
            };
        }
    }

    log.info('Tool schemas prepared for backend:', {
        count: Object.keys(schemas).length,
        names: Object.keys(schemas).slice(0, 10),
    });

    return schemas;
}

/**
 * Clear the tools cache (useful when tools change)
 */
export function clearToolsCache(): void {
    cachedTools = null;
    log.info('Tools cache cleared');
}
