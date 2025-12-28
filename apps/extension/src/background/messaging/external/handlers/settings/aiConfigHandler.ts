/**
 * AI Config Settings Handler
 *
 * Handles AI configuration settings:
 * - GET_AI_CONFIG: Get AI configuration (tool call limits, etc.)
 * - SET_AI_CONFIG: Update AI configuration
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    AIConfigSettings,
} from '@cognito/shared';
import {
    getMaxToolCallLimit,
    setMaxToolCallLimit,
} from '@/utils/settings/settingsStorage';
import { successResponse, errorResponse } from '../../utils';

const log = createLogger('ExternalMessaging:AIConfig', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const AI_CONFIG_MESSAGE_TYPES = [
    'GET_AI_CONFIG',
    'SET_AI_CONFIG',
] as const;

/**
 * Handle AI config-related messages
 */
export async function handleAIConfigMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_AI_CONFIG':
            return handleGetAIConfig();

        case 'SET_AI_CONFIG':
            return handleSetAIConfig(message.payload as Partial<AIConfigSettings>);

        default:
            return null;
    }
}

/**
 * Handle GET_AI_CONFIG message
 */
async function handleGetAIConfig(): Promise<ExternalResponse> {
    try {
        const maxToolCallLimit = await getMaxToolCallLimit();
        const response: AIConfigSettings = { maxToolCallLimit };
        return successResponse(response);
    } catch (error) {
        log.error('Failed to get AI config', error);
        return errorResponse('Failed to get AI config');
    }
}

/**
 * Handle SET_AI_CONFIG message
 */
async function handleSetAIConfig(
    payload: Partial<AIConfigSettings> | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        if (payload.maxToolCallLimit !== undefined) {
            // Clamp value between 1 and 50
            const clamped = Math.max(1, Math.min(50, payload.maxToolCallLimit));
            await setMaxToolCallLimit(clamped);
        }

        return successResponse();
    } catch (error) {
        log.error('Failed to set AI config', error);
        return errorResponse('Failed to set AI config');
    }
}
