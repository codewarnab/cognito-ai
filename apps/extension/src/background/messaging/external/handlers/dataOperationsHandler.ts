/**
 * Data Operations Handler
 *
 * Handles data-related external messages:
 * - DELETE_ALL_CHATS: Clear all chat history
 * - PREVIEW_VOICE: Generate voice preview audio
 * - GET_ALL_SETTINGS: Get all stored settings
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    DeleteAllChatsResponse,
    PreviewVoicePayload,
    PreviewVoiceResponse,
} from '@cognito/shared';
import { clearChatHistory, getDBStats } from '@/db';
import { generateSpeech } from '@/utils/ai';
import { getGoogleApiKey } from '@/utils/credentials';
import { successResponse, errorResponse } from '../utils';

const log = createLogger('ExternalMessaging:DataOperations', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const DATA_OPERATIONS_MESSAGE_TYPES = [
    'GET_ALL_SETTINGS',
    'DELETE_ALL_CHATS',
    'PREVIEW_VOICE',
] as const;

/**
 * Handle data operations-related messages
 */
export async function handleDataOperationsMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_ALL_SETTINGS':
            return handleGetAllSettings();

        case 'DELETE_ALL_CHATS':
            return handleDeleteAllChats();

        case 'PREVIEW_VOICE':
            return handlePreviewVoice(message.payload as PreviewVoicePayload);

        default:
            return null;
    }
}

/**
 * Handle GET_ALL_SETTINGS message
 */
async function handleGetAllSettings(): Promise<ExternalResponse> {
    const allData = await chrome.storage.local.get(null);
    return successResponse(allData);
}

/**
 * Handle DELETE_ALL_CHATS message
 */
async function handleDeleteAllChats(): Promise<ExternalResponse> {
    try {
        const statsBefore = await getDBStats();
        await clearChatHistory();
        const statsAfter = await getDBStats();

        const response: DeleteAllChatsResponse = {
            messagesDeleted:
                statsBefore.chatMessageCount - statsAfter.chatMessageCount,
            threadsDeleted: statsBefore.threadCount - statsAfter.threadCount,
        };
        log.info('All chats deleted via external message', response);
        return successResponse(response);
    } catch (error) {
        log.error('Failed to delete all chats', error);
        return errorResponse('Failed to delete all chats');
    }
}

/**
 * Handle PREVIEW_VOICE message
 */
async function handlePreviewVoice(
    payload: PreviewVoicePayload | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload?.voiceName) {
            return errorResponse('Voice name is required');
        }

        const apiKey = await getGoogleApiKey();
        if (!apiKey) {
            return errorResponse('API key not configured');
        }

        const text =
            payload.text ||
            'Hello! I am your AI assistant. This is how I sound.';
        const audioBuffer = await generateSpeech(text, apiKey, {
            voiceName: payload.voiceName,
        });

        // Convert ArrayBuffer to base64
        const uint8Array = new Uint8Array(audioBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]!);
        }
        const audioData = btoa(binary);

        const response: PreviewVoiceResponse = {
            audioData,
            mimeType: 'audio/wav',
        };
        return successResponse(response);
    } catch (error) {
        log.error('Failed to preview voice', error);
        return errorResponse(
            error instanceof Error ? error.message : 'Failed to preview voice'
        );
    }
}
