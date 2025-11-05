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

// Tool UI components
export * from './components';
