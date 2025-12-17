/**
 * Runtime Message Validators
 *
 * Uses Zod schemas for runtime validation of messages.
 * This provides a safety net for edge cases like messages from older extension versions
 * or external sources.
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

import { z } from 'zod';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/** Schema for successful responses */
export const SuccessResponseSchema = z.object({
    success: z.literal(true),
});

/** Schema for error responses */
export const ErrorResponseSchema = z.object({
    success: z.literal(false),
    error: z.string().optional(),
});

/** Schema for generic success/error response */
export const ResponseSchema = z.union([SuccessResponseSchema, ErrorResponseSchema]);

/** Schema for basic success response with optional error */
export const BasicResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

// =============================================================================
// GEOLOCATION SCHEMAS
// =============================================================================

/** GeolocationCoordinates schema (matching Web API) */
export const GeolocationCoordsSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
    altitude: z.number().nullable(),
    altitudeAccuracy: z.number().nullable(),
    heading: z.number().nullable(),
    speed: z.number().nullable(),
});

/** GeolocationPosition schema (matching Web API) */
export const GeolocationPositionSchema = z.object({
    coords: GeolocationCoordsSchema,
    timestamp: z.number(),
});

// =============================================================================
// MESSAGE SCHEMAS
// =============================================================================

/**
 * Central registry of Zod schemas for message payloads and responses.
 *
 * Structure mirrors MessageRegistry in @/types/messaging/index.ts
 */
