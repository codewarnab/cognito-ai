import type { WebsiteToolContext } from './types';

/**
 * Filters the complete tool set to only include tools allowed for the current website
 * @param allTools - Complete set of tools available to the AI
 * @param websiteContext - Current website context with allowed tools
 * @returns Filtered tool set containing only allowed tools
 */
export function getWebsiteTools(
    allTools: Record<string, any>,
    websiteContext: WebsiteToolContext | null
): Record<string, any> {
    // If no website context, return all tools
    if (!websiteContext) {
        return allTools;
    }

    // Filter tools based on allowed tool names
    const filteredTools: Record<string, any> = {};

    for (const [toolName, toolDefinition] of Object.entries(allTools)) {
        if (isToolAllowedForWebsite(toolName, websiteContext)) {
            filteredTools[toolName] = toolDefinition;
        }
    }

    return filteredTools;
}

/**
 * Checks if a specific tool is allowed for the current website
 * @param toolName - Name of the tool to check
 * @param websiteContext - Current website context
 * @returns True if tool is allowed, false otherwise
 */
export function isToolAllowedForWebsite(
    toolName: string,
    websiteContext: WebsiteToolContext | null
): boolean {
    // If no website context, allow all tools
    if (!websiteContext) {
        return true;
    }

    // Check if tool is in the allowed list
    return websiteContext.allowedTools.includes(toolName);
}

/**
 * Gets a list of tool names that are allowed for the current website
 * @param websiteContext - Current website context
 * @returns Array of allowed tool names
 */
export function getAllowedToolNames(
    websiteContext: WebsiteToolContext | null
): string[] {
    if (!websiteContext) {
        return [];
    }

    return [...websiteContext.allowedTools];
}

/**
 * Gets statistics about tool filtering for the current website
 * @param allTools - Complete set of tools
 * @param websiteContext - Current website context
 * @returns Object with statistics about filtered tools
 */
export function getToolFilterStats(
    allTools: Record<string, any>,
    websiteContext: WebsiteToolContext | null
): {
    totalTools: number;
    allowedTools: number;
    filteredTools: number;
    allowedToolNames: string[];
} {
    const totalTools = Object.keys(allTools).length;

    if (!websiteContext) {
        return {
            totalTools,
            allowedTools: totalTools,
            filteredTools: 0,
            allowedToolNames: Object.keys(allTools),
        };
    }

    const allowedTools = websiteContext.allowedTools.length;
    const filteredTools = totalTools - allowedTools;

    return {
        totalTools,
        allowedTools,
        filteredTools,
        allowedToolNames: websiteContext.allowedTools,
    };
}
