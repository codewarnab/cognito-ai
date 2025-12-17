/**
 * Type-Safe Extension Messaging
 *
 * This module provides type-safe wrappers for Chrome extension messaging.
 * Use these functions instead of direct chrome.runtime.sendMessage calls.
 *
 * @example
 * import { sendMessage, sendMcpMessage, createMessageRouter } from '@/lib/messaging';
 *
 * // Send a typed message
 * const response = await sendMessage('CHECK_SUPERMEMORY_READY');
 *
 * // Send an MCP message
 * const mcpResponse = await sendMcpMessage('notion', 'enable');
 *
 * // Create a message router
 * const router = createMessageRouter({
 *   'OPEN_SIDEBAR': async () => ({ success: true }),
 * });
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

// =============================================================================
// MESSAGE SENDER
// =============================================================================

export {
    // Core sender functions
    sendMessage,
    sendMessageToTab,
    broadcastMessage,
    // Utility sender functions
    sendMessageWithTimeout,
    trySendMessage,
    // Error class
    MessagingError,
} from './sender';

// =============================================================================
// MESSAGE HANDLER
// =============================================================================

export {
    // Router creation
    createMessageRouter,
    combineRouters,
    // Individual listeners
    onMessage,
    onMessageWithResponse,
    // Utilities
    withValidation,
} from './handler';

export type {
    MessageHandler,
    HandlerMap,
    MessageRouterOptions,
    MessageRouter,
} from './handler';

// =============================================================================
// MCP MESSAGING
// =============================================================================

export {
    // Core MCP functions
    sendMcpMessage,
    sendMcpStaticMessage,
    // Utility functions
    trySendMcpMessage,
    trySendMcpStaticMessage,
    sendMcpMessageWithTimeout,
    batchMcpToolCalls,
    // Convenience functions
    enableMcpServer,
    disableMcpServer,
    getMcpServerStatus,
    callMcpTool,
    listMcpServerTools,
    listAllMcpTools,
    getAllMcpServers,
} from './mcp';

// =============================================================================
// PORT COMMUNICATION
// =============================================================================

export {
    // TypedPort class
    TypedPort,
    // Factory function
    createTypedPort,
    // Background handlers
    createPortHandler,
    sendPortMessage,
} from './port';

export type {
    PortMessageHandler,
    PortHandlerMap,
    IncomingMessage,
    OutgoingMessage,
} from './port';

// =============================================================================
// RUNTIME VALIDATION (Phase 5)
// =============================================================================

export {
    // Validation functions
    validatePayload,
    validateResponse,
    safeValidatePayload,
    safeValidateResponse,
    validateMcpStaticPayload,
    validateMcpStaticResponse,
    validateMcpServerPayload,
    validateMcpServerResponse,
    // Validated sender factory
    createValidatedSender,
    // Pre-configured validated senders
    sendValidatedMessage,
    sendStrictValidatedMessage,
    // Validation middleware
    withPayloadValidation,
    // Schema checks
    hasSchema,
    hasMcpStaticSchema,
    hasMcpServerSchema,
    // Common schemas
    SuccessResponseSchema,
    ErrorResponseSchema,
    ResponseSchema,
    BasicResponseSchema,
    GeolocationCoordsSchema,
    GeolocationPositionSchema,
    // Message schemas
    MessageSchemas,
    McpStaticMessageSchemas,
    McpServerMessageSchemas,
} from './validators';

export type {
    ValidationResult,
    ValidatedSenderOptions,
    MessageSchemaType,
    McpStaticSchemaType,
    McpServerActionSchemaType,
    InferredPayload,
    InferredResponse,
} from './validators';

// =============================================================================
// TYPE RE-EXPORTS
// =============================================================================

// Re-export commonly used types from the type registry for convenience
export type {
    MessageType,
    MessagePayload,
    MessageResponse,
    TypedMessage,
    MessageDefinition,
    NoPayloadMessageType,
    PayloadMessageType,
} from '@/types/messaging';

export type {
    McpServerAction,
    McpServerMessagePayloads,
    McpServerMessageResponses,
    McpStaticMessageType,
    McpStaticMessageRegistry,
    McpServerMessage,
    ParsedMcpMessageType,
} from '@/types/messaging/mcp';

// Re-export port types
export type {
    PortName,
    PortMessageMap,
    PortOutgoingMessages,
    PortIncomingMessages,
    PortOutgoingAction,
    PortIncomingAction,
    PortOutgoingPayload,
    PortIncomingPayload,
    SummarizerPortMessages,
    SummarizerPortOutgoing,
    SummarizerPortIncoming,
    WriterPortMessages,
    WriterPortOutgoing,
    WriterPortIncoming,
    RewriterPortMessages,
    RewriterPortOutgoing,
    RewriterPortIncoming,
} from '@/types/messaging/ports';

// Re-export port type guards
export {
    isPortName,
    isPortMessage,
    isOutgoingAction,
    isIncomingAction,
} from '@/types/messaging/ports';

// Re-export type guards and utilities
export {
    isTypedMessage,
    isMessageType,
} from '@/types/messaging';

export {
    createMcpMessage,
    parseMcpMessageType,
    isMcpMessage,
    isStaticMcpMessage,
    isDynamicMcpMessage,
    isMcpServerAction,
    isMcpServerMessage,
} from '@/types/messaging/mcp';
