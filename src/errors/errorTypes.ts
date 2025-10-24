/**
 * Comprehensive error type definitions for the Chrome AI extension
 * Provides a centralized system for handling all error scenarios
 */

/**
 * Error type categorization for different failure scenarios
 */
export enum ErrorType {
    // API Errors
    API_RATE_LIMIT = 'API_RATE_LIMIT',
    API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
    API_AUTH_FAILED = 'API_AUTH_FAILED',
    API_MALFORMED_FUNCTION_CALL = 'API_MALFORMED_FUNCTION_CALL',
    API_INVALID_REQUEST = 'API_INVALID_REQUEST',
    API_SERVER_ERROR = 'API_SERVER_ERROR',

    // MCP Errors
    MCP_CONNECTION_FAILED = 'MCP_CONNECTION_FAILED',
    MCP_AUTH_FAILED = 'MCP_AUTH_FAILED',
    MCP_TOOL_EXECUTION_FAILED = 'MCP_TOOL_EXECUTION_FAILED',
    MCP_SERVER_UNAVAILABLE = 'MCP_SERVER_UNAVAILABLE',
    MCP_TRANSPORT_ERROR = 'MCP_TRANSPORT_ERROR',
    MCP_INVALID_RESPONSE = 'MCP_INVALID_RESPONSE',

    // Network Errors
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    NETWORK_CONNECTION_RESET = 'NETWORK_CONNECTION_RESET',
    NETWORK_DNS_FAILED = 'NETWORK_DNS_FAILED',
    NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',

    // Browser API Errors
    BROWSER_PERMISSION_DENIED = 'BROWSER_PERMISSION_DENIED',
    BROWSER_AUDIO_CONTEXT_ERROR = 'BROWSER_AUDIO_CONTEXT_ERROR',
    BROWSER_WEBSOCKET_ERROR = 'BROWSER_WEBSOCKET_ERROR',
    BROWSER_STORAGE_QUOTA_EXCEEDED = 'BROWSER_STORAGE_QUOTA_EXCEEDED',
    BROWSER_TAB_ACCESS_DENIED = 'BROWSER_TAB_ACCESS_DENIED',
    BROWSER_CONTENT_SCRIPT_FAILED = 'BROWSER_CONTENT_SCRIPT_FAILED',

    // External Service Errors
    EXTERNAL_YOUTUBE_API_ERROR = 'EXTERNAL_YOUTUBE_API_ERROR',
    EXTERNAL_CHROME_API_ERROR = 'EXTERNAL_CHROME_API_ERROR',
    EXTERNAL_SERVICE_UNAVAILABLE = 'EXTERNAL_SERVICE_UNAVAILABLE',

    // Generic
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Base interface for all custom errors
 */
export interface BaseErrorOptions {
    message: string;
    statusCode?: number;
    retryable?: boolean;
    retryAfter?: number; // milliseconds
    userMessage?: string;
    technicalDetails?: string;
    errorCode: ErrorType;
    originalError?: Error;
    metadata?: Record<string, any>;
}

/**
 * Base error class that all custom errors extend
 */
export class BaseAppError extends Error {
    public readonly statusCode?: number;
    public readonly retryable: boolean;
    public readonly retryAfter?: number;
    public readonly userMessage: string;
    public readonly technicalDetails: string;
    public readonly errorCode: ErrorType;
    public readonly originalError?: Error;
    public readonly metadata?: Record<string, any>;
    public readonly timestamp: Date;

    constructor(options: BaseErrorOptions) {
        super(options.message);
        this.name = this.constructor.name;
        this.statusCode = options.statusCode;
        this.retryable = options.retryable ?? false;
        this.retryAfter = options.retryAfter;
        this.userMessage = options.userMessage || options.message;
        this.technicalDetails = options.technicalDetails || options.message;
        this.errorCode = options.errorCode;
        this.originalError = options.originalError;
        this.metadata = options.metadata;
        this.timestamp = new Date();

        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Convert error to a serializable object
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            retryable: this.retryable,
            retryAfter: this.retryAfter,
            userMessage: this.userMessage,
            technicalDetails: this.technicalDetails,
            errorCode: this.errorCode,
            metadata: this.metadata,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack,
        };
    }
}

