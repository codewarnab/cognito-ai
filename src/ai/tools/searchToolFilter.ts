/**
 * Search Tool Filter
 * Utilities for filtering tools based on search mode state
 * 
 * When search mode is ENABLED:
 * - ONLY search tools (webSearch, retrieve) are available
 * - All other tools are disabled
 * - This creates a focused web search experience
 * 
 * When search mode is DISABLED:
 * - Search tools are removed from available tools
 * - All other tools work normally
 */

import { createLogger } from '~logger';
import { WEB_SEARCH_TOOL_NAME } from '@/actions/search/useWebSearch';
import { RETRIEVE_TOOL_NAME } from '@/actions/search/useRetrieve';

const log = createLogger('SearchToolFilter', 'SEARCH');

/** Names of all search-related tools */
export const SEARCH_TOOL_NAMES = [
    WEB_SEARCH_TOOL_NAME, // 'webSearch'
    RETRIEVE_TOOL_NAME,   // 'retrieve'
] as const;

export type SearchToolName = typeof SEARCH_TOOL_NAMES[number];

/**
 * Checks if a tool name is a search tool.
 * @param toolName - Name of the tool to check
 * @returns True if the tool is a search-related tool
 */
export function isSearchTool(toolName: string): toolName is SearchToolName {
    return SEARCH_TOOL_NAMES.includes(toolName as SearchToolName);
}

/**
 * Filters tool list based on search mode.
 * 
 * IMPORTANT: When search mode is ENABLED, returns ONLY search tools.
 * This is a focused mode where the AI can only search the web.
 * 
 * @param allTools - Array of all available tool names
 * @param searchEnabled - Whether search mode is enabled
 * @returns Filtered array of tool names
 */
export function filterToolsBySearchMode(
    allTools: string[],
    searchEnabled: boolean
): string[] {
    if (searchEnabled) {
        // Search mode ON: Return ONLY search tools
        const searchOnly = allTools.filter((tool) => isSearchTool(tool));
        log.info('Search mode enabled - ONLY search tools available', {
            available: searchOnly,
            disabled: allTools.length - searchOnly.length,
        });
        return searchOnly;
    }

    // Search mode OFF: Remove search tools, keep everything else
    const filtered = allTools.filter((tool) => !isSearchTool(tool));
    log.debug('Search mode disabled, excluding search tools', {
        removed: allTools.length - filtered.length,
    });
    return filtered;
}

/**
 * Filters a tools object based on search mode.
 * 
 * IMPORTANT: When search mode is ENABLED, returns ONLY search tools.
 * This is a focused mode where the AI can only search the web.
 * 
 * @param tools - Object containing tool definitions
 * @param searchEnabled - Whether search mode is enabled
 * @returns Filtered tools object
 */
export function filterToolsObjectBySearchMode<T extends Record<string, unknown>>(
    tools: T,
    searchEnabled: boolean
): T {
    if (searchEnabled) {
        // Search mode ON: Return ONLY search tools
        const searchOnly = Object.fromEntries(
            Object.entries(tools).filter(([name]) => isSearchTool(name))
        ) as T;
        
        log.info('Search mode enabled - filtering to ONLY search tools', {
            available: Object.keys(searchOnly),
            disabled: Object.keys(tools).length - Object.keys(searchOnly).length,
        });
        return searchOnly;
    }

    // Search mode OFF: Remove search tools, keep everything else
    const filtered = Object.fromEntries(
        Object.entries(tools).filter(([name]) => !isSearchTool(name))
    ) as T;

    const removedCount = Object.keys(tools).length - Object.keys(filtered).length;
    if (removedCount > 0) {
        log.debug('Search mode disabled, excluded search tools from object', {
            removed: removedCount,
        });
    }

    return filtered;
}

/**
 * Gets the list of search-only tools.
 * Used when search mode is enabled to get the exclusive tool set.
 * 
 * @returns Array of search tool names
 */
export function getSearchOnlyTools(): string[] {
    return [...SEARCH_TOOL_NAMES];
}

/**
 * Gets the list of active tools based on search mode.
 * Used with AI SDK v5's activeTools parameter to limit available tools.
 * 
 * @param searchEnabled - Whether search mode is enabled
 * @returns Array of active search tool names, or empty array if disabled
 */
export function getActiveSearchTools(searchEnabled: boolean): string[] {
    return searchEnabled ? [...SEARCH_TOOL_NAMES] : [];
}

/**
 * Counts how many search tools are in a tool list.
 * @param tools - Array of tool names
 * @returns Number of search tools in the list
 */
export function countSearchTools(tools: string[]): number {
    return tools.filter((t) => isSearchTool(t)).length;
}

/**
 * Checks if any search tools are present in a tool list.
 * @param tools - Array of tool names
 * @returns True if at least one search tool is present
 */
export function hasSearchTools(tools: string[]): boolean {
    return tools.some((t) => isSearchTool(t));
}
