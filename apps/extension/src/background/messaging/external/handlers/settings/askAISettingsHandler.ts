/**
 * Ask AI Button Settings Handler
 *
 * Handles Ask AI button visibility settings:
 * - GET_ASK_AI_SETTINGS: Get visibility settings
 * - SET_ASK_AI_SETTINGS: Update visibility settings with actions
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    AskAIButtonSettings,
} from '@cognito/shared';
import {
    getVisibilitySettings,
    hideForever,
    reEnableButton,
    hideForSession,
    clearSessionHide,
    removeDomainFromHidden,
    clearAllHiddenDomains,
    hideForCurrentPage,
} from '@/utils/settings/ask-ai-button-visibility';
import { successResponse, errorResponse } from '../../utils';

const log = createLogger('ExternalMessaging:AskAISettings', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const ASK_AI_SETTINGS_MESSAGE_TYPES = [
    'GET_ASK_AI_SETTINGS',
    'SET_ASK_AI_SETTINGS',
] as const;

/**
 * Payload type for SET_ASK_AI_SETTINGS
 */
interface SetAskAISettingsPayload extends Partial<AskAIButtonSettings> {
    action?: string;
    domain?: string;
}

/**
 * Handle Ask AI button settings-related messages
 */
export async function handleAskAISettingsMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_ASK_AI_SETTINGS':
            return handleGetAskAISettings();

        case 'SET_ASK_AI_SETTINGS':
            return handleSetAskAISettings(message.payload as SetAskAISettingsPayload);

        default:
            return null;
    }
}

/**
 * Handle GET_ASK_AI_SETTINGS message
 */
async function handleGetAskAISettings(): Promise<ExternalResponse> {
    try {
        const settings = await getVisibilitySettings();
        return successResponse(settings as AskAIButtonSettings);
    } catch (error) {
        log.error('Failed to get Ask AI settings', error);
        return errorResponse('Failed to get Ask AI settings');
    }
}

/**
 * Handle SET_ASK_AI_SETTINGS message
 */
async function handleSetAskAISettings(
    payload: SetAskAISettingsPayload | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        // Handle specific actions
        if (payload.action === 'hideForever') {
            await hideForever();
        } else if (payload.action === 'reEnable') {
            await reEnableButton();
        } else if (payload.action === 'hideForSession') {
            await hideForSession();
        } else if (payload.action === 'clearSessionHide') {
            await clearSessionHide();
        } else if (payload.action === 'removeDomain' && payload.domain) {
            await removeDomainFromHidden(payload.domain);
        } else if (payload.action === 'clearAllDomains') {
            await clearAllHiddenDomains();
        } else if (payload.action === 'hideForPage' && payload.domain) {
            await hideForCurrentPage(payload.domain);
        } else if (payload.permanentlyHidden !== undefined) {
            if (payload.permanentlyHidden) {
                await hideForever();
            } else {
                await reEnableButton();
            }
        }

        return successResponse();
    } catch (error) {
        log.error('Failed to set Ask AI settings', error);
        return errorResponse('Failed to set Ask AI settings');
    }
}
