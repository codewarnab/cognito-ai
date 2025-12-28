/**
 * External Handler Utilities
 *
 * Shared utilities for external message handlers
 */

import type { ExternalResponse } from '@cognito/shared';

// Rate limiting
const rateLimits = new Map<string, number[]>();
const WINDOW_MS = 60000;
const MAX_REQUESTS = 100;

/**
 * Check if origin is within rate limit
 * Returns true if allowed, false if rate limited
 */
export function checkRateLimit(origin: string): boolean {
    const now = Date.now();
    const timestamps = rateLimits.get(origin) || [];
    const recent = timestamps.filter(t => now - t < WINDOW_MS);
    if (recent.length >= MAX_REQUESTS) return false;
    recent.push(now);
    rateLimits.set(origin, recent);
    return true;
}

/**
 * Create a successful response
 */
export function successResponse<T>(data?: T): ExternalResponse<T> {
    return {
        success: true,
        ...(data !== undefined && { data }),
    };
}

/**
 * Create an error response
 */
export function errorResponse(error: string | Error): ExternalResponse {
    return {
        success: false,
        error: error instanceof Error ? error.message : error,
    };
}

/**
 * Wrap an async handler with error handling
 */
export async function withErrorHandling<T>(
    operation: () => Promise<ExternalResponse<T>>,
    errorMessage: string
): Promise<ExternalResponse<T>> {
    try {
        return await operation();
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : errorMessage
        ) as ExternalResponse<T>;
    }
}
