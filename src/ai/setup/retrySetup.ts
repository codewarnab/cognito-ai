/**
 * Retry Manager Setup
 * Configures retry logic for AI streaming
 */

import { generateId } from 'ai';
import { createLogger } from '../../logger';
import { createRetryManager, RetryPresets } from '../../errors/retryManager';
import { formatRetryCountdown } from '../../errors/errorMessages';

const log = createLogger('AI-RetrySetup');

/**
 * Create retry manager with countdown updates
 */
export function createStreamRetryManager(writer: any, abortSignal?: AbortSignal) {
    return createRetryManager({
        ...RetryPresets.Standard,
        abortSignal,
        onRetry: (attempt, delay, error) => {
            log.info('Retrying AI request', { attempt, delay, error: error.message });

            // Write retry status to stream
            const seconds = Math.ceil(delay / 1000);
            const retryMessage = formatRetryCountdown(seconds, attempt, 3);
            writer.write({
                type: 'data-status',
                id: 'retry-status-' + generateId(),
                data: {
                    status: 'retrying',
                    message: retryMessage,
                    attempt,
                    maxAttempts: 3,
                    delay,
                    timestamp: Date.now()
                },
                transient: true,
            });
        },
        onCountdown: (remainingMs, attempt) => {
            // Update countdown in real-time
            const seconds = Math.ceil(remainingMs / 1000);
            if (seconds > 0) {
                writer.write({
                    type: 'data-status',
                    id: 'countdown-' + generateId(),
                    data: {
                        status: 'countdown',
                        remainingSeconds: seconds,
                        attempt,
                        timestamp: Date.now()
                    },
                    transient: true,
                });
            }
        },
    });
}
