/**
 * Central export point for error handling system
 */

// Error types and classes
export {
    ErrorType,
    BaseAppError,
    APIError,
    MCPError,
    NetworkError,
    BrowserAPIError,
    ExternalServiceError,
    isRetryableError,
    isAppError,
    getRetryAfter,
    type BaseErrorOptions,
} from './errorTypes';

// File access errors
export {
    FileAccessError,
    isFileAccessError,
    isPermissionError,
    type FileAccessErrorCode,
} from './FileAccessError';

// Error messages
export {
    buildUserMessage,
    buildTechnicalMessage,
    getErrorSuggestions,
    buildCompleteErrorMessage,
    formatErrorAsMarkdown,
    formatErrorInline,
    formatRetryCountdown,
    formatRetryAttempt,
} from './errorMessages';

// Retry manager
export {
    RetryManager,
    createRetryManager,
    extractRateLimitInfo,
    RetryPresets,
    type RetryConfig,
} from './retryManager';

/**
 * Utility function to parse common error scenarios and create appropriate error objects
 */
import { APIError, MCPError, NetworkError, BrowserAPIError, ExternalServiceError } from './errorTypes';

export interface ParseErrorOptions {
    context?: string;
    serviceName?: string;
    serverName?: string;
    toolName?: string;
    statusCode?: number;
}

/**
 * Parse a generic error into a typed error object
 */
export function parseError(error: unknown, options: ParseErrorOptions = {}): Error {
    // Already a typed error
    if (error instanceof APIError ||
        error instanceof MCPError ||
        error instanceof NetworkError ||
        error instanceof BrowserAPIError ||
        error instanceof ExternalServiceError) {
        return error;
    }

    // Regular error with message
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        const { context, serviceName, serverName, toolName, statusCode } = options;

        // Network errors
        if (message.includes('timeout') || message.includes('etimedout')) {
            return NetworkError.timeout(error.message);
        }
        if (message.includes('econnreset') || message.includes('connection reset')) {
            return NetworkError.connectionReset(error.message);
        }
        if (message.includes('enotfound') || message.includes('dns')) {
            return NetworkError.dnsFailed(error.message);
        }

        // API errors based on status code
        if (statusCode) {
            if (statusCode === 429) {
                return APIError.rateLimitExceeded(undefined, error.message);
            }
            if (statusCode === 401) {
                return APIError.authFailed(error.message);
            }
            if (statusCode === 403) {
                return APIError.quotaExceeded(error.message);
            }
            if (statusCode >= 500) {
                return APIError.serverError(statusCode, error.message);
            }
        }

        // MCP errors
        if (context === 'mcp' || message.includes('mcp')) {
            if (message.includes('auth') || message.includes('unauthorized')) {
                return MCPError.authFailed(serverName || 'unknown', error.message);
            }
            if (message.includes('connection') || message.includes('connect')) {
                return MCPError.connectionFailed(serverName || 'unknown', error.message);
            }
            if (toolName) {
                return MCPError.toolExecutionFailed(toolName, serverName || 'unknown', error.message);
            }
        }

        // Browser API errors
        if (message.includes('permission denied') || message.includes('notallowederror')) {
            return BrowserAPIError.permissionDenied('unknown', error.message);
        }
        if (message.includes('audio context') || message.includes('microphone')) {
            return BrowserAPIError.audioContextError(error.message);
        }
        if (message.includes('quota') || message.includes('storage')) {
            return BrowserAPIError.storageQuotaExceeded(error.message);
        }

        // External service errors
        if (serviceName === 'YouTube' || message.includes('youtube')) {
            return ExternalServiceError.youtubeError(statusCode || 500, error.message);
        }
        if (serviceName) {
            return ExternalServiceError.serviceUnavailable(serviceName, error.message);
        }

        // Return original error if no match
        return error;
    }

    // Unknown error type
    return new Error(String(error));
}

/**
 * Wrap an async function with automatic error parsing
 */
export function withErrorParsing<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: ParseErrorOptions = {}
): T {
    return (async (...args: any[]) => {
        try {
            return await fn(...args);
        } catch (error) {
            throw parseError(error, options);
        }
    }) as T;
}

/**
 * Quick helper to create common errors
 */
export const ErrorHelpers = {
    /** Create a rate limit error */
    rateLimit: (retryAfter?: number) => APIError.rateLimitExceeded(retryAfter),

    /** Create a quota exceeded error */
    quotaExceeded: () => APIError.quotaExceeded(),

    /** Create an auth error */
    authFailed: () => APIError.authFailed(),

    /** Create a malformed function call error */
    malformedCall: (toolName?: string) => APIError.malformedFunctionCall(undefined, toolName),

    /** Create a timeout error */
    timeout: () => NetworkError.timeout(),

    /** Create an MCP connection error */
    mcpConnection: (serverName: string) => MCPError.connectionFailed(serverName),

    /** Create a permission denied error */
    permissionDenied: (permission: string) => BrowserAPIError.permissionDenied(permission),

    /** Create a YouTube error */
    youtubeError: (statusCode: number) => ExternalServiceError.youtubeError(statusCode),
};
