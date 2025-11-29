import { createLogger } from '~logger';

const log = createLogger('SearchErrors', 'SEARCH');

/** Search-specific error types */
export type SearchErrorCode =
    | 'NO_API_KEY'
    | 'INVALID_API_KEY'
    | 'RATE_LIMITED'
    | 'NETWORK_ERROR'
    | 'PROVIDER_ERROR'
    | 'TIMEOUT'
    | 'INVALID_QUERY'
    | 'UNKNOWN';

/** Search error with user-friendly message */
export class SearchError extends Error {
    code: SearchErrorCode;
    userMessage: string;
    retryable: boolean;
    retryAfter?: number; // seconds

    constructor(
        code: SearchErrorCode,
        message: string,
        userMessage: string,
        retryable: boolean = false,
        retryAfter?: number
    ) {
        super(message);
        this.name = 'SearchError';
        this.code = code;
        this.userMessage = userMessage;
        this.retryable = retryable;
        this.retryAfter = retryAfter;
    }
}

/** Error messages for each error code */
const ERROR_MESSAGES: Record<SearchErrorCode, { user: string; technical: string }> = {
    NO_API_KEY: {
        user: 'Web search is not configured. Please add your API key in Settings.',
        technical: 'No API key configured for search provider',
    },
    INVALID_API_KEY: {
        user: 'Your search API key is invalid. Please check Settings.',
        technical: 'API key rejected by provider',
    },
    RATE_LIMITED: {
        user: 'Search limit reached. Please wait a moment and try again.',
        technical: 'Rate limit exceeded',
    },
    NETWORK_ERROR: {
        user: 'Unable to connect to search service. Check your internet connection.',
        technical: 'Network request failed',
    },
    PROVIDER_ERROR: {
        user: 'Search service temporarily unavailable. Please try again.',
        technical: 'Provider returned an error',
    },
    TIMEOUT: {
        user: 'Search took too long. Please try a simpler query.',
        technical: 'Request timed out',
    },
    INVALID_QUERY: {
        user: 'Please enter a valid search query.',
        technical: 'Query validation failed',
    },
    UNKNOWN: {
        user: 'Something went wrong with the search. Please try again.',
        technical: 'Unknown error occurred',
    },
};


/**
 * Creates a SearchError from an HTTP response.
 */
export function createSearchErrorFromResponse(
    status: number,
    statusText: string,
    body?: string
): SearchError {
    let code: SearchErrorCode;
    let retryable = false;
    let retryAfter: number | undefined;

    switch (status) {
        case 401:
        case 403:
            code = 'INVALID_API_KEY';
            break;
        case 429:
            code = 'RATE_LIMITED';
            retryable = true;
            // Try to parse retry-after header or default to 60 seconds
            retryAfter = 60;
            break;
        case 400:
            code = 'INVALID_QUERY';
            break;
        case 500:
        case 502:
        case 503:
        case 504:
            code = 'PROVIDER_ERROR';
            retryable = true;
            break;
        default:
            code = 'UNKNOWN';
    }

    const messages = ERROR_MESSAGES[code];
    const technicalMessage = body 
        ? `${messages.technical}: ${status} ${statusText} - ${body}`
        : `${messages.technical}: ${status} ${statusText}`;

    log.error('Search API error', { code, status, statusText });

    return new SearchError(code, technicalMessage, messages.user, retryable, retryAfter);
}

/**
 * Creates a SearchError from a caught exception.
 */
export function createSearchErrorFromException(error: unknown): SearchError {
    if (error instanceof SearchError) {
        return error;
    }

    let code: SearchErrorCode = 'UNKNOWN';
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
        code = 'NETWORK_ERROR';
    } else if (error instanceof DOMException && error.name === 'AbortError') {
        code = 'TIMEOUT';
    }

    const messages = ERROR_MESSAGES[code];
    const technicalMessage = error instanceof Error ? error.message : 'Unknown error';

    log.error('Search exception', { code, error: technicalMessage });

    return new SearchError(
        code,
        technicalMessage,
        messages.user,
        code === 'NETWORK_ERROR' || code === 'TIMEOUT'
    );
}

/**
 * Gets user-friendly error message for display.
 */
export function getSearchErrorMessage(error: unknown): string {
    if (error instanceof SearchError) {
        return error.userMessage;
    }
    return ERROR_MESSAGES.UNKNOWN.user;
}