export const MessageSchemas = {
    // -------------------------------------------------------------------------
    // Tab Context Messages
    // -------------------------------------------------------------------------

    GET_CURRENT_TAB_ID: {
        payload: z.undefined(),
        response: z.object({
            tabId: z.number().optional(),
        }),
    },

    // -------------------------------------------------------------------------
    // Memory / Supermemory Messages
    // -------------------------------------------------------------------------

    CHECK_SUPERMEMORY_READY: {
        payload: z.undefined(),
        response: z.object({
            ready: z.boolean(),
        }),
    },

    QUEUE_MEMORY_EXTRACTION: {
        payload: z.object({
            threadId: z.string(),
            messageCount: z.number(),
        }),
        response: BasicResponseSchema,
    },

    // -------------------------------------------------------------------------
    // UI Messages
    // -------------------------------------------------------------------------

    CHECK_SIDEBAR_STATUS: {
        payload: z.undefined(),
        response: z.object({
            isOpen: z.boolean(),
        }),
    },

    OPEN_SIDEBAR: {
        payload: z.undefined(),
        response: BasicResponseSchema,
    },

    OPEN_SIDEBAR_WITH_MESSAGE: {
        payload: z.object({
            message: z.string(),
            tabAttachments: z.array(z.unknown()).optional(),
        }),
        response: BasicResponseSchema,
    },

    SIDEBAR_OPENED: {
        payload: z.undefined(),
        response: z.void(),
    },

    MODEL_DOWNLOAD_PROGRESS: {
        payload: z.object({
            modelId: z.string(),
            loaded: z.number(),
            total: z.number(),
            progress: z.number(),
        }),
        response: z.object({
            success: z.boolean(),
        }),
    },

    MODEL_DOWNLOAD_PROGRESS_UPDATE: {
        payload: z.object({
            modelId: z.string(),
            loaded: z.number(),
            total: z.number(),
            progress: z.number(),
        }),
        response: z.void(),
    },

    // -------------------------------------------------------------------------
    // AI Notifications
    // -------------------------------------------------------------------------

    'ai/notification/create': {
        payload: z.object({
            threadId: z.string(),
            title: z.string(),
            message: z.string(),
            timestamp: z.number(),
        }),
        response: z.object({
            success: z.boolean(),
            notificationId: z.string().optional(),
            error: z.string().optional(),
        }),
    },

    'ai/notification/action': {
        payload: z.object({
            action: z.enum(['continue', 'dismiss', 'navigate']),
            threadId: z.string(),
        }),
        response: BasicResponseSchema,
    },

    // -------------------------------------------------------------------------
    // Summarizer Messages
    // -------------------------------------------------------------------------

    'summarize:availability': {
        payload: z.undefined(),
        response: z.object({
            available: z.boolean(),
            error: z.string().optional(),
        }),
    },

    'summarize:request': {
        payload: z.object({
            requestId: z.string(),
            text: z.string(),
            options: z.object({
                type: z.enum(['key-points', 'tl-dr', 'headline', 'teaser']),
                format: z.enum(['markdown', 'plain-text']),
                length: z.enum(['short', 'medium', 'long']),
                sharedContext: z.string().optional(),
            }),
            context: z.string().optional(),
        }),
        response: z.object({
            ok: z.boolean(),
            summary: z.string().optional(),
            error: z.string().optional(),
        }),
    },

    // -------------------------------------------------------------------------
    // Geolocation Messages
    // -------------------------------------------------------------------------

    'geolocation/request': {
        payload: z.undefined(),
        response: z.union([
            z.object({
                success: z.literal(true),
                position: GeolocationPositionSchema,
            }),
            z.object({
                success: z.literal(false),
                errorType: z.enum(['denied', 'timeout', 'unavailable', 'unknown']),
                error: z.string(),
            }),
        ]),
    },

    // -------------------------------------------------------------------------
    // File Messages
    // -------------------------------------------------------------------------

    READ_LOCAL_PDF: {
        payload: z.object({
            filePath: z.string(),
        }),
        response: z.object({
            success: z.boolean(),
            content: z.string().optional(),
            filename: z.string().optional(),
            error: z.string().optional(),
        }),
    },

    // -------------------------------------------------------------------------
    // Offscreen Document Messages
    // -------------------------------------------------------------------------

    'offscreen/summarize/availability': {
        payload: z.undefined(),
        response: z.object({
            available: z.boolean(),
        }),
    },

    'offscreen/summarize/request': {
        payload: z.object({
            text: z.string(),
            type: z.enum(['key-points', 'tl-dr', 'headline', 'teaser']),
            format: z.enum(['markdown', 'plain-text']),
            length: z.enum(['short', 'medium', 'long']),
        }),
        response: z.object({
            success: z.boolean(),
            result: z.string().optional(),
            error: z.string().optional(),
        }),
    },

    'offscreen/geolocation/request': {
        payload: z.undefined(),
        response: z.union([
            z.object({ position: GeolocationPositionSchema }),
            z.object({ error: z.string(), errorType: z.string() }),
        ]),
    },

    // -------------------------------------------------------------------------
    // WebMCP Messages
    // -------------------------------------------------------------------------

    'webmcp/tools/register': {
        payload: z.object({
            tools: z.array(
                z.object({
                    name: z.string(),
                    originalName: z.string(),
                    description: z.string().optional(),
                    domain: z.string(),
                    tabId: z.number(),
                    url: z.string(),
                    favicon: z.string().optional(),
                    inputSchema: z.record(z.string(), z.unknown()),
                })
            ),
            tabId: z.number(),
            domain: z.string(),
            url: z.string(),
        }),
        response: BasicResponseSchema,
    },

    'webmcp/tools/list': {
        payload: z.undefined(),
        response: z.object({
            success: z.boolean(),
            data: z
                .object({
                    tools: z.array(z.unknown()),
                })
                .optional(),
            error: z.string().optional(),
        }),
    },

    'webmcp/tools/state': {
        payload: z.undefined(),
        response: z.object({
            success: z.boolean(),
            data: z
                .object({
                    tools: z.array(z.unknown()),
                    activeTabId: z.number().nullable(),
                    activeDomain: z.string().nullable(),
                    isDiscovering: z.boolean(),
                    lastUpdated: z.number(),
                })
                .optional(),
            error: z.string().optional(),
        }),
    },

    'webmcp/tool/call': {
        payload: z.object({
            toolName: z.string(),
            args: z.record(z.string(), z.unknown()),
        }),
        response: z.object({
            success: z.boolean(),
            result: z.unknown().optional(),
            error: z.string().optional(),
        }),
    },

    'webmcp/tools/refresh': {
        payload: z.undefined(),
        response: BasicResponseSchema,
    },

    'webmcp/tools/updated': {
        payload: z.object({
            tools: z.array(z.unknown()),
        }),
        response: z.void(),
    },
} as const;

// =============================================================================
// MCP STATIC MESSAGE SCHEMAS
// =============================================================================

/**
 * Schemas for static MCP messages (no server ID)
 */
export const McpStaticMessageSchemas = {
    'mcp/tools/list': {
        payload: z.undefined(),
        response: z.object({
            success: z.boolean(),
            data: z
                .object({
                    tools: z.array(
                        z.object({
                            name: z.string(),
                            description: z.string().optional(),
                            inputSchema: z.record(z.string(), z.unknown()).optional(),
                            serverId: z.string(),
                            serverName: z.string().optional(),
                        })
                    ),
                })
                .optional(),
            error: z.string().optional(),
        }),
    },

    'mcp/custom-servers/reload': {
        payload: z.undefined(),
        response: BasicResponseSchema,
    },

    'mcp/servers/get': {
        payload: z.undefined(),
        response: z.object({
            success: z.boolean(),
            data: z
                .array(
                    z.object({
                        id: z.string(),
                        name: z.string(),
                        state: z.string(),
                        tools: z.array(z.unknown()).optional(),
                    })
                )
                .optional(),
            error: z.string().optional(),
        }),
    },
} as const;

