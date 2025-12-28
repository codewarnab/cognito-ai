/**
 * Logger Handler
 *
 * Handles logger configuration sync with webapp:
 * - LOGGER_CONFIG_UPDATE: Update logger config from webapp
 * - LOGGER_CONFIG_REQUEST: Get current logger config
 */

import { createLogger } from '~logger';
import type { ExternalMessage, ExternalResponse } from '@cognito/shared';
import {
    LOGGER_CONFIG_KEY,
    LOG_PRESETS,
    type LoggerConfigUpdatePayload,
    type LoggerConfigResponse,
} from '@cognito/shared';
import { successResponse, errorResponse } from '../utils';

const log = createLogger('ExternalMessaging:Logger', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const LOGGER_MESSAGE_TYPES = [
    'LOGGER_CONFIG_UPDATE',
    'LOGGER_CONFIG_REQUEST',
] as const;

/**
 * Handle logger-related messages
 */
export async function handleLoggerMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'LOGGER_CONFIG_UPDATE':
            return handleLoggerConfigUpdate(
                message.payload as LoggerConfigUpdatePayload
            );

        case 'LOGGER_CONFIG_REQUEST':
            return handleLoggerConfigRequest();

        default:
            return null;
    }
}

/**
 * Handle LOGGER_CONFIG_UPDATE message
 */
async function handleLoggerConfigUpdate(
    payload: LoggerConfigUpdatePayload | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload?.config) {
            return errorResponse('Missing config in payload');
        }

        await chrome.storage.local.set({ [LOGGER_CONFIG_KEY]: payload.config });
        log.info('Logger config updated from webapp');
        return successResponse();
    } catch (error) {
        log.error('Failed to update logger config', error);
        return errorResponse('Failed to update logger config');
    }
}

/**
 * Handle LOGGER_CONFIG_REQUEST message
 */
async function handleLoggerConfigRequest(): Promise<ExternalResponse> {
    try {
        const result = await chrome.storage.local.get([LOGGER_CONFIG_KEY]);
        const config = result[LOGGER_CONFIG_KEY] || LOG_PRESETS.DEVELOPMENT;
        const response: LoggerConfigResponse = { config };
        return successResponse(response);
    } catch (error) {
        log.error('Failed to get logger config', error);
        return errorResponse('Failed to get logger config');
    }
}
