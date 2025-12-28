/**
 * Research Workflow Settings Handler
 *
 * Handles research workflow settings:
 * - GET_RESEARCH_SETTINGS: Get research workflow configuration
 * - SET_RESEARCH_SETTINGS: Update research workflow configuration
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    ResearchWorkflowSettings,
} from '@cognito/shared';
import {
    getResearchWorkflowSettings,
    saveResearchWorkflowSettings,
} from '@/utils/settings/researchWorkflowSettings';
import { successResponse, errorResponse } from '../../utils';

const log = createLogger('ExternalMessaging:ResearchSettings', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const RESEARCH_SETTINGS_MESSAGE_TYPES = [
    'GET_RESEARCH_SETTINGS',
    'SET_RESEARCH_SETTINGS',
] as const;

/**
 * Handle research workflow settings-related messages
 */
export async function handleResearchSettingsMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_RESEARCH_SETTINGS':
            return handleGetResearchSettings();

        case 'SET_RESEARCH_SETTINGS':
            return handleSetResearchSettings(
                message.payload as Partial<ResearchWorkflowSettings>
            );

        default:
            return null;
    }
}

/**
 * Handle GET_RESEARCH_SETTINGS message
 */
async function handleGetResearchSettings(): Promise<ExternalResponse> {
    try {
        const settings = await getResearchWorkflowSettings();
        return successResponse(settings as ResearchWorkflowSettings);
    } catch (error) {
        log.error('Failed to get research settings', error);
        return errorResponse('Failed to get research settings');
    }
}

/**
 * Handle SET_RESEARCH_SETTINGS message
 */
async function handleSetResearchSettings(
    payload: Partial<ResearchWorkflowSettings> | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        const current = await getResearchWorkflowSettings();
        await saveResearchWorkflowSettings({ ...current, ...payload });
        return successResponse();
    } catch (error) {
        log.error('Failed to set research settings', error);
        return errorResponse('Failed to set research settings');
    }
}
