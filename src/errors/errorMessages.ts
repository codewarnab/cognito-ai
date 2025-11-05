/**
 * Error message builder for user-friendly error messages
 * Maps error types to friendly, actionable messages with technical details
 */

import { ErrorType, BaseAppError } from './errorTypes';

/**
 * Template variable interpolation interface
 */
interface MessageVariables {
    [key: string]: string | number | undefined;
}

/**
 * Error message template
 */
interface ErrorMessageTemplate {
    userMessage: string;
    technicalTemplate: string;
    suggestions?: string[];
}

/**
 * Comprehensive error message mapping
 */
const ERROR_MESSAGES: Record<ErrorType, ErrorMessageTemplate> = {
    // API Errors
    [ErrorType.API_RATE_LIMIT]: {
        userMessage: "You've made too many requests. Waiting {seconds}s before retrying...",
        technicalTemplate: 'Rate limit exceeded. The API has received too many requests. Retry after: {retryAfter}ms',
        suggestions: [
            'Wait a moment before making another request',
            'The system will automatically retry after the cooldown period',
        ],
    },
    [ErrorType.API_QUOTA_EXCEEDED]: {
        userMessage: 'API quota exceeded. Please check your usage limits.',
        technicalTemplate: 'API quota exceeded. Service: {service}, Details: {details}',
        suggestions: [
            'Check your API usage dashboard',
            'Upgrade your API plan if needed',
            'Wait until your quota resets',
        ],
    },
    [ErrorType.API_AUTH_FAILED]: {
        userMessage: 'Authentication failed. Please check your API key.',
        technicalTemplate: 'Authentication failed. Status: {statusCode}, Details: {details}',
        suggestions: [
            'Go to Settings and verify your API key',
            'Ensure your API key has the necessary permissions',
            'Generate a new API key if the current one is expired',
        ],
    },
    [ErrorType.API_MALFORMED_FUNCTION_CALL]: {
        userMessage: 'The AI model had trouble executing this action. Retrying with a simpler approach...',
        technicalTemplate: 'Malformed function call. Tool: {toolName}, Error: {details}',
        suggestions: [
            'The system will automatically retry with a corrected format',
            'If the issue persists, try rephrasing your request',
        ],
    },
    [ErrorType.API_INVALID_REQUEST]: {
        userMessage: 'Invalid request format. Please try rephrasing your request.',
        technicalTemplate: 'Invalid API request. Details: {details}',
        suggestions: [
            'Try rephrasing your request',
            'Break down complex requests into smaller steps',
        ],
    },
    [ErrorType.API_SERVER_ERROR]: {
        userMessage: 'The API service is temporarily unavailable. Retrying...',
        technicalTemplate: 'API server error. Status: {statusCode}, Details: {details}',
        suggestions: [
            'The system will automatically retry',
            'The service should be back shortly',
        ],
    },

    // MCP Errors
    [ErrorType.MCP_CONNECTION_FAILED]: {
        userMessage: 'Unable to connect to {serverName}. Retrying...',
        technicalTemplate: 'MCP connection failed. Server: {serverName}, Error: {details}',
        suggestions: [
            'The system will automatically retry the connection',
            'Check your internet connection',
            'The server may be temporarily unavailable',
        ],
    },
    [ErrorType.MCP_AUTH_FAILED]: {
        userMessage: 'Authentication failed for {serverName}. Please check your credentials.',
        technicalTemplate: 'MCP authentication failed. Server: {serverName}, Details: {details}',
        suggestions: [
            'Verify your credentials in Settings',
            'Re-authorize the connection if needed',
            'Check if your token has expired',
        ],
    },
    [ErrorType.MCP_TOOL_EXECUTION_FAILED]: {
        userMessage: 'Failed to execute {toolName}: {reason}',
        technicalTemplate: 'MCP tool execution failed. Tool: {toolName}, Server: {serverName}, Error: {details}',
        suggestions: [
            'Try the action again',
            'Check if you have the necessary permissions',
            'The tool may not support this specific operation',
        ],
    },
    [ErrorType.MCP_SERVER_UNAVAILABLE]: {
        userMessage: '{serverName} is temporarily unavailable. Retrying...',
        technicalTemplate: 'MCP server unavailable. Server: {serverName}, Details: {details}',
        suggestions: [
            'The system will automatically retry',
            'The server may be under maintenance',
            'Try again in a few moments',
        ],
    },
    [ErrorType.MCP_TRANSPORT_ERROR]: {
        userMessage: 'Connection error with {serverName}. Retrying...',
        technicalTemplate: 'MCP transport error. Server: {serverName}, Transport: {transport}, Error: {details}',
        suggestions: [
            'The system will automatically retry',
            'Check your network connection',
        ],
    },
    [ErrorType.MCP_INVALID_RESPONSE]: {
        userMessage: 'Received invalid response from {serverName}.',
        technicalTemplate: 'Invalid MCP response. Server: {serverName}, Details: {details}',
        suggestions: [
            'The server may be experiencing issues',
            'Try the request again',
            'Contact support if the issue persists',
        ],
    },

    // Network Errors
    [ErrorType.NETWORK_TIMEOUT]: {
        userMessage: 'Request timed out. Retrying...',
        technicalTemplate: 'Network timeout. URL: {url}, Timeout: {timeout}ms, Details: {details}',
        suggestions: [
            'The system will automatically retry',
            'Check your internet connection',
            'The service may be slow to respond',
        ],
    },
    [ErrorType.NETWORK_CONNECTION_RESET]: {
        userMessage: 'Connection was interrupted. Retrying...',
        technicalTemplate: 'Connection reset. Details: {details}',
        suggestions: [
            'The system will automatically retry',
            'Check your network stability',
        ],
    },
    [ErrorType.NETWORK_DNS_FAILED]: {
        userMessage: 'Unable to resolve domain name. Check your internet connection.',
        technicalTemplate: 'DNS resolution failed. Domain: {domain}, Details: {details}',
        suggestions: [
            'Check your internet connection',
            'Verify DNS settings',
            'Try again in a moment',
        ],
    },
    [ErrorType.NETWORK_UNREACHABLE]: {
        userMessage: 'Network unreachable. Please check your connection.',
        technicalTemplate: 'Network unreachable. Details: {details}',
        suggestions: [
            'Check your internet connection',
            'Ensure you are connected to a network',
            'Try disabling VPN if enabled',
        ],
    },

    // Browser API Errors
    [ErrorType.BROWSER_PERMISSION_DENIED]: {
        userMessage: 'Permission required: {permission}. Please grant access in browser settings.',
        technicalTemplate: 'Browser permission denied. Permission: {permission}, Details: {details}',
        suggestions: [
            'Click the browser address bar to grant permission',
            'Check browser settings for blocked permissions',
            'Reload the page and allow the permission when prompted',
        ],
    },
    [ErrorType.BROWSER_AUDIO_CONTEXT_ERROR]: {
        userMessage: 'Unable to access audio. Please check your microphone permissions.',
        technicalTemplate: 'Audio context error. State: {state}, Details: {details}',
        suggestions: [
            'Grant microphone permission in browser settings',
            'Check if another application is using the microphone',
            'Try refreshing the page',
        ],
    },
    [ErrorType.BROWSER_WEBSOCKET_ERROR]: {
        userMessage: 'WebSocket connection failed. Retrying...',
        technicalTemplate: 'WebSocket error. URL: {url}, Code: {code}, Details: {details}',
        suggestions: [
            'The system will automatically retry',
            'Check your network connection',
        ],
    },
    [ErrorType.BROWSER_STORAGE_QUOTA_EXCEEDED]: {
        userMessage: 'Storage limit reached. Please clear some data to continue.',
        technicalTemplate: 'Storage quota exceeded. Used: {used}, Quota: {quota}, Details: {details}',
        suggestions: [
            'Clear browser cache and data',
            'Delete old chat history',
            'Remove unused saved items',
        ],
    },
    [ErrorType.BROWSER_TAB_ACCESS_DENIED]: {
        userMessage: 'Unable to access this tab. Some pages are restricted for security.',
        technicalTemplate: 'Tab access denied. URL: {url}, Details: {details}',
        suggestions: [
            'This extension cannot access browser internal pages (chrome://, edge://)',
            'Try accessing a regular web page instead',
        ],
    },
    [ErrorType.BROWSER_CONTENT_SCRIPT_FAILED]: {
        userMessage: 'Failed to inject content script. Please refresh the page.',
        technicalTemplate: 'Content script injection failed. Tab: {tabId}, Details: {details}',
        suggestions: [
            'Refresh the page and try again',
            'Some pages may block content scripts',
        ],
    },
    [ErrorType.BROWSER_AI_MODEL_STORAGE_ERROR]: {
        userMessage: 'Not enough disk space to download {modelName}. Please free up at least 2GB and try again, or switch to Remote Mode.',
        technicalTemplate: 'AI model download failed due to insufficient storage. Model: {modelName}, Details: {details}',
        suggestions: [
            'Free up at least 20GB of disk space on your device',
            'Switch to Remote Mode (Settings → AI Mode → Remote) which doesn\'t require downloads',
            'Close other applications to free up memory',
            'Delete unnecessary files from your device',
        ],
    },

    // External Service Errors
    [ErrorType.EXTERNAL_YOUTUBE_API_ERROR]: {
        userMessage: 'YouTube service error: {reason}',
        technicalTemplate: 'YouTube API error. Status: {statusCode}, Video: {videoId}, Details: {details}',
        suggestions: [
            'The video may be unavailable or restricted',
            'Try a different video',
            'Wait a moment and try again',
        ],
    },
    [ErrorType.EXTERNAL_CHROME_API_ERROR]: {
        userMessage: 'Chrome API error. Please try again.',
        technicalTemplate: 'Chrome API error. API: {apiName}, Details: {details}',
        suggestions: [
            'Try the action again',
            'Check if you have the necessary permissions',
        ],
    },
    [ErrorType.EXTERNAL_SERVICE_UNAVAILABLE]: {
        userMessage: '{serviceName} is temporarily unavailable. Retrying...',
        technicalTemplate: 'External service unavailable. Service: {serviceName}, Details: {details}',
        suggestions: [
            'The system will automatically retry',
            'The service may be under maintenance',
        ],
    },

    // Generic
    [ErrorType.UNKNOWN_ERROR]: {
        userMessage: 'An unexpected error occurred. Please try again.',
        technicalTemplate: 'Unknown error. Details: {details}',
        suggestions: [
            'Try the action again',
            'If the problem persists, please report it',
        ],
    },
};

