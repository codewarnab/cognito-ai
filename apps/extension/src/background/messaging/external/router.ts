/**
 * External Message Router
 *
 * Central routing system for external messages from webapp/content scripts.
 * Delegates to specialized handlers based on message type.
 */

import { createLogger } from '~logger';
import type { ExternalMessage, ExternalResponse } from '@cognito/shared';
import { ALLOWED_EXTERNAL_ORIGINS } from '~/constants/webapp';

// Import handlers
import {
    handleLifecycleMessage,
    handleOnboardingMessage,
    handleReminderMessage,
    handleProviderMessage,
    handleDataOperationsMessage,
    handleLoggerMessage,
    handleStoresMessage,
    handleSearchSettingsMessage,
    handleAskAISettingsMessage,
    handleTextSettingsMessage,
    handleSupermemorySettingsMessage,
    handleResearchSettingsMessage,
    handleVoiceSettingsMessage,
    handleAIConfigMessage,
} from './handlers';
import { errorResponse, checkRateLimit } from './utils';

const log = createLogger('ExternalMessaging', 'BACKGROUND');

/**
 * List of handlers in order of priority
 * Each handler returns null if it doesn't handle the message type
 */
const handlers = [
    handleLifecycleMessage,
    handleOnboardingMessage,
    handleReminderMessage,
    handleProviderMessage,
    handleDataOperationsMessage,
    handleLoggerMessage,
    handleStoresMessage,
    // Settings handlers
    handleSearchSettingsMessage,
    handleAskAISettingsMessage,
    handleTextSettingsMessage,
    handleSupermemorySettingsMessage,
    handleResearchSettingsMessage,
    handleVoiceSettingsMessage,
    handleAIConfigMessage,
];

/**
 * Route an external message to the appropriate handler
 */
export async function routeExternalMessage(
    message: ExternalMessage,
    sender: chrome.runtime.MessageSender
): Promise<ExternalResponse> {
    for (const handler of handlers) {
        const response = await handler(message, sender);
        if (response !== null) {
            return response;
        }
    }

    // No handler matched
    return errorResponse(`Unknown message type: ${message.type}`);
}

/**
 * Initialize the external message router
 * Sets up the main chrome.runtime.onMessageExternal listener
 */
export function initializeExternalMessageRouter(): void {
    chrome.runtime.onMessageExternal.addListener(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (message: ExternalMessage, sender, sendResponse: (response: ExternalResponse<any>) => void) => {
            log.info('Received external message:', message.type, 'from', sender.url);

            // Validate message format
            if (!message?.type || typeof message.type !== 'string') {
                log.warn('Rejected message with invalid format');
                sendResponse(errorResponse('Invalid message format'));
                return true;
            }

            // Verify sender origin
            const origin = sender.url ? new URL(sender.url).origin : null;
            if (
                !origin ||
                !ALLOWED_EXTERNAL_ORIGINS.some(
                    (allowed) => origin === allowed
                )
            ) {
                log.warn('Rejected message from unauthorized origin:', origin);
                sendResponse(errorResponse('Unauthorized origin'));
                return true;
            }

            // Check rate limit
            if (!checkRateLimit(origin)) {
                log.warn('Rate limit exceeded for origin:', origin);
                sendResponse(errorResponse('Rate limit exceeded'));
                return true;
            }

            routeExternalMessage(message, sender)
                .then((response) => {
                    sendResponse(response);
                })
                .catch((error) => {
                    log.error('Error handling external message:', error);
                    sendResponse(errorResponse(error));
                });

            return true; // Async response
        }
    );

    log.info('External message router initialized');
}
