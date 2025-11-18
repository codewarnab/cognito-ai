/**
 * Comprehensive error type definitions for the Chrome AI extension
 * Provides a centralized system for handling all error scenarios
 */

/**
 * Error type categorization for different failure scenarios
 */
export enum ErrorType {
    // API Errors (Generic)
    API_RATE_LIMIT = 'API_RATE_LIMIT',
    API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
    API_AUTH_FAILED = 'API_AUTH_FAILED',
    API_MALFORMED_FUNCTION_CALL = 'API_MALFORMED_FUNCTION_CALL',
    API_INVALID_REQUEST = 'API_INVALID_REQUEST',
    API_SERVER_ERROR = 'API_SERVER_ERROR',

    // Vertex AI Specific Errors
    API_VERTEX_PERMISSION_DENIED = 'API_VERTEX_PERMISSION_DENIED',
    API_VERTEX_MODEL_ACCESS_REQUIRED = 'API_VERTEX_MODEL_ACCESS_REQUIRED',
    API_VERTEX_QUOTA_EXHAUSTED = 'API_VERTEX_QUOTA_EXHAUSTED',
    API_VERTEX_DEADLINE_EXCEEDED = 'API_VERTEX_DEADLINE_EXCEEDED',
    API_VERTEX_CANCELLED = 'API_VERTEX_CANCELLED',
    API_VERTEX_RESOURCE_NOT_FOUND = 'API_VERTEX_RESOURCE_NOT_FOUND',

    // MCP Errors
    MCP_CONNECTION_FAILED = 'MCP_CONNECTION_FAILED',
    MCP_AUTH_FAILED = 'MCP_AUTH_FAILED',
    MCP_TOOL_EXECUTION_FAILED = 'MCP_TOOL_EXECUTION_FAILED',
    MCP_SERVER_UNAVAILABLE = 'MCP_SERVER_UNAVAILABLE',
    MCP_CLOUDFLARE_WORKER_ERROR = 'MCP_CLOUDFLARE_WORKER_ERROR',
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
    BROWSER_AI_MODEL_STORAGE_ERROR = 'BROWSER_AI_MODEL_STORAGE_ERROR',

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

    /**
     * Vertex AI: Permission denied error (403)
     * Service account lacks required IAM permissions
     */
    static vertexPermissionDenied(details?: string): APIError {
        return new APIError({
            message: 'Vertex AI permission denied',
            statusCode: 403,
            retryable: false,
            userMessage: 'Service account lacks permissions. Check IAM roles in Google Cloud Console.',
            technicalDetails: details || 'The service account does not have the required Vertex AI permissions.',
            errorCode: ErrorType.API_VERTEX_PERMISSION_DENIED,
        });
    }

    /**
     * Vertex AI: Model access required (400)
     * Model requires allowlisting or org policy blocks access
     */
    static vertexModelAccessRequired(details?: string): APIError {
        return new APIError({
            message: 'Vertex AI model access required',
            statusCode: 400,
            retryable: false,
            userMessage: 'This model requires allowlisting. Please request access in Google Cloud Console.',
            technicalDetails: details || 'The requested model is not available or requires allowlisting.',
            errorCode: ErrorType.API_VERTEX_MODEL_ACCESS_REQUIRED,
        });
    }

    /**
     * Vertex AI: Quota exhausted (429)
     * API quota limits exceeded
     */
    static vertexQuotaExhausted(details?: string, retryAfter?: number): APIError {
        return new APIError({
            message: 'Vertex AI quota exhausted',
            statusCode: 429,
            retryable: true,
            retryAfter,
            userMessage: 'Vertex AI quota exceeded. Please wait before retrying or increase quotas in GCP.',
            technicalDetails: details || 'API quota limits have been exceeded.',
            errorCode: ErrorType.API_VERTEX_QUOTA_EXHAUSTED,
        });
    }

    /**
     * Vertex AI: Deadline exceeded (504)
     * Request took longer than client deadline
     */
    static vertexDeadlineExceeded(details?: string): APIError {
        return new APIError({
            message: 'Vertex AI request timeout',
            statusCode: 504,
            retryable: true,
            userMessage: 'Request took too long. Try a simpler prompt or increase timeout settings.',
            technicalDetails: details || 'Request exceeded the client deadline (default: 10 minutes).',
            errorCode: ErrorType.API_VERTEX_DEADLINE_EXCEEDED,
        });
    }

    /**
     * Vertex AI: Request cancelled (499)
     * User or client cancelled the request
     */
    static vertexCancelled(details?: string): APIError {
        return new APIError({
            message: 'Vertex AI request cancelled',
            statusCode: 499,
            retryable: false,
            userMessage: 'Request was cancelled.',
            technicalDetails: details || 'The request was cancelled by the client.',
            errorCode: ErrorType.API_VERTEX_CANCELLED,
        });
    }

    /**
     * Vertex AI: Resource not found (404)
     * Invalid model name, missing files, etc.
     */
    static vertexResourceNotFound(details?: string): APIError {
        return new APIError({
            message: 'Vertex AI resource not found',
            statusCode: 404,
            retryable: false,
            userMessage: 'Resource not found. Check your model name and credentials.',
            technicalDetails: details || 'The requested resource was not found.',
            errorCode: ErrorType.API_VERTEX_RESOURCE_NOT_FOUND,
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

    /**
     * Create Cloudflare Worker error (Error 1101)
     * This occurs when Cloudflare Workers crash or throw unhandled exceptions
     */
    static cloudflareWorkerError(serverName: string, details?: string): MCPError {
        return new MCPError({
            message: `Cloudflare Worker error for ${serverName}`,
            statusCode: 1101,
            retryable: true,
            retryAfter: 30000, // Wait 30 seconds before retry
            userMessage: `${serverName} service is experiencing technical difficulties. This is a temporary issue on their end. The extension will retry automatically in 30 seconds. You can also try again later.`,
            technicalDetails: details || `Cloudflare Worker threw an exception (Error 1101). The server's serverless function encountered an unhandled error. This is not an issue with your setup or authentication.`,
            errorCode: ErrorType.MCP_CLOUDFLARE_WORKER_ERROR,
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

    /**
     * Create CSP (Content Security Policy) violation error
     * This happens when a website blocks extension scripts for security
     */
    static cspViolation(pageUrl?: string, details?: string): BrowserAPIError {
        const domain = pageUrl ? new URL(pageUrl).hostname : 'this page';
        return new BrowserAPIError({
            message: 'Content Security Policy violation',
            retryable: false,
            userMessage: `Cannot modify ${domain}. This website has strict security policies that prevent extensions from making changes. This is a security feature of the website and cannot be bypassed.`,
            technicalDetails: details || 'The page has a Content Security Policy (CSP) that blocks script execution from extensions. Common on sites like OpenAI, TikTok, and other security-conscious platforms.',
            errorCode: ErrorType.BROWSER_CONTENT_SCRIPT_FAILED,
        });
    }

    /**
     * Create AI model storage error (insufficient disk space for downloading local models)
     */
    static aiModelStorageError(modelName: string, details?: string): BrowserAPIError {
        return new BrowserAPIError({
            message: `Insufficient storage for ${modelName}`,
            retryable: false,
            userMessage: `Not enough disk space to download ${modelName}. Please free up at least 20GB of storage and try again, or switch to Remote Mode which doesn't require downloads.`,
            technicalDetails: details || `The device does not have enough space for downloading ${modelName}.`,
            errorCode: ErrorType.BROWSER_AI_MODEL_STORAGE_ERROR,
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
