/**
 * Text Processing Settings Handler
 *
 * Handles text summarizer and rewriter settings:
 * - GET_SUMMARIZER_SETTINGS / SET_SUMMARIZER_SETTINGS
 * - GET_REWRITER_SETTINGS / SET_REWRITER_SETTINGS
 * - GET_WRITE_SETTINGS / SET_WRITE_SETTINGS
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    TextSummarizerSettings,
    TextRewriterSettings,
    WriteCommandSettings,
} from '@cognito/shared';
import {
    getTextSummarizerSettings,
    saveTextSummarizerSettings,
} from '@/utils/settings/textSummarizerSettings';
import {
    getRewriteSettings,
    saveRewriteSettings,
} from '@/utils/settings/rewriteSettings';
import {
    getWriteCommandSettings,
    saveWriteCommandSettings,
} from '@/utils/settings/writeCommandSettings';
import { successResponse, errorResponse } from '../../utils';

const log = createLogger('ExternalMessaging:TextSettings', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const TEXT_SETTINGS_MESSAGE_TYPES = [
    'GET_SUMMARIZER_SETTINGS',
    'SET_SUMMARIZER_SETTINGS',
    'GET_REWRITER_SETTINGS',
    'SET_REWRITER_SETTINGS',
    'GET_WRITE_SETTINGS',
    'SET_WRITE_SETTINGS',
] as const;

/**
 * Handle text processing settings-related messages
 */
export async function handleTextSettingsMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_SUMMARIZER_SETTINGS':
            return handleGetSummarizerSettings();

        case 'SET_SUMMARIZER_SETTINGS':
            return handleSetSummarizerSettings(
                message.payload as Partial<TextSummarizerSettings>
            );

        case 'GET_REWRITER_SETTINGS':
            return handleGetRewriterSettings();

        case 'SET_REWRITER_SETTINGS':
            return handleSetRewriterSettings(
                message.payload as Partial<TextRewriterSettings>
            );

        case 'GET_WRITE_SETTINGS':
            return handleGetWriteSettings();

        case 'SET_WRITE_SETTINGS':
            return handleSetWriteSettings(
                message.payload as Partial<WriteCommandSettings>
            );

        default:
            return null;
    }
}

// ============================================================================
// Summarizer Settings
// ============================================================================

/**
 * Handle GET_SUMMARIZER_SETTINGS message
 */
async function handleGetSummarizerSettings(): Promise<ExternalResponse> {
    try {
        const settings = await getTextSummarizerSettings();
        return successResponse(settings as TextSummarizerSettings);
    } catch (error) {
        log.error('Failed to get summarizer settings', error);
        return errorResponse('Failed to get summarizer settings');
    }
}

/**
 * Handle SET_SUMMARIZER_SETTINGS message
 */
async function handleSetSummarizerSettings(
    payload: Partial<TextSummarizerSettings> | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        const current = await getTextSummarizerSettings();
        await saveTextSummarizerSettings({ ...current, ...payload });
        return successResponse();
    } catch (error) {
        log.error('Failed to set summarizer settings', error);
        return errorResponse('Failed to set summarizer settings');
    }
}

// ============================================================================
// Rewriter Settings
// ============================================================================

/**
 * Handle GET_REWRITER_SETTINGS message
 */
async function handleGetRewriterSettings(): Promise<ExternalResponse> {
    try {
        const settings = await getRewriteSettings();
        return successResponse(settings as TextRewriterSettings);
    } catch (error) {
        log.error('Failed to get rewriter settings', error);
        return errorResponse('Failed to get rewriter settings');
    }
}

/**
 * Handle SET_REWRITER_SETTINGS message
 */
async function handleSetRewriterSettings(
    payload: Partial<TextRewriterSettings> | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        const current = await getRewriteSettings();
        await saveRewriteSettings({ ...current, ...payload });
        return successResponse();
    } catch (error) {
        log.error('Failed to set rewriter settings', error);
        return errorResponse('Failed to set rewriter settings');
    }
}

// ============================================================================
// Write Command Settings
// ============================================================================

/**
 * Handle GET_WRITE_SETTINGS message
 */
async function handleGetWriteSettings(): Promise<ExternalResponse> {
    try {
        const settings = await getWriteCommandSettings();
        return successResponse(settings as WriteCommandSettings);
    } catch (error) {
        log.error('Failed to get write settings', error);
        return errorResponse('Failed to get write settings');
    }
}

/**
 * Handle SET_WRITE_SETTINGS message
 */
async function handleSetWriteSettings(
    payload: Partial<WriteCommandSettings> | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        const current = await getWriteCommandSettings();
        await saveWriteCommandSettings({ ...current, ...payload });
        return successResponse();
    } catch (error) {
        log.error('Failed to set write settings', error);
        return errorResponse('Failed to set write settings');
    }
}
