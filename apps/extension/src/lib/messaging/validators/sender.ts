/**
 * Validated Sender Factory
 *
 * Creates typed message senders with optional runtime validation.
 * Use in development to catch payload/response errors early.
 */

import { z } from 'zod';
import { MessageSchemas, type MessageSchemaType } from './messages';
import { safeValidatePayload, safeValidateResponse } from './functions';

// =============================================================================
// VALIDATED SENDER OPTIONS
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

// =============================================================================
// VALIDATED SENDER FACTORY
// =============================================================================

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
