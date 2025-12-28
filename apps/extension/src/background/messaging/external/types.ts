/**
 * External Handler Types
 *
 * Type definitions for external message handlers
 */

import type { ExternalMessage, ExternalResponse } from '@cognito/shared';

/**
 * Handler function signature for external messages
 */
export type ExternalMessageHandler<T = unknown> = (
    message: ExternalMessage,
    sender: chrome.runtime.MessageSender
) => Promise<ExternalResponse<T>>;

/**
 * Handler registration entry
 */
export interface HandlerRegistration {
    /** Message types this handler processes */
    types: string[];
    /** Handler function */
    handler: ExternalMessageHandler;
}

/**
 * Result from a handler that indicates it handled the message
 */
export interface HandledResult<T = unknown> {
    handled: true;
    response: ExternalResponse<T>;
}

/**
 * Result from a handler that indicates it did not handle the message
 */
export interface UnhandledResult {
    handled: false;
}

/**
 * Union type for handler results
 */
export type HandlerResult<T = unknown> = HandledResult<T> | UnhandledResult;
