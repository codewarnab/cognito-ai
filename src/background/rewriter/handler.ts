/**
 * Rewriter Message Handler
 * Handles rewrite request messages (non-streaming) via port
 */

import { createLogger } from '~logger';
import { geminiRewriter, type RewriterOptions } from './geminiRewriter';
import type { RewriteRequest } from '@/types';

const log = createLogger('RewriterHandler', 'BACKGROUND');

/**
 * Error codes for rewrite failures
 */
const ERROR_CODES = {
    NO_API_KEY: 'NO_API_KEY',
    RATE_LIMITED: 'RATE_LIMITED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    PORT_DISCONNECTED: 'PORT_DISCONNECTED',
    REWRITE_FAILED: 'REWRITE_FAILED',
} as const;

/**
 * Get user-friendly error message based on error type
 */
function getErrorDetails(error: unknown): { message: string; code: string } {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // No API key configured
    if (errorMessage.includes('No AI provider configured') || errorMessage.includes('API key')) {
        return {
            message: 'Please configure your API key in settings to use the rewrite feature.',
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
                code: ERROR_CODES.REWRITE_FAILED,
            };
        }
    }

    // Default error
    return {
        message: errorMessage || 'An unexpected error occurred. Please try again.',
        code: ERROR_CODES.REWRITE_FAILED,
    };
}

/**
 * Handle rewrite request (non-streaming)
 * Returns complete rewritten text in a single message
 */
export async function handleRewriteRequest(
    request: RewriteRequest,
    port: chrome.runtime.Port
): Promise<void> {
    const { selectedText, instruction, preset, enableUrlContext, enableGoogleSearch } = request.payload;

    log.info('Processing rewrite request', {
        textLength: selectedText.length,
        preset,
        hasInstruction: !!instruction,
    });

    // Track port connection
    let isPortConnected = true;
    port.onDisconnect.addListener(() => {
        isPortConnected = false;
        log.debug('Port disconnected during rewrite');
    });

    try {
        const options: RewriterOptions = {
            preset,
            instruction,
            enableUrlContext: enableUrlContext ?? false,
            enableGoogleSearch: enableGoogleSearch ?? false,
        };

        // Generate complete rewrite (non-streaming)
        const rewrittenText = await geminiRewriter.rewrite(selectedText, options);

        log.info('Rewrite complete', { outputLength: rewrittenText.length });

        // Send complete response
        if (isPortConnected) {
            try {
                port.postMessage({
                    action: 'REWRITE_COMPLETE',
                    text: rewrittenText,
                });
            } catch (postError) {
                log.error('Failed to post message', postError);
            }
        } else {
            log.warn('Port disconnected before response could be sent');
        }
    } catch (error) {
        log.error('Rewrite failed', error);

        const { message, code } = getErrorDetails(error);

        // Only send error if port is still connected
        if (isPortConnected) {
            try {
                port.postMessage({
                    action: 'REWRITE_ERROR',
                    error: message,
                    code,
                });
            } catch {
                log.debug('Failed to send error message, port likely closed');
            }
        }
    }
}
