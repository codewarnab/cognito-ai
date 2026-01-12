/**
 * Validation Functions
 *
 * Core validation utilities for message payloads and responses.
 * Provides both throwing and safe (non-throwing) validation methods.
 */

import { z } from 'zod';
import { MessageSchemas, type MessageSchemaType } from './messages';
import {
    McpStaticMessageSchemas,
    McpServerMessageSchemas,
    type McpStaticSchemaType,
    type McpServerActionSchemaType,
} from './mcp-schemas';

// =============================================================================
// TYPE INFERENCE HELPERS
// =============================================================================

/** Inferred payload type from schema */
export type InferredPayload<T extends MessageSchemaType> = z.infer<(typeof MessageSchemas)[T]['payload']>;

/** Inferred response type from schema */
export type InferredResponse<T extends MessageSchemaType> = z.infer<(typeof MessageSchemas)[T]['response']>;

// =============================================================================
// VALIDATION RESULT TYPE
// =============================================================================

/**
 * Validation result type
 */
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    error?: z.ZodError;
}

// =============================================================================
// MESSAGE VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate a message payload against its schema.
 *
 * @param type - The message type
 * @param payload - The payload to validate
 * @returns Validated payload or throws ZodError
 *
 * @example
 * const validatedPayload = validatePayload('QUEUE_MEMORY_EXTRACTION', {
 *   threadId: '123',
 *   messageCount: 5
 * });
 */
export function validatePayload<T extends MessageSchemaType>(
    type: T,
    payload: unknown
): z.infer<(typeof MessageSchemas)[T]['payload']> {
    const schema = MessageSchemas[type];
    if (!schema) {
        throw new Error(`No schema found for message type: ${type}`);
    }
    return schema.payload.parse(payload) as z.infer<(typeof MessageSchemas)[T]['payload']>;
}

/**
 * Validate a message response against its schema.
 *
 * @param type - The message type
 * @param response - The response to validate
 * @returns Validated response or throws ZodError
 *
 * @example
 * const validatedResponse = validateResponse('CHECK_SUPERMEMORY_READY', response);
 * // validatedResponse is typed as { ready: boolean }
 */
export function validateResponse<T extends MessageSchemaType>(
    type: T,
    response: unknown
): z.infer<(typeof MessageSchemas)[T]['response']> {
    const schema = MessageSchemas[type];
    if (!schema) {
        throw new Error(`No schema found for message type: ${type}`);
    }
    return schema.response.parse(response) as z.infer<(typeof MessageSchemas)[T]['response']>;
}

/**
 * Safely validate a payload without throwing.
 *
 * @param type - The message type
 * @param payload - The payload to validate
 * @returns ValidationResult with success flag and data or error
 *
 * @example
 * const result = safeValidatePayload('QUEUE_MEMORY_EXTRACTION', payload);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 */
export function safeValidatePayload<T extends MessageSchemaType>(
    type: T,
    payload: unknown
): ValidationResult<z.infer<(typeof MessageSchemas)[T]['payload']>> {
    const schema = MessageSchemas[type];
    if (!schema) {
        return {
            success: false,
            error: new z.ZodError([
                {
                    code: 'custom',
                    path: [],
                    message: `No schema found for message type: ${type}`,
                },
            ]),
        };
    }

    const result = schema.payload.safeParse(payload);
    if (result.success) {
        return { success: true, data: result.data as z.infer<(typeof MessageSchemas)[T]['payload']> };
    }
    return { success: false, error: result.error };
}

/**
 * Safely validate a response without throwing.
 *
 * @param type - The message type
 * @param response - The response to validate
 * @returns ValidationResult with success flag and data or error
 */
export function safeValidateResponse<T extends MessageSchemaType>(
    type: T,
    response: unknown
): ValidationResult<z.infer<(typeof MessageSchemas)[T]['response']>> {
    const schema = MessageSchemas[type];
    if (!schema) {
        return {
            success: false,
            error: new z.ZodError([
                {
                    code: 'custom',
                    path: [],
                    message: `No schema found for message type: ${type}`,
                },
            ]),
        };
    }

    const result = schema.response.safeParse(response);
    if (result.success) {
        return { success: true, data: result.data as z.infer<(typeof MessageSchemas)[T]['response']> };
    }
    return { success: false, error: result.error };
}

// =============================================================================
// MCP VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate an MCP static message payload.
 *
 * @param type - The MCP static message type
 * @param payload - The payload to validate
 * @returns Validated payload
 */
export function validateMcpStaticPayload<T extends McpStaticSchemaType>(
    type: T,
    payload: unknown
): z.infer<(typeof McpStaticMessageSchemas)[T]['payload']> {
    const schema = McpStaticMessageSchemas[type];
    if (!schema) {
        throw new Error(`No schema found for MCP static message type: ${type}`);
    }
    return schema.payload.parse(payload) as z.infer<(typeof McpStaticMessageSchemas)[T]['payload']>;
}

/**
 * Validate an MCP static message response.
 *
 * @param type - The MCP static message type
 * @param response - The response to validate
 * @returns Validated response
 */
export function validateMcpStaticResponse<T extends McpStaticSchemaType>(
    type: T,
    response: unknown
): z.infer<(typeof McpStaticMessageSchemas)[T]['response']> {
    const schema = McpStaticMessageSchemas[type];
    if (!schema) {
        throw new Error(`No schema found for MCP static message type: ${type}`);
    }
    return schema.response.parse(response) as z.infer<(typeof McpStaticMessageSchemas)[T]['response']>;
}

/**
 * Validate an MCP server action payload.
 *
 * @param action - The MCP server action
 * @param payload - The payload to validate
 * @returns Validated payload
 */
export function validateMcpServerPayload<T extends McpServerActionSchemaType>(
    action: T,
    payload: unknown
): z.infer<(typeof McpServerMessageSchemas.payloads)[T]> {
    const schema = McpServerMessageSchemas.payloads[action];
    if (!schema) {
        throw new Error(`No schema found for MCP server action: ${action}`);
    }
    return schema.parse(payload) as z.infer<(typeof McpServerMessageSchemas.payloads)[T]>;
}

/**
 * Validate an MCP server action response.
 *
 * @param action - The MCP server action
 * @param response - The response to validate
 * @returns Validated response
 */
export function validateMcpServerResponse<T extends McpServerActionSchemaType>(
    action: T,
    response: unknown
): z.infer<(typeof McpServerMessageSchemas.responses)[T]> {
    const schema = McpServerMessageSchemas.responses[action];
    if (!schema) {
        throw new Error(`No schema found for MCP server action: ${action}`);
    }
    return schema.parse(response) as z.infer<(typeof McpServerMessageSchemas.responses)[T]>;
}

// =============================================================================
// SCHEMA CHECK FUNCTIONS
// =============================================================================

/**
 * Check if a message type has a schema defined.
 *
 * @param type - The message type to check
 * @returns true if a schema exists for this message type
 */
export function hasSchema(type: string): type is MessageSchemaType {
    return type in MessageSchemas;
}

/**
 * Check if an MCP static message type has a schema defined.
 *
 * @param type - The MCP static message type to check
 * @returns true if a schema exists for this message type
 */
export function hasMcpStaticSchema(type: string): type is McpStaticSchemaType {
    return type in McpStaticMessageSchemas;
}

/**
 * Check if an MCP server action has a schema defined.
 *
 * @param action - The MCP server action to check
 * @returns true if a schema exists for this action
 */
export function hasMcpServerSchema(action: string): action is McpServerActionSchemaType {
    return action in McpServerMessageSchemas.payloads;
}
