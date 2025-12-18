/**
 * Graceful Degradation for Backend Mode
 *
 * Handles automatic fallback to BYOK mode when backend rate limits are exceeded.
 */

import { createLogger } from '~logger';
import { useSettingsStore } from '@/stores/settings/settingsStore';

const log = createLogger('GracefulDegradation', 'AI_CHAT');

export interface RateLimitError {
    status: number;
    message: string;
    retryAfter?: number;
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
    if (error && typeof error === 'object' && 'status' in error) {
        return (error as RateLimitError).status === 429;
    }
    if (error instanceof Error) {
        return error.message.toLowerCase().includes('rate limit') ||
               error.message.toLowerCase().includes('quota exceeded') ||
               error.message.toLowerCase().includes('too many requests');
    }
    return false;
}

/**
 * Check if user has an API key configured for fallback
 */
export function hasApiKeyForFallback(): boolean {
    const state = useSettingsStore.getState();
    return !!state.googleApiKey;
}

/**
 * Switch to BYOK mode (fallback from backend mode)
 */
export function switchToBYOKMode(): void {
    log.info('Switching to BYOK mode due to rate limit');
    useSettingsStore.getState().setUseBackendMode(false);
}

/**
 * Handle rate limit error with graceful degradation
 * Returns true if fallback was triggered, false otherwise
 */
export function handleRateLimitError(
    error: unknown,
    options?: {
        autoFallback?: boolean;
        onFallback?: () => void;
        onNoFallback?: (retryAfter?: number) => void;
    }
): boolean {
    if (!isRateLimitError(error)) {
        return false;
    }

    const { autoFallback = false, onFallback, onNoFallback } = options || {};
    const hasKey = hasApiKeyForFallback();
    const retryAfter = (error as RateLimitError).retryAfter;

    log.warn('Rate limit hit:', {
        hasApiKey: hasKey,
        autoFallback,
        retryAfter,
    });

    if (hasKey && autoFallback) {
        switchToBYOKMode();
        onFallback?.();
        return true;
    }

    onNoFallback?.(retryAfter);
    return false;
}

/**
 * Create error message for rate limit with fallback suggestion
 */
export function createRateLimitMessage(retryAfter?: number): string {
    const hasKey = hasApiKeyForFallback();
    
    let message = '⚠️ Rate limit reached.';
    
    if (retryAfter) {
        message += ` Try again in ${retryAfter} seconds.`;
    }
    
    if (hasKey) {
        message += '\n\nYou have an API key configured. Would you like to switch to BYOK mode?';
    } else {
        message += '\n\nConsider adding your own API key in settings for unlimited usage.';
    }
    
    return message;
}

/**
 * Wrapper for backend requests with automatic retry/fallback
 */
export async function withGracefulDegradation<T>(
    backendFn: () => Promise<T>,
    byokFn: () => Promise<T>,
    options?: {
        maxRetries?: number;
        autoFallback?: boolean;
    }
): Promise<T> {
    const { maxRetries = 1, autoFallback = true } = options || {};
    const hasKey = hasApiKeyForFallback();

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await backendFn();
        } catch (error) {
            lastError = error;

            if (isRateLimitError(error)) {
                log.warn(`Rate limit hit on attempt ${attempt + 1}`);

                // If we have a key and auto-fallback is enabled, switch to BYOK
                if (hasKey && autoFallback) {
                    log.info('Falling back to BYOK mode');
                    switchToBYOKMode();
                    return await byokFn();
                }

                // If this isn't the last attempt, wait and retry
                const retryAfter = (error as RateLimitError).retryAfter || 60;
                if (attempt < maxRetries) {
                    log.info(`Waiting ${retryAfter}s before retry`);
                    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
                }
            } else {
                // Non-rate-limit error, throw immediately
                throw error;
            }
        }
    }

    throw lastError;
}
