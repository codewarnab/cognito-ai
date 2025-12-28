/**
 * Onboarding Handler
 *
 * Handles onboarding-related external messages:
 * - GET_ONBOARDING_STATUS: Check if onboarding is complete
 * - SET_ONBOARDING_COMPLETE: Mark onboarding as complete
 */

import type { ExternalMessage, ExternalResponse } from '@cognito/shared';
import { successResponse } from '../utils';

/**
 * Message types handled by this handler
 */
export const ONBOARDING_MESSAGE_TYPES = [
    'GET_ONBOARDING_STATUS',
    'SET_ONBOARDING_COMPLETE',
] as const;

/**
 * Handle onboarding-related messages
 */
export async function handleOnboardingMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_ONBOARDING_STATUS':
            return handleGetOnboardingStatus();

        case 'SET_ONBOARDING_COMPLETE':
            return handleSetOnboardingComplete();

        default:
            return null;
    }
}

/**
 * Handle GET_ONBOARDING_STATUS message
 */
async function handleGetOnboardingStatus(): Promise<ExternalResponse> {
    const { onboarding_completed } = await chrome.storage.local.get(
        'onboarding_completed'
    );
    return successResponse({ completed: !!onboarding_completed });
}

/**
 * Handle SET_ONBOARDING_COMPLETE message
 */
async function handleSetOnboardingComplete(): Promise<ExternalResponse> {
    await chrome.storage.local.set({ onboarding_completed: true });
    return successResponse();
}
