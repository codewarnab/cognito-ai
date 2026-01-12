/**
 * Validation Middleware for Handlers
 *
 * Wraps message handlers with payload validation.
 * Ensures handlers receive validated, typed payloads.
 */

import { z } from 'zod';
import { MessageSchemas, type MessageSchemaType } from './messages';
import { safeValidatePayload } from './functions';

// =============================================================================
// VALIDATION MIDDLEWARE
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
