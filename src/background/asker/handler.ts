/**
 * Asker Message Handler
 * Handles ask request messages with response via port
 */

import { createLogger } from '~logger';
import { geminiAsker, type AskerOptions } from './geminiAsker';
import type { AskGenerateRequest } from '@/types';

const log = createLogger('AskerHandler', 'BACKGROUND');

const ERROR_CODES = {
    NO_API_KEY: 'NO_API_KEY',
    RATE_LIMITED: 'RATE_LIMITED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    PORT_DISCONNECTED: 'PORT_DISCONNECTED',
    ASK_FAILED: 'ASK_FAILED',
} as const;

function getErrorDetails(error: unknown): { message: string; code: string } {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('No AI provider configured') || errorMessage.includes('API key')) {
        return {
            message: 'Please configure your API key in settings to use the ask command.',
            code: ERROR_CODES.NO_API_KEY,
        };
    }

    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        return {
            message: 'Too many requests. Please wait a moment and try again.',
            code: ERROR_CODES.RATE_LIMITED,
        };
    }

    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        return {
            message: 'Network error. Please check your connection and try again.',
            code: ERROR_CODES.NETWORK_ERROR,
        };
    }

    if (errorMessage.includes('API error:')) {
        const statusMatch = errorMessage.match(/API error: (\d+)/);
        const status = statusMatch?.[1] ? parseInt(statusMatch[1], 10) : 0;

        if (status === 401 || status === 403) {
            return {
                message: 'Invalid API key. Please check your credentials in settings.',
                code: ERROR_CODES.NO_API_KEY,
            };
        }

        if (status >= 500) {
            return {
                message: 'The AI service is temporarily unavailable. Please try again later.',
                code: ERROR_CODES.ASK_FAILED,
            };
        }
    }

    return {
        message: errorMessage || 'An unexpected error occurred. Please try again.',
        code: ERROR_CODES.ASK_FAILED,
    };
}

/**
 * Handle ask generate request
 */
export async function handleAskGenerate(
    request: AskGenerateRequest,
    port: chrome.runtime.Port
): Promise<void> {
    const { question, conversationHistory, pageContext, settings, attachment } = request.payload;

    log.info('Processing ask request', {
        questionLength: question.length,
        historyLength: conversationHistory?.length || 0,
        domain: pageContext?.domain,
        hasSelectedText: !!pageContext?.selectedText,
        hasAttachment: !!attachment,
    });

    const options: AskerOptions = {
        maxTokens: settings?.maxTokens,
        pageContext,
        conversationHistory,
        enableUrlContext: settings?.enableUrlContext ?? false,
        enableGoogleSearch: settings?.enableGoogleSearch ?? false,
        enableSupermemorySearch: settings?.enableSupermemorySearch ?? false,
        attachment,
    };

    let isPortConnected = true;
    port.onDisconnect.addListener(() => {
        isPortConnected = false;
        log.debug('Port disconnected during ask generation');
    });

    try {
        const text = await geminiAsker.generateAnswer(question, options);

        log.info('Answer generated', { textLength: text.length });

        if (isPortConnected) {
            try {
                port.postMessage({
                    action: 'ASK_STREAM_CHUNK',
                    text: text,
                    done: false,
                });
                port.postMessage({
                    action: 'ASK_STREAM_CHUNK',
                    text: '',
                    done: true,
                });
                log.info('Answer sent to content script');
            } catch (postError) {
                log.error('Failed to post message', postError);
            }
        }
    } catch (error) {
        log.error('Ask generation failed', error);

        const { message, code } = getErrorDetails(error);

        if (isPortConnected) {
            try {
                port.postMessage({
                    action: 'ASK_ERROR',
                    error: message,
                    code,
                });
            } catch {
                log.debug('Failed to send error message');
            }
        }
    }
}