// =============================================================================
// MCP SERVER MESSAGE SCHEMAS
// =============================================================================

/**
 * Schemas for dynamic MCP server messages (with server ID)
 */
export const McpServerMessageSchemas = {
    payloads: {
        'auth/start': z.undefined(),
        'auth/complete': z.object({ code: z.string() }),
        'auth/refresh': z.undefined(),
        enable: z.undefined(),
        disable: z.undefined(),
        disconnect: z.undefined(),
        'status/get': z.undefined(),
        'status/update': z.object({
            state: z.string(),
            error: z.string().optional(),
            tools: z.array(z.unknown()).optional(),
        }),
        'health/check': z.undefined(),
        'tool/call': z.object({
            name: z.string(),
            arguments: z.record(z.string(), z.unknown()).optional(),
        }),
        'tools/list': z.undefined(),
        'tools/config/get': z.undefined(),
        'tools/config/set': z.object({
            disabledTools: z.array(z.string()),
        }),
        'resource/read': z.object({
            uri: z.string(),
        }),
    },
    responses: {
        'auth/start': z.object({
            success: z.boolean(),
            authUrl: z.string().optional(),
            error: z.string().optional(),
        }),
        'auth/complete': BasicResponseSchema,
        'auth/refresh': BasicResponseSchema,
        enable: BasicResponseSchema,
        disable: BasicResponseSchema,
        disconnect: BasicResponseSchema,
        'status/get': z.object({
            success: z.boolean(),
            data: z
                .object({
                    state: z.string(),
                    error: z.string().optional(),
                    tools: z.array(z.unknown()).optional(),
                })
                .optional(),
            error: z.string().optional(),
        }),
        'status/update': BasicResponseSchema,
        'health/check': z.object({
            success: z.boolean(),
            healthy: z.boolean().optional(),
            error: z.string().optional(),
        }),
        'tool/call': z.object({
            success: z.boolean(),
            data: z.unknown().optional(),
            error: z.string().optional(),
        }),
        'tools/list': z.object({
            success: z.boolean(),
            data: z
                .object({
                    tools: z.array(z.unknown()),
                })
                .optional(),
            error: z.string().optional(),
        }),
        'tools/config/get': z.object({
            success: z.boolean(),
            data: z
                .object({
                    disabledTools: z.array(z.string()),
                })
                .optional(),
            error: z.string().optional(),
        }),
        'tools/config/set': BasicResponseSchema,
        'resource/read': z.object({
            success: z.boolean(),
            data: z
                .object({
                    contents: z.array(z.unknown()),
                })
                .optional(),
            error: z.string().optional(),
        }),
    },
} as const;

// =============================================================================
// TYPE INFERENCE
// =============================================================================

/** Type for message schema keys */
export type MessageSchemaType = keyof typeof MessageSchemas;

/** Type for MCP static message schema keys */
export type McpStaticSchemaType = keyof typeof McpStaticMessageSchemas;

/** Type for MCP server action keys */
export type McpServerActionSchemaType = keyof typeof McpServerMessageSchemas.payloads;

/** Inferred payload type from schema */
export type InferredPayload<T extends MessageSchemaType> = z.infer<(typeof MessageSchemas)[T]['payload']>;

/** Inferred response type from schema */
export type InferredResponse<T extends MessageSchemaType> = z.infer<(typeof MessageSchemas)[T]['response']>;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validation result type
 */
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    error?: z.ZodError;
}

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
// VALIDATED SENDER FACTORY
// =============================================================================

/**
 * Options for the validated sender
 */
export interface ValidatedSenderOptions {
    /**
     * Whether to validate payloads before sending.
     * @default true in development, false in production
     */
    validatePayloads?: boolean;

    /**
     * Whether to validate responses after receiving.
     * @default true in development, false in production
     */
    validateResponses?: boolean;

    /**
     * Called when payload validation fails.
     * Default behavior logs a warning.
     */
    onPayloadValidationError?: (type: string, error: z.ZodError, payload: unknown) => void;

    /**
     * Called when response validation fails.
     * Default behavior logs a warning.
     */
    onResponseValidationError?: (type: string, error: z.ZodError, response: unknown) => void;
}

// Check if we're in development mode
const isDevelopment =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

/**
 * Default options for the validated sender
 */
