/**
 * Backend Chat with Tools - Module Index
 *
 * Re-exports all public APIs from the backendChatWithTools module.
 * This is the main entry point for importing functionality from this module.
 *
 * @module backendChatWithTools
 *
 * @example
 * ```typescript
 * // Import the main function
 * import { streamBackendChatWithTools } from './backendChatWithTools';
 *
 * // Import types
 * import type { BackendChatWithToolsParams, ToolErrorInfo } from './backendChatWithTools';
 *
 * // Import constants if needed
 * import { DEFAULT_MAX_STEPS, BACKEND_URL } from './backendChatWithTools';
 * ```
 */

// Main stream function
export { streamBackendChatWithTools } from './streamBackend';

// Types
export type {
    BackendChatWithToolsParams,
    ParsedStreamEvent,
    ToolErrorInfo,
} from './types';

// Constants
export {
    BACKEND_URL,
    CHAT_WITH_TOOLS_ENDPOINT,
    DEFAULT_MAX_STEPS,
    DEFAULT_MODE,
    REQUEST_HEADERS,
} from './constants';

// Tool preparation
export {
    prepareTools,
    type ToolPreparationResult,
} from './prepareTool';

// Request handling
export {
    makeBackendRequest,
    buildRequestBody,
    BackendRequestError,
    type BackendRequestParams,
    type BackendRequestResult,
} from './requestHandler';

// Stream processing
export {
    processStream,
    writeMaxStepsWarning,
    writeStatus,
    type StreamProcessorOptions,
    type StreamProcessingResult,
} from './streamProcessor';

// Event handlers
export {
    handleTextEvent,
    handleToolCallEvent,
    handleToolResultEvent,
    handleToolErrorEvent,
    handleErrorEvent,
    handleFinishEvent,
    processEvent,
    type EventHandlerContext,
    type EventProcessingState,
    type EventProcessingResult,
} from './eventHandlers';

// Tool execution
export {
    executeToolsAndFormat,
    buildToolResultMessages,
    buildErrorFeedbackMessages,
    type ToolExecutionResult,
} from './toolExecutor';

// Stream parsing (already existed)
export { parseStreamChunk } from './streamParser';

// Message sanitization (already existed)
export { sanitizeMessagesForBackend } from './messageSanitizer';

// Tool name sanitization (already existed)
export {
    prepareToolSchemasForBackend,
    mapToolNameBack,
    sanitizeToolName,
} from './toolNameSanitizer';
