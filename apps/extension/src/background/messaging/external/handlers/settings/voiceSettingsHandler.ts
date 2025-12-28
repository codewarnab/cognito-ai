/**
 * Voice and TTS Settings Handler
 *
 * Handles voice and TTS settings:
 * - GET_TTS_SETTINGS / SET_TTS_SETTINGS: TTS provider and suggestions
 * - GET_VOICE_SETTINGS / SET_VOICE_SETTINGS: Voice name configuration
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    TTSSettings,
    VoiceSettings,
} from '@cognito/shared';
import {
    getSuggestionsEnabled,
    setSuggestionsEnabled,
    getTTSProvider,
    setTTSProvider,
    getVoiceName,
    setVoiceName,
} from '@/utils/settings/settingsStorage';
import { successResponse, errorResponse } from '../../utils';

const log = createLogger('ExternalMessaging:VoiceSettings', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const VOICE_SETTINGS_MESSAGE_TYPES = [
    'GET_TTS_SETTINGS',
    'SET_TTS_SETTINGS',
    'GET_VOICE_SETTINGS',
    'SET_VOICE_SETTINGS',
] as const;

/**
 * Handle voice and TTS settings-related messages
 */
export async function handleVoiceSettingsMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_TTS_SETTINGS':
            return handleGetTTSSettings();

        case 'SET_TTS_SETTINGS':
            return handleSetTTSSettings(message.payload as Partial<TTSSettings>);

        case 'GET_VOICE_SETTINGS':
            return handleGetVoiceSettings();

        case 'SET_VOICE_SETTINGS':
            return handleSetVoiceSettings(message.payload as Partial<VoiceSettings>);

        default:
            return null;
    }
}

// ============================================================================
// TTS Settings
// ============================================================================

/**
 * Handle GET_TTS_SETTINGS message
 */
async function handleGetTTSSettings(): Promise<ExternalResponse> {
    try {
        const ttsProvider = await getTTSProvider();
        const suggestionsEnabled = await getSuggestionsEnabled();

        const response: TTSSettings = {
            ttsProvider,
            suggestionsEnabled,
        };
        return successResponse(response);
    } catch (error) {
        log.error('Failed to get TTS settings', error);
        return errorResponse('Failed to get TTS settings');
    }
}

/**
 * Handle SET_TTS_SETTINGS message
 */
async function handleSetTTSSettings(
    payload: Partial<TTSSettings> | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        if (payload.ttsProvider !== undefined) {
            await setTTSProvider(payload.ttsProvider);
        }
        if (payload.suggestionsEnabled !== undefined) {
            await setSuggestionsEnabled(payload.suggestionsEnabled);
        }

        return successResponse();
    } catch (error) {
        log.error('Failed to set TTS settings', error);
        return errorResponse('Failed to set TTS settings');
    }
}

// ============================================================================
// Voice Settings
// ============================================================================

/**
 * Handle GET_VOICE_SETTINGS message
 */
async function handleGetVoiceSettings(): Promise<ExternalResponse> {
    try {
        const voiceName = await getVoiceName();
        const response: VoiceSettings = { voiceName };
        return successResponse(response);
    } catch (error) {
        log.error('Failed to get voice settings', error);
        return errorResponse('Failed to get voice settings');
    }
}

/**
 * Handle SET_VOICE_SETTINGS message
 */
async function handleSetVoiceSettings(
    payload: Partial<VoiceSettings> | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        if (payload.voiceName !== undefined) {
            await setVoiceName(payload.voiceName);
        }

        return successResponse();
    } catch (error) {
        log.error('Failed to set voice settings', error);
        return errorResponse('Failed to set voice settings');
    }
}