/**
 * Interpolate variables into a template string
 */
function interpolate(template: string, variables: MessageVariables): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = variables[key];
        return value !== undefined ? String(value) : match;
    });
}

/**
 * Format seconds for user-friendly display
 */
function formatSeconds(ms: number | undefined): string {
    if (!ms) return '0';
    return Math.ceil(ms / 1000).toString();
}

/**
 * Build a user-friendly error message from an error
 */
export function buildUserMessage(error: BaseAppError | Error, variables?: MessageVariables): string {
    if (!(error instanceof BaseAppError)) {
        return 'An unexpected error occurred. Please try again.';
    }

    const template = ERROR_MESSAGES[error.errorCode];
    if (!template) {
        return error.userMessage || error.message;
    }

    const vars: MessageVariables = {
        ...variables,
        seconds: formatSeconds(error.retryAfter),
        retryAfter: error.retryAfter,
        statusCode: error.statusCode,
        details: error.technicalDetails,
        ...(error.metadata || {}),
    };

    return interpolate(template.userMessage, vars);
}

/**
 * Build technical details message
 */
export function buildTechnicalMessage(error: BaseAppError | Error, variables?: MessageVariables): string {
    if (!(error instanceof BaseAppError)) {
        return error.message || 'Unknown error';
    }

    const template = ERROR_MESSAGES[error.errorCode];
    if (!template) {
        return error.technicalDetails || error.message;
    }

    const vars: MessageVariables = {
        ...variables,
        retryAfter: error.retryAfter,
        statusCode: error.statusCode,
        details: error.technicalDetails,
        ...(error.metadata || {}),
    };

    return interpolate(template.technicalTemplate, vars);
}