/**
 * API-related errors (Gemini AI, etc.)
 */
export class APIError extends BaseAppError {
    constructor(options: Omit<BaseErrorOptions, 'errorCode'> & { errorCode?: ErrorType }) {
        super({
            ...options,
            errorCode: options.errorCode || ErrorType.UNKNOWN_ERROR,
        });
    }

    /**
     * Create rate limit error (429)
     */
    static rateLimitExceeded(retryAfter?: number, details?: string): APIError {
        return new APIError({
            message: 'API rate limit exceeded',
            statusCode: 429,
            retryable: true,
            retryAfter,
            userMessage: 'Too many requests. Please wait a moment before trying again.',
            technicalDetails: details || 'Rate limit exceeded. The service has received too many requests.',
            errorCode: ErrorType.API_RATE_LIMIT,
        });
    }

    /**
     * Create quota exceeded error (403)
     */
    static quotaExceeded(details?: string): APIError {
        return new APIError({
            message: 'API quota exceeded',
            statusCode: 403,
            retryable: false,
            userMessage: 'API quota exceeded. Please check your usage limits and billing settings.',
            technicalDetails: details || 'The API quota for this service has been exceeded.',
            errorCode: ErrorType.API_QUOTA_EXCEEDED,
        });
    }

    /**
     * Create authentication error (401)
     */
    static authFailed(details?: string): APIError {
        return new APIError({
            message: 'Authentication failed',
            statusCode: 401,
            retryable: false,
            userMessage: 'Authentication failed. Please check your API key in settings.',
            technicalDetails: details || 'The provided API key is invalid or has expired.',
            errorCode: ErrorType.API_AUTH_FAILED,
        });
    }

    /**
     * Create malformed function call error
     */
    static malformedFunctionCall(details?: string, toolName?: string): APIError {
        return new APIError({
            message: 'Malformed function call',
            retryable: true,
            userMessage: 'The AI had trouble executing this action. Retrying with a simpler approach...',
            technicalDetails: details || 'The AI model generated an invalid function call.',
            errorCode: ErrorType.API_MALFORMED_FUNCTION_CALL,
            metadata: { toolName },
        });
    }

    /**
     * Create server error (500, 502, 503, 504)
     */
    static serverError(statusCode: number, details?: string): APIError {
        return new APIError({
            message: 'API server error',
            statusCode,
            retryable: true,
            userMessage: 'The API service is temporarily unavailable. Retrying...',
            technicalDetails: details || `Server returned ${statusCode} error.`,
            errorCode: ErrorType.API_SERVER_ERROR,
        });
    }
}

/**
 * MCP (Model Context Protocol) server errors
 */
export class MCPError extends BaseAppError {
    public readonly serverName?: string;
    public readonly toolName?: string;

    constructor(
        options: Omit<BaseErrorOptions, 'errorCode'> & {
            errorCode?: ErrorType;
            serverName?: string;
            toolName?: string;
        }
    ) {
        super({
            ...options,
            errorCode: options.errorCode || ErrorType.MCP_CONNECTION_FAILED,
        });
        this.serverName = options.serverName;
        this.toolName = options.toolName;
    }

    /**
     * Create connection failed error
     */
    static connectionFailed(serverName: string, details?: string): MCPError {
        return new MCPError({
            message: `Failed to connect to MCP server: ${serverName}`,
            retryable: true,
            userMessage: `Unable to connect to ${serverName}. Retrying...`,
            technicalDetails: details || `Connection to MCP server ${serverName} failed.`,
            errorCode: ErrorType.MCP_CONNECTION_FAILED,
            serverName,
        });
    }

    /**
     * Create authentication error
     */
    static authFailed(serverName: string, details?: string): MCPError {
        return new MCPError({
            message: `MCP authentication failed: ${serverName}`,
            retryable: false,
            userMessage: `Authentication failed for ${serverName}. Please check your credentials.`,
            technicalDetails: details || `Failed to authenticate with MCP server ${serverName}.`,
            errorCode: ErrorType.MCP_AUTH_FAILED,
            serverName,
        });
    }

