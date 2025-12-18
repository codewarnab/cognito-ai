/**
 * Backend AI Chat Module
 * 
 * Exports for backend chat integration.
 */

export { streamBackendChat, type BackendChatParams } from './backendChat';
export { streamBackendChatWithTools, type BackendChatWithToolsParams } from './backendChatWithTools';
export {
    executeToolLocally,
    getToolSchemas,
    clearToolsCache,
    type ToolCall,
    type ToolResult,
} from './frontendToolExecutor';

// Phase 3: Advanced features
export {
    getCombinedToolSchemas,
    executeWebMCPTool,
    isWebMCPTool,
} from './webmcpIntegration';

export {
    createOptimizedFetch,
    abortBackendRequest,
    createBackendController,
    getBackendController,
    clearBackendController,
    deduplicatedFetch,
    measureTTFB,
} from './streamingOptimizations';

export {
    isRateLimitError,
    hasApiKeyForFallback,
    switchToBYOKMode,
    handleRateLimitError,
    createRateLimitMessage,
    withGracefulDegradation,
    type RateLimitError,
} from './gracefulDegradation';