const defaultOptions: Required<ValidatedSenderOptions> = {
    validatePayloads: isDevelopment,
    validateResponses: isDevelopment,
    onPayloadValidationError: (type, error, payload) => {
        console.warn(`[Messaging] Invalid payload for ${type}:`, {
            issues: error.issues,
            payload,
        });
    },
    onResponseValidationError: (type, error, response) => {
        console.warn(`[Messaging] Invalid response for ${type}:`, {
            issues: error.issues,
            response,
        });
    },
};

/**
 * Create a validated message sender that performs runtime validation.
 *
 * Use this in development to catch payload/response errors early.
 * In production, validation is disabled by default for performance.
 *
 * @param options - Validation options
 * @returns A validated sendMessage function
 *
 * @example
 * const sendValidatedMessage = createValidatedSender({
 *   validatePayloads: true,
 *   validateResponses: true,
 * });
 *
 * const response = await sendValidatedMessage('QUEUE_MEMORY_EXTRACTION', {
 *   threadId: '123',
 *   messageCount: 5,
 * });
 */
export function createValidatedSender(options: ValidatedSenderOptions = {}) {
    const opts = { ...defaultOptions, ...options };

    return async function sendValidatedMessage<T extends MessageSchemaType>(
        type: T,
        ...args: z.infer<(typeof MessageSchemas)[T]['payload']> extends undefined
            ? []
            : [payload: z.infer<(typeof MessageSchemas)[T]['payload']>]
    ): Promise<z.infer<(typeof MessageSchemas)[T]['response']>> {
        const [payload] = args;

        // Validate payload if enabled
        if (opts.validatePayloads && payload !== undefined) {
            const result = safeValidatePayload(type, payload);
            if (!result.success && result.error) {
                opts.onPayloadValidationError(type, result.error, payload);
            }
        }

        const message = payload !== undefined ? { type, payload } : { type };

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message ?? 'Unknown messaging error'));
                    return;
                }

                // Validate response if enabled
                if (opts.validateResponses) {
                    const result = safeValidateResponse(type, response);
                    if (!result.success && result.error) {
                        opts.onResponseValidationError(type, result.error, response);
                    }
                }

                resolve(response);
            });
        });
    };
}

// =============================================================================
// PRE-CONFIGURED VALIDATED SENDERS
// =============================================================================

/**
 * Pre-configured validated sender for development use.
 * Validates both payloads and responses, logging warnings on errors.
 */
export const sendValidatedMessage = createValidatedSender({
    validatePayloads: true,
    validateResponses: true,
});

/**
 * Pre-configured strict validated sender.
 * Throws errors on validation failures instead of just logging.
 */
export const sendStrictValidatedMessage = createValidatedSender({
    validatePayloads: true,
    validateResponses: true,
    onPayloadValidationError: (type, error, payload) => {
        throw new Error(
            `Invalid payload for message ${type}: ${error.message}. Payload: ${JSON.stringify(payload)}`
        );
    },
    onResponseValidationError: (type, error, response) => {
        throw new Error(
            `Invalid response for message ${type}: ${error.message}. Response: ${JSON.stringify(response)}`
        );
    },
});

// =============================================================================
// VALIDATION MIDDLEWARE FOR HANDLERS
// =============================================================================

/**
 * Create a validation wrapper for message handlers.
 * Validates incoming payloads before the handler processes them.
 *
 * @param type - The message type
 * @param handler - The message handler function
 * @returns A wrapped handler that validates payloads
 *
 * @example
 * const handlers = {
 *   'QUEUE_MEMORY_EXTRACTION': withPayloadValidation(
 *     'QUEUE_MEMORY_EXTRACTION',
 *     async (payload) => {
 *       // payload is guaranteed to be valid here
 *       return { success: true };
 *     }
 *   ),
 * };
 */
export function withPayloadValidation<T extends MessageSchemaType>(
    type: T,
    handler: (
        payload: z.infer<(typeof MessageSchemas)[T]['payload']>,
        sender: chrome.runtime.MessageSender
    ) => Promise<z.infer<(typeof MessageSchemas)[T]['response']>> | z.infer<(typeof MessageSchemas)[T]['response']>
): (
    payload: unknown,
    sender: chrome.runtime.MessageSender
) => Promise<z.infer<(typeof MessageSchemas)[T]['response']>> {
    return async (payload: unknown, sender: chrome.runtime.MessageSender) => {
        // Validate payload
        const validationResult = safeValidatePayload(type, payload);
        if (!validationResult.success) {
            console.error(`[Handler] Invalid payload for ${type}:`, validationResult.error?.issues);
            // Return error response for most message types
            return { success: false, error: `Invalid payload: ${validationResult.error?.message}` } as z.infer<
                (typeof MessageSchemas)[T]['response']
            >;
        }

        return handler(validationResult.data!, sender);
    };
}

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
