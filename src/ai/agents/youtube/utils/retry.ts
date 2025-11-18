import { createLogger } from '../../../../logger';
import { ExternalServiceError } from '../../../../errors';

const log = createLogger('YouTube-Retry');

export const MAX_RETRIES = 10;
export const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Retry wrapper with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds
 * @param operationName - Name of the operation for logging
 * @returns The result of the function
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = MAX_RETRIES,
    initialDelay: number = INITIAL_RETRY_DELAY,
    operationName: string = 'operation'
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                log.info(`🔄 Retry attempt ${attempt}/${maxRetries} for ${operationName}`);
            }
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry certain types of errors
            if (error instanceof ExternalServiceError) {
                const status = (error as any).status;
                // Don't retry 4xx errors except 429 (rate limit)
                if (status && status >= 400 && status < 500 && status !== 429) {
                    log.warn(`❌ Non-retryable error for ${operationName} (status ${status})`);
                    throw error;
                }
            }

            // If we've exhausted retries, throw the error
            if (attempt >= maxRetries) {
                log.error(`❌ All retry attempts exhausted for ${operationName}`);
                throw error;
            }

            // Calculate exponential backoff delay
            const delay = initialDelay * Math.pow(2, attempt);
            log.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
}

