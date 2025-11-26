/**
 * Writer Message Handler
 * Handles write request messages with streaming response via port
 */

import { createLogger } from '~logger';
import { geminiWriter, type WriterOptions } from './geminiWriter';
import type { WriteGenerateRequest } from '@/types';

const log = createLogger('WriterHandler', 'BACKGROUND');

/**
 * Error codes for write generation failures
 */
const ERROR_CODES = {
    NO_API_KEY: 'NO_API_KEY',
    RATE_LIMITED: 'RATE_LIMITED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    PORT_DISCONNECTED: 'PORT_DISCONNECTED',
    WRITE_FAILED: 'WRITE_FAILED',
} as const;

/**
 * Get user-friendly error message based on error type
 */
function getErrorDetails(error: unknown): { message: string; code: string } {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // No API key configured
    if (errorMessage.includes('No AI provider configured') || errorMessage.includes('API key')) {
        return {
            message: 'Please configure your API key in settings to use the write command.',
            code: ERROR_CODES.NO_API_KEY,
        };
    }

    // Rate limiting (429 status)
    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        return {
            message: 'Too many requests. Please wait a moment and try again.',
            code: ERROR_CODES.RATE_LIMITED,
        };
    }

    // Network errors
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('network')) {
        return {
            message: 'Network error. Please check your connection and try again.',
            code: ERROR_CODES.NETWORK_ERROR,
        };
    }

    // API errors with status codes
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
                code: ERROR_CODES.WRITE_FAILED,
            };
        }
    }

    // Default error
    return {
        message: errorMessage || 'An unexpected error occurred. Please try again.',
        code: ERROR_CODES.WRITE_FAILED,
    };
}

/**
 * Handle write generate request (non-streaming)
 * Returns full response at once via port
 */
export async function handleWriteGenerateStreaming(
    request: WriteGenerateRequest,
    port: chrome.runtime.Port
): Promise<void> {
    const { prompt, pageContext, settings } = request.payload;

    log.info('Processing write request', {
        promptLength: prompt.length,
        platform: pageContext?.platform,
        domain: pageContext?.domain,
    });

    const options: WriterOptions = {
        tone: settings?.tone,
        maxTokens: settings?.maxTokens,
        pageContext,
    };

    // Track if port is still connected
    let isPortConnected = true;
    port.onDisconnect.addListener(() => {
        isPortConnected = false;
        log.debug('Port disconnected during write generation');
    });

    try {
        // Generate complete response (non-streaming)
        const text = await geminiWriter.generate(prompt, options);

        log.info('Generation complete', { textLength: text.length });

        // Send the complete response
        if (isPortConnected) {
            try {
                port.postMessage({
                    action: 'WRITE_STREAM_CHUNK',
                    text: text,
                    done: false,
                });
                port.postMessage({
                    action: 'WRITE_STREAM_CHUNK',
                    text: '',
                    done: true,
                });
                log.info('Response sent to content script');
            } catch (postError) {
                log.error('Failed to post message', postError);
            }
        } else {
            log.warn('Port disconnected before response could be sent');
        }
    } catch (error) {
        log.error('Write generation failed', error);

        const { message, code } = getErrorDetails(error);

        // Only send error if port is still connected
        if (isPortConnected) {
            try {
                port.postMessage({
                    action: 'WRITE_ERROR',
                    error: message,
                    code,
                });
            } catch {
                log.debug('Failed to send error message, port likely closed');
            }
        }
    }
}
