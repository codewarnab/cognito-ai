/**
 * Runtime Message Validators
 *
 * Uses Zod schemas for runtime validation of messages.
 * This provides a safety net for edge cases like messages from older extension versions
 * or external sources.
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Common schemas
export {
    SuccessResponseSchema,
    ErrorResponseSchema,
    ResponseSchema,
    BasicResponseSchema,
    GeolocationCoordsSchema,
    GeolocationPositionSchema,
} from './common';

// Message schemas
export { MessageSchemas, type MessageSchemaType } from './messages';

// MCP schemas
export {
    McpStaticMessageSchemas,
    McpServerMessageSchemas,
    type McpStaticSchemaType,
    type McpServerActionSchemaType,
} from './mcp-schemas';

// Validation functions
export {
    type ValidationResult,
    type InferredPayload,
    type InferredResponse,
    validatePayload,
    validateResponse,
    safeValidatePayload,
    safeValidateResponse,
    validateMcpStaticPayload,
    validateMcpStaticResponse,
    validateMcpServerPayload,
    validateMcpServerResponse,
    hasSchema,
    hasMcpStaticSchema,
    hasMcpServerSchema,
} from './functions';

// Validated sender
export {
    type ValidatedSenderOptions,
    createValidatedSender,
    sendValidatedMessage,
    sendStrictValidatedMessage,
} from './sender';

// Middleware
export { withPayloadValidation } from './middleware';
