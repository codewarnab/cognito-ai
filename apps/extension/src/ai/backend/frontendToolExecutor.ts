/**
 * Frontend Tool Executor
 * 
 * Intercepts tool calls from the backend stream and executes them locally.
 * Returns results that can be sent back to continue the AI response.
 */

import { createLogger } from '~logger';
import { getAllTools } from '../tools/registryUtils';
import { getMCPToolsFromBackground } from '../mcp/proxy';
import { getWebMCPToolsFromBackground, getWebmcpToolExecutor } from '../tools/webmcpTools';
import { isWebmcpTool } from '../tools/mcpApprovalConfig';
import { getYouTubeTranscript } from '../agents/youtube';
import { zodToJsonSchema } from '../utils/toolConverter';
import { useToolsStore } from '@/stores';
import { getSearchSettings, hasApiKeyForProvider } from '@/utils/settings/searchSettings';
import { SEARCH_TOOL_NAMES } from '../tools/searchToolFilter';
import { WEB_SEARCH_SELF_API_KEY_HIDDEN } from '@/constants';

const log = createLogger('FrontendToolExecutor', 'TOOLS_EXECUTION');

// Storage key for WebMCP disabled tools (matches useWebMCPTools hook)
const WEBMCP_DISABLED_TOOLS_KEY = 'webmcp_disabled_tools';

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
 * Filters based on user settings from useToolsStore
 * Includes extension tools, MCP tools, and agent tools
 * Also includes search tools when search mode is active
 */
async function getAllAvailableTools(): Promise<Record<string, any>> {
    // Get user's tool settings from store
    // Note: We access the store state directly since this is called outside React
    const toolsState = useToolsStore.getState();
    const enabledMap = toolsState.enabledMap;
    const mcpDisabledTools = toolsState.mcpDisabledTools;

    // Check if search mode is active
    const searchSettings = await getSearchSettings();
    const hasSearchKey = WEB_SEARCH_SELF_API_KEY_HIDDEN || await hasApiKeyForProvider(searchSettings.defaultProvider);
    const isSearchModeActive = searchSettings.enabled && hasSearchKey;

    log.info('Filtering tools based on user settings:', {
        enabledBuiltInCount: Object.values(enabledMap).filter(v => v).length,
        mcpServersWithDisabled: Object.keys(mcpDisabledTools).length,
        isSearchModeActive,
        searchSettingsEnabled: searchSettings.enabled,
        hasSearchApiKey: hasSearchKey,
    });

    // Get extension tools and filter by user's enabledMap
    const allExtensionTools = getAllTools();
    const extensionTools = Object.fromEntries(
        Object.entries(allExtensionTools).filter(([name]) => {
            // Use enabledMap if tool exists there, otherwise exclude
            return enabledMap[name] === true;
        })
    );

    // Add search tools if search mode is active
    // Search tools are NOT in enabledMap by design (they're managed via search toggle)
    // but when search mode is enabled, we need to include them
    let searchTools: Record<string, any> = {};
    if (isSearchModeActive) {
        for (const toolName of SEARCH_TOOL_NAMES) {
            if (allExtensionTools[toolName]) {
                searchTools[toolName] = allExtensionTools[toolName];
            }
        }
        log.info('Search mode active - adding search tools:', {
            added: Object.keys(searchTools),
        });
    }

    // Get MCP tools and filter by user's disabled list per server
    let mcpTools: Record<string, any> = {};
    try {
        const mcpManager = await getMCPToolsFromBackground();
        const allMcpTools = mcpManager.tools;

        // Filter out disabled MCP tools
        // MCP tool names from background are like "serverId_toolName" or just "toolName"
        // mcpDisabledTools is keyed by serverId with array of disabled tool names
        mcpTools = Object.fromEntries(
            Object.entries(allMcpTools).filter(([toolName, tool]) => {
                // Get serverId from the tool if available
                const serverId = (tool as any)?.serverId;
                if (serverId && mcpDisabledTools[serverId]) {
                    // Extract just the tool name without server prefix for comparison
                    const baseName = (tool as any)?.name || toolName;
                    return !mcpDisabledTools[serverId].includes(baseName);
                }
                return true; // Include if no disabled list for this server
            })
        );

        log.info('MCP tools loaded for backend mode:', {
            total: Object.keys(allMcpTools).length,
            enabled: Object.keys(mcpTools).length
        });
    } catch (error) {
        log.warn('MCP tools unavailable:', error);
    }

    // Get WebMCP tools and filter by user's disabled list
    let webmcpTools: Record<string, any> = {};
    try {
        const webmcpResult = await getWebMCPToolsFromBackground();
        const allWebmcpTools = webmcpResult.tools;

        // Get WebMCP disabled tools from storage
        let webmcpDisabledTools: string[] = [];
        try {
            const result = await chrome.storage.local.get(WEBMCP_DISABLED_TOOLS_KEY);
            webmcpDisabledTools = result[WEBMCP_DISABLED_TOOLS_KEY] || [];
        } catch {
            // Ignore storage errors
        }

        // Filter out disabled WebMCP tools
        webmcpTools = Object.fromEntries(
            Object.entries(allWebmcpTools).filter(([name]) => {
                return !webmcpDisabledTools.includes(name);
            })
        );

        if (Object.keys(allWebmcpTools).length > 0) {
            log.info('WebMCP tools loaded for backend mode:', {
                total: Object.keys(allWebmcpTools).length,
                enabled: Object.keys(webmcpTools).length
            });
        }
    } catch (error) {
        log.debug('WebMCP tools unavailable:', error);
    }

    // Add agent tools (check enabledMap for these too)
    const agentTools: Record<string, any> = {};
    if (enabledMap['getYouTubeTranscript'] === true) {
        agentTools.getYouTubeTranscript = getYouTubeTranscript;
    }

    // Combine all tools (search tools are added when search mode is active)
    const allTools = { ...extensionTools, ...searchTools, ...mcpTools, ...webmcpTools, ...agentTools };

    log.info('All enabled tools for backend mode:', {
        total: Object.keys(allTools).length,
        extension: Object.keys(extensionTools).length,
        search: Object.keys(searchTools).length,
        mcp: Object.keys(mcpTools).length,
        webmcp: Object.keys(webmcpTools).length,
        agent: Object.keys(agentTools).length,
        isSearchModeActive,
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
        let result: unknown;

        if (isWebmcpTool(toolCall.name)) {
            // WebMCP tools don't have execute() - they use executor registry
            const executor = getWebmcpToolExecutor(toolCall.name);
            if (!executor) {
                throw new Error(`WebMCP tool executor not found: ${toolCall.name}`);
            }
            result = await executor(toolCall.arguments);
        } else if (typeof tool.execute === 'function') {
            result = await tool.execute(toolCall.arguments, abortSignal);
        } else {
            throw new Error(`Tool "${toolCall.name}" has no execute function`);
        }

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
