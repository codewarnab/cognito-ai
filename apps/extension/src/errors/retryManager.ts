/**
 * Retry manager with exponential backoff and jitter
 * Handles automatic retry logic for transient errors
 */

import { isRetryableError, getRetryAfter } from './errorTypes';

/**
 * Retry configuration for different error scenarios
 */
export interface RetryConfig {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Initial delay in milliseconds (default: 1000) */
    initialDelay?: number;
    /** Maximum delay in milliseconds (default: 32000) */
    maxDelay?: number;
    /** Backoff multiplier (default: 2) */
    backoffMultiplier?: number;
    /** Add random jitter to prevent thundering herd (default: true) */
    useJitter?: boolean;
    /** Jitter factor (0-1, default: 0.1 means ±10% randomness) */
    jitterFactor?: number;
    /** Custom retry decision function */
    shouldRetry?: (error: Error, attempt: number) => boolean;
    /** Callback for retry events */
    onRetry?: (attempt: number, delay: number, error: Error) => void;
    /** Callback for countdown updates */
    onCountdown?: (remainingMs: number, attempt: number) => void;
    /** Abort signal to cancel retries */
    abortSignal?: AbortSignal;
}

/**
 * Retry state tracking
 */
interface RetryState {
    attempt: number;
    totalDelay: number;
    lastError?: Error;
    startTime: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'shouldRetry' | 'onRetry' | 'onCountdown' | 'abortSignal'>> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 32000,
    backoffMultiplier: 2,
    useJitter: true,
    jitterFactor: 0.1,
};

/**
 * Calculate delay for next retry using exponential backoff
 */
function calculateBackoff(
    attempt: number,
    config: Required<Omit<RetryConfig, 'shouldRetry' | 'onRetry' | 'onCountdown' | 'abortSignal'>>
): number {
    const { initialDelay, maxDelay, backoffMultiplier, useJitter, jitterFactor } = config;

    // Calculate exponential backoff
    let delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);

    // Add jitter to prevent thundering herd
    if (useJitter) {
        const jitter = delay * jitterFactor;
        const randomJitter = (Math.random() - 0.5) * 2 * jitter; // Random value between -jitter and +jitter
        delay = Math.max(0, delay + randomJitter);
    }

    return Math.floor(delay);
}

/**
 * Parse Retry-After header value
 * Supports both seconds (integer) and HTTP date formats
 */
function parseRetryAfter(retryAfter: string | number | undefined): number | undefined {
    if (!retryAfter) return undefined;

    // If it's already a number (from error object), return it
    if (typeof retryAfter === 'number') {
        return retryAfter;
    }

    // Try to parse as integer (seconds)
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
        return seconds * 1000; // Convert to milliseconds
    }

    // Try to parse as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
        return Math.max(0, date.getTime() - Date.now());
    }

    return undefined;
}

/**
 * Sleep for a specified duration with countdown callback
 */
async function sleep(
    ms: number,
    onCountdown?: (remainingMs: number, attempt: number) => void,
    attempt?: number,
    abortSignal?: AbortSignal
): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + ms;

    return new Promise((resolve, reject) => {
        // Check if already aborted
        if (abortSignal?.aborted) {
            reject(new Error('Retry cancelled'));
            return;
        }

        // Set up abort listener
        const abortListener = () => {
            clearInterval(countdownInterval);
            clearTimeout(timer);
            reject(new Error('Retry cancelled'));
        };

        abortSignal?.addEventListener('abort', abortListener);

        // Update countdown every 100ms if callback provided
        let countdownInterval: NodeJS.Timeout | undefined;
        if (onCountdown && attempt !== undefined) {
            countdownInterval = setInterval(() => {
                const remaining = Math.max(0, endTime - Date.now());
                onCountdown(remaining, attempt);
                if (remaining <= 0) {
                    clearInterval(countdownInterval);
                }
            }, 100);
        }

        // Main timeout
        const timer = setTimeout(() => {
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }
            abortSignal?.removeEventListener('abort', abortListener);
            resolve();
        }, ms);
    });
}

/**
 * Retry manager class for handling retry logic
 */
export class RetryManager {
    private config: Required<Omit<RetryConfig, 'shouldRetry' | 'onRetry' | 'onCountdown' | 'abortSignal'>>;
    private shouldRetry?: (error: Error, attempt: number) => boolean;
    private onRetry?: (attempt: number, delay: number, error: Error) => void;
    private onCountdown?: (remainingMs: number, attempt: number) => void;
    private abortSignal?: AbortSignal;

