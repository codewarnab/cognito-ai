/**
 * Global store for tool metadata (serverId mapping)
 * Populated when tools are registered, queried during rendering
 * 
 * This store maintains the mapping between tool names and their server IDs,
 * allowing the UI layer to determine which MCP server icon to display.
 */

import { createLogger } from '~logger';

const log = createLogger('ToolMetadataStore', 'MCP_TOOLS');

/**
 * Map of tool name → server ID
 */
const toolToServerMap = new Map<string, string>();

/**
 * Register a tool's server association
 * Called when MCP tools are registered in the proxy
 * Uses lowercase keys to prevent case-sensitivity issues
 */
export function registerToolServer(toolName: string, serverId: string): void {
    const normalizedName = toolName.toLowerCase();
    toolToServerMap.set(normalizedName, serverId);
    log.debug(`Registered tool→server mapping: ${toolName} (normalized: ${normalizedName}) → ${serverId}`);
}

/**
 * Get the server ID for a given tool name
 * Returns undefined if tool is not registered or not an MCP tool
 * Uses case-insensitive lookup
 */
export function getToolServerId(toolName: string): string | undefined {
    const normalizedName = toolName.toLowerCase();
    const serverId = toolToServerMap.get(normalizedName);

    if (!serverId && toolName !== normalizedName) {
        log.warn(`Tool lookup failed for "${toolName}" (tried normalized: "${normalizedName}")`);
    }

    return serverId;
}

/**
 * Check if a tool is an MCP tool (has server association)
 * Uses case-insensitive lookup
 */
export function isMcpTool(toolName: string): boolean {
    const normalizedName = toolName.toLowerCase();
    return toolToServerMap.has(normalizedName);
}

/**
 * Clear all tool metadata
 * Useful when servers are disabled or when starting fresh
 */
export function clearToolMetadata(): void {
    const size = toolToServerMap.size;
    toolToServerMap.clear();
    log.info(`Cleared ${size} tool→server mappings`);
}

/**
 * Get all registered tool→server mappings (for debugging)
 */
export function getAllToolMappings(): Record<string, string> {
    const mappings: Record<string, string> = {};
    toolToServerMap.forEach((serverId, toolName) => {
        mappings[toolName] = serverId;
    });
    return mappings;
}

/**
 * Get count of registered tools
 */
export function getRegisteredToolCount(): number {
    return toolToServerMap.size;
}

/**
 * Debug utility to log all tool→server mappings
 * Useful for troubleshooting icon display issues
 */
export function debugRegistry(): void {
    const mappings = getAllToolMappings();
    const count = getRegisteredToolCount();

    log.info('📋 Tool Registry Debug:', {
        count,
        mappings: Object.entries(mappings).map(([tool, server]) => `${tool} → ${server}`)
    });

    console.table(mappings);
}

