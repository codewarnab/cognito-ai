// Tool system
// Barrel export for tools module

// Tool management
export { setupLocalTools, setupRemoteTools, buildEnhancedPrompt } from './manager';
export type { ToolSetup } from './manager';

// Tool registry
export {
    getToolsForMode,
    getToolCapabilities,
    getCloudToolsCount,
    LOCAL_TOOLS,
    BASIC_TOOLS,
    INTERACTION_TOOLS,
    AGENT_TOOLS
} from './registry';

// Tool registry utils
export {
    registerTool,
    getAllTools,
    getTool,
    clearAllTools,
    getToolCount,
    getToolNames
} from './registryUtils';
export type { ToolDefinition } from './registryUtils';

// Search tool filtering
export {
    SEARCH_TOOL_NAMES,
    isSearchTool,
    filterToolsBySearchMode,
    filterToolsObjectBySearchMode,
    getActiveSearchTools,
    countSearchTools,
    hasSearchTools
} from './searchToolFilter';
export type { SearchToolName } from './searchToolFilter';

// WebMCP tools
export {
    convertWebMCPToolsToAITools,
    getWebMCPToolsFromBackground
} from './webmcpTools';

// Tool UI components
export * from './components';
