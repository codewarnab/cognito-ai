/**
 * External Handler Utilities
 *
 * Shared utilities for external message handlers
 */

import type { ExternalResponse } from '@cognito/shared';

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
