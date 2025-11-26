/**
 * Summarizer Message Handler
 * Handles summarize request messages with streaming response via port
 */

import { createLogger } from '~logger';
import { geminiSummarizer, type SummarizerOptions } from './geminiSummarizer';
import type { SummarizeRequest } from '@/types';

const log = createLogger('SummarizerHandler', 'BACKGROUND');

/**
 * Error codes for summarization failures
 */
const ERROR_CODES = {
    NO_API_KEY: 'NO_API_KEY',
    RATE_LIMITED: 'RATE_LIMITED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    PORT_DISCONNECTED: 'PORT_DISCONNECTED',
    SUMMARIZE_FAILED: 'SUMMARIZE_FAILED',
} as const;

/**
 * Get user-friendly error message based on error type
 */
function getErrorDetails(error: unknown): { message: string; code: string } {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // No API key configured
    if (errorMessage.includes('No AI provider configured') || errorMessage.includes('API key')) {
        return {
            message: 'Please configure your API key in settings to use summarization.',
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
                code: ERROR_CODES.SUMMARIZE_FAILED,
            };
        }
    }

    // Default error
    return {
        message: errorMessage || 'An unexpected error occurred. Please try again.',
        code: ERROR_CODES.SUMMARIZE_FAILED,
    };
}

/**
 * Handle summarize request with streaming response
 * Streams chunks back via the provided port
 */
export async function handleSummarizeRequest(
    request: SummarizeRequest,
    port: chrome.runtime.Port
): Promise<void> {
    const { text, pageContext, settings } = request.payload;

    log.info('Processing summarize request', {
        textLength: text.length,
        domain: pageContext?.domain,
    });

    const options: SummarizerOptions = {
        summaryType: settings?.summaryType || 'tl-dr',
        summaryLength: settings?.summaryLength || 'medium',
        pageContext,
    };

    // Track if port is still connected
    let isPortConnected = true;
    port.onDisconnect.addListener(() => {
        isPortConnected = false;
        log.debug('Port disconnected during summarization');
    });

    try {
        // Stream chunks back via port
        for await (const chunk of geminiSummarizer.summarizeStream(text, options)) {
            // Check if port is still connected before sending
            if (!isPortConnected) {
                log.warn('Port disconnected, stopping stream');
                return;
            }

            try {
                port.postMessage({
                    action: 'SUMMARIZE_STREAM_CHUNK',
                    text: chunk,
                    done: false,
                });
            } catch (postError) {
                // Port was closed, stop streaming
                log.debug('Failed to post message, port likely closed', postError);
                return;
            }
        }

        // Signal completion only if port is still connected
        if (isPortConnected) {
            try {
                port.postMessage({
                    action: 'SUMMARIZE_STREAM_CHUNK',
                    text: '',
                    done: true,
                });
                log.info('Summary stream completed');
            } catch {
                log.debug('Failed to send completion message');
            }
        }
    } catch (error) {
        log.error('Summarization failed', error);

        const { message, code } = getErrorDetails(error);

        // Only send error if port is still connected
        if (isPortConnected) {
            try {
                port.postMessage({
                    action: 'SUMMARIZE_ERROR',
                    error: message,
                    code,
                });
            } catch {
                log.debug('Failed to send error message, port likely closed');
            }
        }
    }
}
