/**
 * Supermemory Settings Handler
 *
 * Handles Supermemory-related settings:
 * - GET_SUPERMEMORY_SETTINGS: Get Supermemory configuration
 * - SET_SUPERMEMORY_SETTINGS: Update Supermemory configuration
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    SupermemorySettings,
} from '@cognito/shared';
import {
    getSupermemoryApiKey,
    setSupermemoryApiKey,
    isSupermemoryEnabled,
    setSupermemoryEnabled,
    isAutoExtractionEnabled,
    setAutoExtractionEnabled,
    isContentMemoryEnabled,
    setContentMemoryEnabled,
} from '@/utils/supermemory';
import { successResponse, errorResponse } from '../../utils';

const log = createLogger('ExternalMessaging:SupermemorySettings', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const SUPERMEMORY_SETTINGS_MESSAGE_TYPES = [
    'GET_SUPERMEMORY_SETTINGS',
    'SET_SUPERMEMORY_SETTINGS',
] as const;

/**
 * Handle Supermemory settings-related messages
 */
export async function handleSupermemorySettingsMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_SUPERMEMORY_SETTINGS':
            return handleGetSupermemorySettings();

        case 'SET_SUPERMEMORY_SETTINGS':
            return handleSetSupermemorySettings(
                message.payload as Partial<SupermemorySettings>
            );

        default:
            return null;
    }
}

/**
 * Handle GET_SUPERMEMORY_SETTINGS message
 */
async function handleGetSupermemorySettings(): Promise<ExternalResponse> {
    try {
        const apiKey = (await getSupermemoryApiKey()) || '';
        const enabled = await isSupermemoryEnabled();
        const autoExtraction = await isAutoExtractionEnabled();
        const contentMemory = await isContentMemoryEnabled();

        const response: SupermemorySettings = {
            apiKey,
            enabled,
            autoExtraction,
            contentMemory,
        };
        return successResponse(response);
    } catch (error) {
        log.error('Failed to get Supermemory settings', error);
        return errorResponse('Failed to get Supermemory settings');
    }
}

/**
 * Handle SET_SUPERMEMORY_SETTINGS message
 */
async function handleSetSupermemorySettings(
    payload: Partial<SupermemorySettings> | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        if (payload.apiKey !== undefined) {
            await setSupermemoryApiKey(payload.apiKey || '');
        }
        if (payload.enabled !== undefined) {
            await setSupermemoryEnabled(payload.enabled);
        }
        if (payload.autoExtraction !== undefined) {
            await setAutoExtractionEnabled(payload.autoExtraction);
        }
        if (payload.contentMemory !== undefined) {
            await setContentMemoryEnabled(payload.contentMemory);
        }

        return successResponse();
    } catch (error) {
        log.error('Failed to set Supermemory settings', error);
        return errorResponse('Failed to set Supermemory settings');
    }
}
