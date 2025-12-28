/**
 * Search Settings Handler
 *
 * Handles search settings-related external messages:
 * - GET_SEARCH_SETTINGS: Get search settings with API keys
 * - SET_SEARCH_SETTINGS: Update search settings
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    SearchSettingsWithKeys,
} from '@cognito/shared';
import {
    getSearchSettings,
    saveSearchSettings,
    getSearchApiKeys,
    saveSearchApiKeys,
} from '@/utils/settings/searchSettings';
import { successResponse, errorResponse } from '../../utils';

const log = createLogger('ExternalMessaging:SearchSettings', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const SEARCH_SETTINGS_MESSAGE_TYPES = [
    'GET_SEARCH_SETTINGS',
    'SET_SEARCH_SETTINGS',
] as const;

/**
 * Handle search settings-related messages
 */
export async function handleSearchSettingsMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_SEARCH_SETTINGS':
            return handleGetSearchSettings();

        case 'SET_SEARCH_SETTINGS':
            return handleSetSearchSettings(
                message.payload as Partial<SearchSettingsWithKeys>
            );

        default:
            return null;
    }
}

/**
 * Handle GET_SEARCH_SETTINGS message
 */
async function handleGetSearchSettings(): Promise<ExternalResponse> {
    try {
        const settings = await getSearchSettings();
        const apiKeys = await getSearchApiKeys();
        const response: SearchSettingsWithKeys = {
            ...settings,
            apiKeys,
        };
        return successResponse(response);
    } catch (error) {
        log.error('Failed to get search settings', error);
        return errorResponse('Failed to get search settings');
    }
}

/**
 * Handle SET_SEARCH_SETTINGS message
 */
async function handleSetSearchSettings(
    payload: Partial<SearchSettingsWithKeys> | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        // Separate settings and API keys
        const { apiKeys, ...settings } = payload;

        if (Object.keys(settings).length > 0) {
            const current = await getSearchSettings();
            await saveSearchSettings({ ...current, ...settings });
        }

        if (apiKeys) {
            const currentKeys = await getSearchApiKeys();
            await saveSearchApiKeys({ ...currentKeys, ...apiKeys });
        }

        return successResponse();
    } catch (error) {
        log.error('Failed to set search settings', error);
        return errorResponse('Failed to set search settings');
    }
}