    /**
     * Create tool execution error
     */
    static toolExecutionFailed(toolName: string, serverName: string, details?: string): MCPError {
        return new MCPError({
            message: `Tool execution failed: ${toolName}`,
            retryable: false,
            userMessage: `Failed to execute ${toolName}: ${details || 'Unknown error'}`,
            technicalDetails: details || `Tool ${toolName} execution failed on server ${serverName}.`,
            errorCode: ErrorType.MCP_TOOL_EXECUTION_FAILED,
            serverName,
            toolName,
        });
    }

    /**
     * Create server unavailable error
     */
    static serverUnavailable(serverName: string, details?: string): MCPError {
        return new MCPError({
            message: `MCP server unavailable: ${serverName}`,
            statusCode: 503,
            retryable: true,
            userMessage: `${serverName} is temporarily unavailable. Retrying...`,
            technicalDetails: details || `MCP server ${serverName} is not responding.`,
            errorCode: ErrorType.MCP_SERVER_UNAVAILABLE,
            serverName,
        });
    }
}

/**
 * Network-related errors
 */
export class NetworkError extends BaseAppError {
    constructor(options: Omit<BaseErrorOptions, 'errorCode'> & { errorCode?: ErrorType }) {
        super({
            ...options,
            errorCode: options.errorCode || ErrorType.NETWORK_TIMEOUT,
        });
    }

    /**
     * Create timeout error
     */
    static timeout(details?: string): NetworkError {
        return new NetworkError({
            message: 'Request timed out',
            retryable: true,
            userMessage: 'The request timed out. Retrying...',
            technicalDetails: details || 'The request exceeded the timeout limit.',
            errorCode: ErrorType.NETWORK_TIMEOUT,
        });
    }

    /**
     * Create connection reset error
     */
    static connectionReset(details?: string): NetworkError {
        return new NetworkError({
            message: 'Connection reset',
            retryable: true,
            userMessage: 'Connection was interrupted. Retrying...',
            technicalDetails: details || 'The connection was reset by the server.',
            errorCode: ErrorType.NETWORK_CONNECTION_RESET,
        });
    }

    /**
     * Create DNS failure error
     */
    static dnsFailed(details?: string): NetworkError {
        return new NetworkError({
            message: 'DNS resolution failed',
            retryable: true,
            userMessage: 'Unable to resolve domain name. Check your internet connection.',
            technicalDetails: details || 'DNS lookup failed for the requested domain.',
            errorCode: ErrorType.NETWORK_DNS_FAILED,
        });
    }
}

/**
 * Browser API errors
 */
export class BrowserAPIError extends BaseAppError {
    public readonly permission?: string;

    constructor(
        options: Omit<BaseErrorOptions, 'errorCode'> & {
            errorCode?: ErrorType;
            permission?: string;
        }
    ) {
        super({
            ...options,
            errorCode: options.errorCode || ErrorType.BROWSER_PERMISSION_DENIED,
        });
        this.permission = options.permission;
    }

    /**
     * Create permission denied error
     */
    static permissionDenied(permission: string, details?: string): BrowserAPIError {
        return new BrowserAPIError({
            message: `Permission denied: ${permission}`,
            retryable: false,
            userMessage: `Permission required: ${permission}. Please grant access in browser settings.`,
            technicalDetails: details || `The browser denied access to ${permission}.`,
            errorCode: ErrorType.BROWSER_PERMISSION_DENIED,
            permission,
        });
    }

    /**
     * Create audio context error
     */
    static audioContextError(details?: string): BrowserAPIError {
        return new BrowserAPIError({
            message: 'Audio context error',
            retryable: false,
            userMessage: 'Unable to access audio. Please check your microphone permissions.',
            technicalDetails: details || 'Failed to initialize or use audio context.',
            errorCode: ErrorType.BROWSER_AUDIO_CONTEXT_ERROR,
        });
    }

    /**
     * Create storage quota exceeded error
     */
    static storageQuotaExceeded(details?: string): BrowserAPIError {
        return new BrowserAPIError({
            message: 'Storage quota exceeded',
            retryable: false,
            userMessage: 'Storage limit reached. Please clear some data to continue.',
            technicalDetails: details || 'Browser storage quota has been exceeded.',
            errorCode: ErrorType.BROWSER_STORAGE_QUOTA_EXCEEDED,
        });
    }

