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


const log = createLogger('DiscoverTools', 'TOOLS_EXECUTION');

/**
 * Tool info returned by discover
 */
interface DiscoveredTool {
    name: string;
    description: string;
    inputSchemaPreview: string; // Simplified schema for context efficiency
}

/**
 * Normalize text for better matching
 * - Converts hyphens and underscores to spaces
 * - Lowercases the text
 * - Trims whitespace
 */
function normalizeForSearch(text: string): string {
    return text.toLowerCase().replace(/[-_]/g, ' ').trim();
}

/**
 * Check if a text matches the search query
 * Uses multi-word matching: if query has multiple words, matches if ANY word is found
 */
function matchesQuery(text: string, queryTerms: string[]): boolean {
    const normalizedText = normalizeForSearch(text);
    // Match if ANY query term is found in the text
    return queryTerms.some(term => normalizedText.includes(term));
}

/**
 * Score how well a tool matches the query (higher = better match)
 * Used for sorting results by relevance
 */
function scoreMatch(name: string, description: string, queryTerms: string[]): number {
    const normalizedName = normalizeForSearch(name);
    const normalizedDesc = normalizeForSearch(description);
    let score = 0;

    for (const term of queryTerms) {
        // Exact name match is highest priority
        if (normalizedName === term) score += 100;
        // Name contains the term
        else if (normalizedName.includes(term)) score += 50;
        // Name starts with term
        if (normalizedName.startsWith(term)) score += 25;
        // Description contains term
        if (normalizedDesc.includes(term)) score += 10;
    }

    // Bonus for matching more query terms
    const matchCount = queryTerms.filter(term =>
        normalizedName.includes(term) || normalizedDesc.includes(term)
    ).length;
    score += matchCount * 5;

    return score;
}

/**
 * Search tools with given query terms
 * Returns matched tools with scores
 */
function searchToolsWithTerms(
    allTools: Record<string, any>,
    queryTerms: string[],
    options?: { includeSchema?: boolean }
): Array<DiscoveredTool & { _score: number }> {
    const matchedTools: Array<DiscoveredTool & { _score: number }> = [];

    for (const [name, tool] of Object.entries(allTools)) {
        const description = tool.description || '';

        // Get simplified schema representation
        let schemaPreview = '';
        try {
            if (tool.inputSchema) {
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
            matchesQuery(name, queryTerms) ||
            matchesQuery(description, queryTerms) ||
            matchesQuery(schemaPreview, queryTerms)
        ) {
            const score = scoreMatch(name, description, queryTerms);
            matchedTools.push({
                name,
                description: description.substring(0, 200),
                inputSchemaPreview: options?.includeSchema ? schemaPreview : '',
                _score: score,
            });
        }
    }

    return matchedTools;
}

/**
 * Search for tools matching a query
 * Searches through:
 * - Tool names
 * - Tool descriptions
 * - Tool schema properties
 * 
 * Uses tiered search approach:
 * 1. First tries exact phrase match (normalized)
 * 2. If no results, falls back to matching ANY individual word
 * 
 * Normalizes hyphens/underscores to spaces for better matching.
 */
async function discoverToolsInMemory(
    query: string,
    options?: { includeSchema?: boolean }
): Promise<{ tools: DiscoveredTool[]; totalAvailable: number }> {
    try {
        const normalizedQuery = normalizeForSearch(query);

        // Split query into individual terms
        const queryTerms = normalizedQuery
            .split(/\s+/)
            .filter(term => term.length > 0);

        if (queryTerms.length === 0) {
            return { tools: [], totalAvailable: 0 };
        }

        log.debug('Search query parsed:', { original: query, normalized: normalizedQuery, terms: queryTerms });

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

        // Tiered search approach:
        // 1. First try exact phrase match (useful for "notion search" -> "notion-search")
        // 2. If no results, try matching ANY individual word

        let matchedTools: Array<DiscoveredTool & { _score: number }> = [];

        // Tier 1: Try exact phrase match (as a single term)
        matchedTools = searchToolsWithTerms(allTools, [normalizedQuery], options);
        log.debug('Tier 1 (exact phrase) results:', { phrase: normalizedQuery, count: matchedTools.length });

        // Tier 2: If no results and we have multiple terms, try individual word matching
        if (matchedTools.length === 0 && queryTerms.length > 1) {
            matchedTools = searchToolsWithTerms(allTools, queryTerms, options);
            log.debug('Tier 2 (individual terms) results:', { terms: queryTerms, count: matchedTools.length });
        }

        // Tier 3: If still no results with single term, the search just didn't match anything
        // (queryTerms.length === 1 means tier 1 already tried that single term)

        // Sort by relevance score (highest first)
        matchedTools.sort((a, b) => b._score - a._score);

        // Remove internal _score property before returning
        const cleanedTools: DiscoveredTool[] = matchedTools.map(({ _score, ...tool }) => tool);


        log.info('Tools discovered:', {
            query,
            terms: queryTerms,
            matchCount: cleanedTools.length,
            totalAvailable,
        });

        return { tools: cleanedTools, totalAvailable };
    } catch (error) {
        log.error('Failed to discover tools:', error);
        return { tools: [], totalAvailable: 0 };
    }
}

/**
 * Get all tool names and one-line descriptions
 * Used for building the tool index in the system prompt
 * 
 * NOTE: In Adaptive mode, remote/stdio MCP tools are EXCLUDED from this index.
 * They can still be discovered via discoverToolsInMemory() which searches all tools.
 * WebMCP tools are INCLUDED because they're page-specific and contextual.
 * 
 * This design ensures the system prompt stays lightweight while allowing
 * the AI to discover and execute remote MCP tools on-demand.
 */
export async function getToolIndex(): Promise<Array<{ name: string; description: string }>> {
    const extensionTools = getAllTools();

    // NOTE: Remote/stdio MCP tools are intentionally EXCLUDED from the tool index
    // in Adaptive mode. They are still discoverable via discoverTools() and 
    // executable via executeTools(). This keeps the system prompt lightweight.
    // 
    // If you need to search ALL tools (including MCP), use discoverToolsInMemory().

    // Get WebMCP tools (page-specific, so they're included in the index)
    let webmcpTools: Record<string, any> = {};
    try {
        const webmcpResult = await getWebMCPToolsFromBackground();
        webmcpTools = webmcpResult.tools || {};
    } catch {
        // WebMCP unavailable
    }

    // Combine extension tools + WebMCP tools (excluding remote MCP tools)
    const indexTools = { ...extensionTools, ...webmcpTools };

    return Object.entries(indexTools).map(([name, tool]) => ({
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
