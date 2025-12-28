/**
 * Backend Chat with Frontend Tools
 * 
 * This module handles the full tool execution loop:
 * 1. Send message + tool schemas to backend
 * 2. Stream response, intercepting tool calls
 * 3. Execute tools locally
 * 4. Send results back to continue generation
 * 
 * @module backendChatWithTools
 */

// Main export
export { streamBackendChatWithTools } from './streamBackend';

// Types
export type { BackendChatWithToolsParams, ParsedStreamEvent, ToolErrorInfo } from './types';

// Utilities (for advanced usage or testing)
export { parseStreamChunk } from './streamParser';
export { sanitizeMessagesForBackend } from './messageSanitizer';
export { sanitizeToolName, prepareToolSchemasForBackend, mapToolNameBack } from './toolNameSanitizer';
