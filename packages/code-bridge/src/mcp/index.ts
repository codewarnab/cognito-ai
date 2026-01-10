/**
 * MCP Module Barrel Export
 *
 * Central export for all MCP-related functionality.
 */

export { createMcpServer } from './mcpServer.js';
export {
    registerExtensionTools,
    fetchExtensionTools,
    callExtensionTool,
    type ExtensionTool,
    type ToolCallResult,
} from './toolRegistry.js';
export {
    handleMcpRequest,
    handleMcpSessionDelete,
    cleanupAllTransports,
} from './httpTransport.js';
export {
    registerTools,
    getRegisteredTools,
    clearTools,
    addToolExecutionClient,
    removeToolExecutionClient,
    executeToolOnExtension,
    handleToolResult,
    hasToolExecutionClients,
    getToolExecutionClientCount,
    toolStoreEvents,
    type ExtensionToolSchema,
    type ToolExecutionRequest,
    type ToolExecutionResult,
} from './toolStore.js';