    constructor(config: RetryConfig = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        };
        this.shouldRetry = config.shouldRetry;
        this.onRetry = config.onRetry;
        this.onCountdown = config.onCountdown;
        this.abortSignal = config.abortSignal;
    }

    /**
     * Determine if an error should be retried
     */
    private shouldRetryError(error: Error, attempt: number): boolean {
        // Check abort signal
        if (this.abortSignal?.aborted) {
            return false;
        }

        // Check if max retries exceeded
        if (attempt > this.config.maxRetries) {
            return false;
        }

        // Use custom retry logic if provided
        if (this.shouldRetry) {
            return this.shouldRetry(error, attempt);
        }

        // Default: retry if error is marked as retryable
        return isRetryableError(error);
    }

    /**
     * Calculate delay for next retry, respecting rate limit headers
     */
    private calculateDelay(error: Error, attempt: number): number {
        // Check for explicit retry-after value
        const retryAfter = getRetryAfter(error);
        if (retryAfter !== undefined) {
            return parseRetryAfter(retryAfter) || this.calculateBackoff(attempt);
        }

        // Use exponential backoff
        return this.calculateBackoff(attempt);
    }

    /**
     * Calculate backoff delay
     */
    private calculateBackoff(attempt: number): number {
        return calculateBackoff(attempt, this.config);
    }

    /**
     * Execute a function with retry logic
     */
    async execute<T>(
        fn: () => Promise<T>,
        _context?: string
    ): Promise<T> {
        const state: RetryState = {
            attempt: 0,
            totalDelay: 0,
            startTime: Date.now(),
        };

        while (true) {
            try {
                // Check abort signal before attempting
                if (this.abortSignal?.aborted) {
                    throw new Error('Operation cancelled');
                }

                state.attempt++;
                return await fn();
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                state.lastError = err;

                // Check if we should retry
                if (!this.shouldRetryError(err, state.attempt)) {
                    throw err;
                }

                // Calculate delay
                const delay = this.calculateDelay(err, state.attempt);
                state.totalDelay += delay;

                // Emit retry event
                if (this.onRetry) {
                    this.onRetry(state.attempt, delay, err);
                }

                // Wait before retrying
                await sleep(delay, this.onCountdown, state.attempt, this.abortSignal);
            }
        }
    }

    /**
     * Execute with retry and return detailed result
     */
    async executeWithState<T>(
        fn: () => Promise<T>
    ): Promise<{
        result?: T;
        error?: Error;
        attempts: number;
        totalDelay: number;
        duration: number;
    }> {
        const state: RetryState = {
            attempt: 0,
            totalDelay: 0,
            startTime: Date.now(),
        };

        try {
            const result = await this.execute(fn);
            return {
                result,
                attempts: state.attempt,
                totalDelay: state.totalDelay,
                duration: Date.now() - state.startTime,
            };
        } catch (error) {
            return {
                error: error instanceof Error ? error : new Error(String(error)),
                attempts: state.attempt,
                totalDelay: state.totalDelay,
                duration: Date.now() - state.startTime,
            };
        }
    }

    /**
     * Create a new retry manager with different config
     */
    withConfig(config: Partial<RetryConfig>): RetryManager {
        return new RetryManager({
            ...this.config,
            ...config,
            shouldRetry: config.shouldRetry || this.shouldRetry,
            onRetry: config.onRetry || this.onRetry,
            onCountdown: config.onCountdown || this.onCountdown,
            abortSignal: config.abortSignal || this.abortSignal,
        });
    }
}

/**
 * Create a retry manager with default config
 */
export function createRetryManager(config?: RetryConfig): RetryManager {
    return new RetryManager(config);
}

/**
 * Helper to extract rate limit info from HTTP response headers
 */
export function extractRateLimitInfo(headers: Headers | Record<string, string>): {
    retryAfter?: number;
    limit?: number;
    remaining?: number;
    reset?: number;
} {
    const getHeader = (name: string): string | null => {
        if (headers instanceof Headers) {
            return headers.get(name);
        }
        return headers[name] || headers[name.toLowerCase()] || null;
    };

    const retryAfter = getHeader('Retry-After') || getHeader('X-RateLimit-Retry-After');
    const limit = getHeader('X-RateLimit-Limit');
    const remaining = getHeader('X-RateLimit-Remaining');
    const reset = getHeader('X-RateLimit-Reset');

    return {
        retryAfter: retryAfter ? parseRetryAfter(retryAfter) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        remaining: remaining ? parseInt(remaining, 10) : undefined,
        reset: reset ? parseInt(reset, 10) * 1000 : undefined, // Convert to ms
    };
}

/**
 * Predefined retry configs for common scenarios
 */
export const RetryPresets = {
    /** Quick retry for transient errors (3 attempts, short delays) */
    Quick: {
        maxRetries: 3,
        initialDelay: 500,
        maxDelay: 5000,
        backoffMultiplier: 2,
    } as RetryConfig,

    /** Standard retry for API calls (3 attempts, moderate delays) */
    Standard: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 32000,
        backoffMultiplier: 2,
    } as RetryConfig,

    /** Aggressive retry for critical operations (5 attempts, longer delays) */
    Aggressive: {
        maxRetries: 5,
        initialDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 2,
    } as RetryConfig,

    /** Conservative retry for rate-limited APIs (2 attempts, respect rate limits) */
    RateLimited: {
        maxRetries: 2,
        initialDelay: 5000,
        maxDelay: 60000,
        backoffMultiplier: 3,
    } as RetryConfig,

    /** No retry (for debugging or non-retryable operations) */
    NoRetry: {
        maxRetries: 0,
    } as RetryConfig,
};