    /**
     * Create tab access denied error
     */
    static tabAccessDenied(details?: string): BrowserAPIError {
        return new BrowserAPIError({
            message: 'Tab access denied',
            retryable: false,
            userMessage: 'Unable to access this tab. Some pages are restricted for security.',
            technicalDetails: details || 'Extension cannot access this tab (chrome://, edge://, etc.).',
            errorCode: ErrorType.BROWSER_TAB_ACCESS_DENIED,
        });
    }

    /**
     * Create tab not found error
     */
    static tabNotFound(tabId: number): BrowserAPIError {
        return new BrowserAPIError({
            message: `Tab not found: ${tabId}`,
            retryable: false,
            userMessage: 'The tab you\'re trying to access no longer exists.',
            technicalDetails: `Tab with ID ${tabId} was not found. It may have been closed.`,
            errorCode: ErrorType.BROWSER_TAB_ACCESS_DENIED,
        });
    }

    /**
     * Create content script injection failed error
     */
    static contentScriptInjectionFailed(details?: string): BrowserAPIError {
        return new BrowserAPIError({
            message: 'Content script injection failed',
            retryable: false,
            userMessage: 'Cannot interact with this page. It may be a protected browser page.',
            technicalDetails: details || 'Failed to inject content script. The page may be a chrome:// or extension page.',
            errorCode: ErrorType.BROWSER_CONTENT_SCRIPT_FAILED,
        });
    }
}

/**
 * External service errors (YouTube, etc.)
 */
export class ExternalServiceError extends BaseAppError {
    public readonly serviceName?: string;

    constructor(
        options: Omit<BaseErrorOptions, 'errorCode'> & {
            errorCode?: ErrorType;
            serviceName?: string;
        }
    ) {
        super({
            ...options,
            errorCode: options.errorCode || ErrorType.EXTERNAL_SERVICE_UNAVAILABLE,
        });
        this.serviceName = options.serviceName;
    }

    /**
     * Create YouTube API error
     */
    static youtubeError(statusCode: number, details?: string): ExternalServiceError {
        const isRetryable = statusCode === 429 || statusCode >= 500;
        let userMessage = 'YouTube service error.';

        if (statusCode === 404) {
            userMessage = 'Video not found or transcript unavailable.';
        } else if (statusCode === 403) {
            userMessage = 'Access to this video is restricted.';
        } else if (statusCode === 429) {
            userMessage = 'YouTube API rate limit reached. Please try again later.';
        } else if (statusCode >= 500) {
            userMessage = 'YouTube service is temporarily unavailable. Retrying...';
        }

        return new ExternalServiceError({
            message: `YouTube API error: ${statusCode}`,
            statusCode,
            retryable: isRetryable,
            userMessage,
            technicalDetails: details || `YouTube API returned ${statusCode} error.`,
            errorCode: ErrorType.EXTERNAL_YOUTUBE_API_ERROR,
            serviceName: 'YouTube',
        });
    }

    /**
     * Create generic external service error
     */
    static serviceUnavailable(serviceName: string, details?: string): ExternalServiceError {
        return new ExternalServiceError({
            message: `Service unavailable: ${serviceName}`,
            retryable: true,
            userMessage: `${serviceName} is temporarily unavailable. Retrying...`,
            technicalDetails: details || `External service ${serviceName} is not responding.`,
            errorCode: ErrorType.EXTERNAL_SERVICE_UNAVAILABLE,
            serviceName,
        });
    }
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
    if (error instanceof BaseAppError) {
        return error.retryable;
    }
    return false;
}

/**
 * Type guard to check if error is a BaseAppError
 */
export function isAppError(error: unknown): error is BaseAppError {
    return error instanceof BaseAppError;
}

/**
 * Extract retry-after value from error
 */
export function getRetryAfter(error: unknown): number | undefined {
    if (error instanceof BaseAppError) {
        return error.retryAfter;
    }
    return undefined;
}