/**
 * Get suggestions for an error
 */
export function getErrorSuggestions(error: BaseAppError | Error): string[] {
    if (!(error instanceof BaseAppError)) {
        return ['Try the action again', 'Check your internet connection'];
    }

    const template = ERROR_MESSAGES[error.errorCode];
    return template?.suggestions || [];
}

/**
 * Build a complete error message with details and suggestions
 */
export function buildCompleteErrorMessage(
    error: BaseAppError | Error,
    variables?: MessageVariables
): {
    userMessage: string;
    technicalDetails: string;
    suggestions: string[];
} {
    return {
        userMessage: buildUserMessage(error, variables),
        technicalDetails: buildTechnicalMessage(error, variables),
        suggestions: getErrorSuggestions(error),
    };
}

/**
 * Format error as markdown for display in chat
 */
export function formatErrorAsMarkdown(
    error: BaseAppError | Error,
    variables?: MessageVariables,
    includeStack = false
): string {
    const { userMessage, technicalDetails, suggestions } = buildCompleteErrorMessage(error, variables);

    let markdown = `**⚠️ ${userMessage}**\n\n`;

    // Add suggestions if available
    if (suggestions.length > 0) {
        markdown += '**What you can do:**\n';
        suggestions.forEach((suggestion) => {
            markdown += `- ${suggestion}\n`;
        });
        markdown += '\n';
    }

    // Add technical details in expandable section
    markdown += '<details>\n';
    markdown += '<summary>Technical Details</summary>\n\n';
    markdown += `**Error Code:** \`${error instanceof BaseAppError ? error.errorCode : 'UNKNOWN'}\`\n\n`;
    markdown += `**Details:** ${technicalDetails}\n\n`;

    if (error instanceof BaseAppError && error.timestamp) {
        markdown += `**Timestamp:** ${error.timestamp.toISOString()}\n\n`;
    }

    if (includeStack && error.stack) {
        markdown += '**Stack Trace:**\n```\n';
        markdown += error.stack;
        markdown += '\n```\n';
    }

    markdown += '</details>\n';

    return markdown;
}

/**
 * Format error for inline display in stream (without suggestions)
 */
export function formatErrorInline(
    error: BaseAppError | Error,
    variables?: MessageVariables
): string {
    const { userMessage, technicalDetails } = buildCompleteErrorMessage(error, variables);

    let markdown = `**⚠️ ${userMessage}**\n\n`;
    markdown += '<details>\n<summary>Technical Details</summary>\n\n';
    markdown += `${technicalDetails}\n\n`;
    markdown += '</details>\n';

    return markdown;
}

/**
 * Create a retry countdown message
 */
export function formatRetryCountdown(seconds: number, attempt: number, maxAttempts: number): string {
    return `🔄 Retrying in ${seconds}s... (Attempt ${attempt}/${maxAttempts})`;
}

/**
 * Create a retry attempt message
 */
export function formatRetryAttempt(attempt: number, maxAttempts: number): string {
    return `🔄 Retrying... (Attempt ${attempt}/${maxAttempts})`;
}
