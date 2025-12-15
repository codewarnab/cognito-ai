/**
 * Discover Tools - Meta-tool for Adaptive Mode
 * 
 * Allows the AI to search for available tools by name, description, or schema
 * without loading all tool definitions into context.
 */

import { z } from 'zod';
import { createLogger } from '~logger';
import { getAllTools } from '../registryUtils';
import { getMCPToolsFromBackground } from '../../mcp/proxy';
import { getWebMCPToolsFromBackground } from '../webmcpTools';

const log = createLogger('DiscoverTools');

/**
 * Escape special regex characters to prevent ReDoS attacks
 * @see https://stackoverflow.com/questions/61551989/avoiding-redos-attacks
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tool info returned by discover
 */
interface DiscoveredTool {
    name: string;
    description: string;
    inputSchemaPreview: string; // Simplified schema for context efficiency
}

/**
 * Search for tools matching a query
 * Searches through:
 * - Tool names
 * - Tool descriptions
 * - Tool schema properties
 */
async function discoverToolsInMemory(
    query: string,
    options?: { includeSchema?: boolean }
): Promise<{ tools: DiscoveredTool[]; totalAvailable: number }> {
    try {
        const matchedTools: DiscoveredTool[] = [];
        const regex = new RegExp(escapeRegex(query), 'i'); // Case-insensitive search

        // Get all tool sources
        const extensionTools = getAllTools();

        // Get MCP tools
        let mcpTools: Record<string, any> = {};
        try {
            const mcpManager = await getMCPToolsFromBackground();
            mcpTools = mcpManager.tools || {};
        } catch (error) {
            log.debug('MCP tools unavailable for discovery:', error);
        }

        // Get WebMCP tools
        let webmcpTools: Record<string, any> = {};
        try {
            const webmcpResult = await getWebMCPToolsFromBackground();
            webmcpTools = webmcpResult.tools || {};
        } catch (error) {
            log.debug('WebMCP tools unavailable for discovery:', error);
        }

        // Combine all tools
        const allTools = { ...extensionTools, ...mcpTools, ...webmcpTools };
        const totalAvailable = Object.keys(allTools).length;

        // Search through all tools
        for (const [name, tool] of Object.entries(allTools)) {
            const description = tool.description || '';

            // Get simplified schema representation
            let schemaPreview = '';
            try {
                if (tool.inputSchema) {
                    // For Zod schemas, try to get a simple representation
                    if (typeof tool.inputSchema.shape === 'object') {
                        const props = Object.keys(tool.inputSchema.shape);
                        schemaPreview = `Parameters: ${props.join(', ')}`;
                    } else if (tool.inputSchema._def) {
                        schemaPreview = 'Has parameters';
                    }
                }
            } catch {
                schemaPreview = 'Has parameters';
            }

            // Check if query matches tool name, description, or schema
            if (
                regex.test(name) ||
                regex.test(description) ||
                regex.test(schemaPreview)
            ) {
                matchedTools.push({
                    name,
                    description: description.substring(0, 200), // Truncate for context efficiency
                    inputSchemaPreview: options?.includeSchema ? schemaPreview : '',
                });
            }
        }

        log.info('Tools discovered:', {
            query,
            matchCount: matchedTools.length,
            totalAvailable,
        });

        return { tools: matchedTools, totalAvailable };
    } catch (error) {
        log.error('Failed to discover tools:', error);
        return { tools: [], totalAvailable: 0 };
    }
}

/**
 * Get all tool names and one-line descriptions
 * Used for building the tool index in the system prompt
 */
export async function getToolIndex(): Promise<Array<{ name: string; description: string }>> {
    const extensionTools = getAllTools();

    // Get MCP tools
    let mcpTools: Record<string, any> = {};
    try {
        const mcpManager = await getMCPToolsFromBackground();
        mcpTools = mcpManager.tools || {};
    } catch {
        // MCP unavailable
    }

    // Get WebMCP tools
    let webmcpTools: Record<string, any> = {};
    try {
        const webmcpResult = await getWebMCPToolsFromBackground();
        webmcpTools = webmcpResult.tools || {};
    } catch {
        // WebMCP unavailable
    }

    const allTools = { ...extensionTools, ...mcpTools, ...webmcpTools };

    return Object.entries(allTools).map(([name, tool]) => ({
        name,
        description: (tool.description || '').split('\n')[0].substring(0, 100), // First line, max 100 chars
    }));
}

/**
 * discoverTools tool definition for AI SDK
 */
export const discoverTools = {
    description: `Search for available tools by keyword. Use this to find relevant tools before executing them.
    
WHEN TO USE:
- Before performing any action, search for tools that might help
- Use keywords related to what you want to do (e.g., "navigate", "click", "read", "search")
- Check the returned tool descriptions to understand what each tool does

RETURNS: List of matching tools with names and descriptions`,

    inputSchema: z.object({
        query: z.string().describe(
            'Search keyword(s) to find relevant tools. Examples: "navigate", "click button", "read page", "search tabs"'
        ),
        includeSchema: z.boolean().optional().describe(
            'Include parameter info in results (default: false for efficiency)'
        ),
    }),

    execute: async (input: { query: string; includeSchema?: boolean }) => {
        const result = await discoverToolsInMemory(input.query, {
            includeSchema: input.includeSchema,
        });

        if (result.tools.length === 0) {
            return {
                message: `No tools found matching "${input.query}". Try broader keywords or check the tool index.`,
                totalAvailable: result.totalAvailable,
            };
        }

        return {
            message: `Found ${result.tools.length} tools matching "${input.query}"`,
            tools: result.tools,
            totalAvailable: result.totalAvailable,
        };
    },
};
