/**
 * MCP Tools Configuration Management
 * 
 * Manages the list of disabled tools for each MCP server.
 * Tools can be disabled to prevent them from being called by the AI assistant.
 */

/**
 * Get disabled tools for a server from chrome.storage
 * 
 * Retrieves the list of tool names that have been disabled for a specific server.
 * Disabled tools will not be made available to the AI assistant for calling.
 * 
 * @param serverId - The unique identifier for the MCP server
 * @returns An array of disabled tool names, or an empty array if none are disabled
 */
export async function getDisabledTools(serverId: string): Promise<string[]> {
    const key = `mcp.${serverId}.tools.disabled`;
    const result = await chrome.storage.local.get(key);
    return result[key] || [];
}

/**
 * Set disabled tools for a server in chrome.storage
 * 
 * Updates the list of disabled tools for a specific server. This configuration
 * is persisted in chrome.storage.local so it survives service worker restarts.
 * 
 * @param serverId - The unique identifier for the MCP server
 * @param toolNames - An array of tool names to disable
 */
export async function setDisabledTools(serverId: string, toolNames: string[]): Promise<void> {
    const key = `mcp.${serverId}.tools.disabled`;
    await chrome.storage.local.set({ [key]: toolNames });
}
