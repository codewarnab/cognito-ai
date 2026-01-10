/**
 * Error card types and shared interfaces
 */

/**
 * Error category for determining which card variant to render
 */
export enum ErrorCategory {
    API = 'API',
    AUTH = 'AUTH',
    RATE_LIMIT = 'RATE_LIMIT',
    NETWORK = 'NETWORK',
    MCP = 'MCP',
    BROWSER = 'BROWSER',
    STORAGE = 'STORAGE',
    UNKNOWN = 'UNKNOWN',
}

/**
 * Data structure passed to error cards
 */
export interface ErrorCardData {
    title?: string;
    message?: string;
    userMessage?: string;
    technicalDetails?: string;
    errorCode?: string;
    statusCode?: number;
    retryable?: boolean;
    retryAfter?: number; // ms
    timestamp?: number;
    context?: string;
    // Additional metadata from error
    metadata?: Record<string, any>;
}

/**
 * Common props for all error card variants
 */
export interface BaseErrorCardProps {
    data: ErrorCardData;
    onRetry?: () => void;
    isLoading?: boolean;
}

/**
 * Map error codes to categories for card selection
 */
export function getErrorCategory(errorCode?: string): ErrorCategory {
    if (!errorCode) return ErrorCategory.UNKNOWN;

    // Auth errors
    if (
        errorCode === 'API_AUTH_FAILED' ||
        errorCode === 'API_XAI_AUTH_FAILED' ||
        errorCode === 'API_VERTEX_PERMISSION_DENIED' ||
        errorCode === 'MCP_AUTH_FAILED'
    ) {
        return ErrorCategory.AUTH;
    }

    // Rate limit errors
    if (
        errorCode === 'API_RATE_LIMIT' ||
        errorCode === 'API_QUOTA_EXCEEDED' ||
        errorCode === 'API_XAI_RATE_LIMIT' ||
        errorCode === 'API_VERTEX_QUOTA_EXHAUSTED'
    ) {
        return ErrorCategory.RATE_LIMIT;
    }

    // Network errors
    if (
        errorCode.startsWith('NETWORK_') ||
        errorCode === 'API_SERVER_ERROR' ||
        errorCode === 'API_XAI_SERVER_ERROR' ||
        errorCode === 'API_VERTEX_DEADLINE_EXCEEDED'
    ) {
        return ErrorCategory.NETWORK;
    }

    // MCP errors
    if (errorCode.startsWith('MCP_')) {
        return ErrorCategory.MCP;
    }

    // Browser/storage errors
    if (errorCode === 'BROWSER_STORAGE_QUOTA_EXCEEDED' || errorCode === 'BROWSER_AI_MODEL_STORAGE_ERROR') {
        return ErrorCategory.STORAGE;
    }

    // Other browser errors
    if (errorCode.startsWith('BROWSER_')) {
        return ErrorCategory.BROWSER;
    }

    // API errors (generic)
    if (errorCode.startsWith('API_')) {
        return ErrorCategory.API;
    }

    return ErrorCategory.UNKNOWN;
}

/**
 * Format retry countdown time
 */
export function formatRetryAfter(ms?: number): string | null {
    if (!ms || ms <= 0) return null;
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
}
