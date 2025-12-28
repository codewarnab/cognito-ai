/**
 * Error Handling Utilities for AI Logic
 * Handles error parsing, formatting, and API key validation updates
 * Supports both Google Generative AI and Vertex AI providers
 */

import { createLogger } from '~logger';
import { markGoogleApiKeyInvalid } from '@/utils/credentials';
import {
  APIError,
  NetworkError,
  ErrorType,
} from '../../errors/errorTypes';
import { parseVertexError, parseVertexErrorAsync } from './vertexErrorParser';
import type { AIProvider } from '@/utils/credentials';

const log = createLogger('AI-ErrorHandlers', 'AI_CHAT');

// Helper function for compatibility
const markApiKeyInvalid = (errorCode?: string) => markGoogleApiKeyInvalid(errorCode || 'AUTH_FAILED');

/**
 * Extract malformed function call details from Gemini response
 * Gemini sometimes returns Python code instead of proper function calls
 */
export function extractMalformedCallInfo(response: any): {
  isMalformed: boolean;
  code?: string;
  message?: string
} {
  try {
    // Check multiple possible response structures
    const bodyData = response?.body || response;
    const candidates = bodyData?.candidates;

    if (candidates?.[0]?.finishReason === 'MALFORMED_FUNCTION_CALL') {
      const finishMessage = candidates[0].finishMessage || '';
      return {
        isMalformed: true,
        code: finishMessage,
        message: 'Model generated code instead of a function call'
      };
    }

    return { isMalformed: false };
  } catch (error) {
    log.warn('Error extracting malformed call info:', error);
    return { isMalformed: false };
  }
}

/**
 * Extracted core for status-based error handling.
 * Returns the APIError if a specific status was matched, or undefined otherwise.
 */
function parseGeminiErrorCore(
  error: any,
  statusCode: number | undefined,
  message: string,
  details: string
): APIError | undefined {
  // Handle 429 - rate limit / quota
  if (statusCode === 429) {
    if (message.toLowerCase().includes('quota') || details?.toLowerCase().includes('quota')) {
      return APIError.quotaExceeded(details);
    }
    const retryAfter = error?.headers?.['retry-after'] ||
      error?.response?.headers?.['retry-after'];
    const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
    return APIError.rateLimitExceeded(retryAfterMs, details);
  }

  // Handle 403 - forbidden / quota / security
  if (statusCode === 403) {
    if (message.toLowerCase().includes('quota')) {
      return APIError.quotaExceeded(details);
    }
    if (message.toLowerCase().includes('leaked') || message.toLowerCase().includes('reported')) {
      return new APIError({
        message: 'API Key Security Issue',
        statusCode: 403,
        retryable: false,
        userMessage: '🔒 Your API key was reported as leaked. Please generate a new API key in Google AI Studio.',
        technicalDetails: details,
        errorCode: ErrorType.API_AUTH_FAILED,
      });
    }
    if (message.toLowerCase().includes('permission')) {
      return new APIError({
        message: 'Permission Denied',
        statusCode: 403,
        retryable: false,
        userMessage: 'API key does not have the required permissions. Please check your API key settings.',
        technicalDetails: details,
        errorCode: ErrorType.API_AUTH_FAILED,
      });
    }
    return new APIError({
      message: 'Forbidden',
      statusCode: 403,
      retryable: false,
      userMessage: 'Access forbidden. Your API key may be invalid or restricted.',
      technicalDetails: details,
      errorCode: ErrorType.API_AUTH_FAILED,
    });
  }

  // Handle 5xx - server errors
  if (statusCode !== undefined && statusCode >= 500 && statusCode < 600) {
    return APIError.serverError(statusCode, details);
  }

  // Handle network errors
  if (error?.code === 'ETIMEDOUT' || message.includes('timeout')) {
    return new NetworkError({
      message: 'Request timeout',
      retryable: true,
      userMessage: 'Request timed out. Retrying...',
      technicalDetails: details,
      errorCode: ErrorType.NETWORK_TIMEOUT,
    });
  }

  if (error?.code === 'ECONNRESET' || message.includes('connection reset')) {
    return NetworkError.connectionReset(details);
  }

  return undefined;
}

/**
 * Create fallback APIError for unknown error types
 */
function createFallbackError(
  statusCode: number | undefined,
  message: string,
  details: string
): APIError {
  return new APIError({
    message,
    statusCode,
    retryable: statusCode ? statusCode >= 500 : false,
    userMessage: 'An error occurred while processing your request.',
    technicalDetails: details,
    errorCode: ErrorType.UNKNOWN_ERROR,
  });
}

/**
 * Extract error metadata (statusCode, message, details) from error object
 */
function extractErrorMetadata(
  error: any,
  logPrefix: string
): { statusCode: number | undefined; message: string; details: string } {
  log.info(`${logPrefix} - Input error:`, {
    errorType: typeof error,
    isError: error instanceof Error,
    hasStatusCode: 'statusCode' in (error || {}),
    hasStatus: 'status' in (error || {}),
    hasMessage: 'message' in (error || {}),
    hasText: 'text' in (error || {}),
    errorKeys: error ? Object.keys(error) : []
  });

  const statusCode = error?.statusCode || error?.status || error?.response?.status;
  let message = error?.message || error?.error?.message;

  // Sync-safe .text extraction (if it's a function, we can't call it here)
  if (!message && error?.text) {
    try {
      if (typeof error.text === 'function') {
        log.warn(`${logPrefix}: error.text is a function - cannot call in sync context`);
        message = 'Error response contains text (async)';
      } else {
        message = String(error.text);
      }
    } catch (textError) {
      log.warn(`${logPrefix}: Failed to extract .text property`, textError);
      message = undefined;
    }
  }

  if (!message) {
    message = error ? String(error) : 'Unknown error';
  }

  const details = error?.error?.details || error?.details || message;

  log.info(`${logPrefix} - Extracted values:`, {
    statusCode,
    message: message?.substring(0, 100),
    detailsLength: details?.length || 0
  });

  return { statusCode, message, details };
}

/**
 * Create parse error fallback (for catch blocks)
 */
function createParseErrorFallback(
  parseError: unknown,
  originalError: any,
  stringifyError: () => string | Promise<string>
): APIError {
  log.error('❌ CRITICAL: Error parsing Gemini error:', {
    parseError,
    parseErrorMessage: parseError instanceof Error ? parseError.message : String(parseError),
    parseErrorStack: parseError instanceof Error ? parseError.stack : 'No stack',
    originalError,
    originalErrorType: typeof originalError,
    originalErrorStringified: stringifyError() // May be a Promise, but logger handles it
  });

  return new APIError({
    message: parseError instanceof Error ? parseError.message : 'Error parsing failed',
    retryable: false,
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalDetails: (() => {
      try {
        return `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}. Original error: ${originalError ? String(originalError) : 'undefined'}`;
      } catch {
        return 'Unable to extract error details';
      }
    })(),
    errorCode: ErrorType.UNKNOWN_ERROR,
  });
}

/**
 * Parse error from Gemini API response (async version)
 * Handles various error formats and status codes
 * Also updates API key validation cache based on auth errors
 */
export async function parseGeminiErrorAsync(error: any): Promise<APIError> {
  try {
    // Extract metadata - need special handling for async .text()
    const statusCode = error?.statusCode || error?.status || error?.response?.status;
    let message = error?.message || error?.error?.message;

    log.info('parseGeminiErrorAsync - Input error:', {
      errorType: typeof error,
      isError: error instanceof Error,
      hasStatusCode: 'statusCode' in (error || {}),
      hasStatus: 'status' in (error || {}),
      hasMessage: 'message' in (error || {}),
      hasText: 'text' in (error || {}),
      errorKeys: error ? Object.keys(error) : []
    });

    // Async .text extraction
    if (!message && error?.text) {
      try {
        if (typeof error.text === 'function') {
          message = await error.text();
        } else {
          message = String(error.text);
        }
      } catch (textError) {
        log.warn('parseGeminiErrorAsync: Failed to extract .text property', textError);
        message = undefined;
      }
    }

    if (!message) {
      message = error ? String(error) : 'Unknown error';
    }

    const details = error?.error?.details || error?.details || message;

    log.info('parseGeminiErrorAsync - Extracted values:', {
      statusCode,
      message: message?.substring(0, 100),
      detailsLength: details?.length || 0
    });

    // Use shared core for status-based handling
    const coreResult = parseGeminiErrorCore(error, statusCode, message, details);
    if (coreResult) {
      return coreResult;
    }

    // Handle 401 - auth failed (async-specific: await cache update)
    if (statusCode === 401) {
      await markApiKeyInvalid('AUTH_FAILED_401');
      return APIError.authFailed(details);
    }

    return createFallbackError(statusCode, message, details);
  } catch (parseError) {
    return createParseErrorFallback(parseError, error, async () => {
      try {
        return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
      } catch {
        return 'Unable to stringify error';
      }
    });
  }
}

/**
 * Parse error from Gemini API response (sync version)
 * For synchronous contexts - uses fire-and-forget for async operations
 */
export function parseGeminiError(error: any): APIError {
  try {
    const { statusCode, message, details } = extractErrorMetadata(error, 'parseGeminiError');

    // Use shared core for status-based handling
    const coreResult = parseGeminiErrorCore(error, statusCode, message, details);
    if (coreResult) {
      return coreResult;
    }

    // Handle 401 - auth failed (sync: fire-and-forget cache update)
    if (statusCode === 401) {
      markApiKeyInvalid('AUTH_FAILED_401').catch(err =>
        log.error('Failed to mark API key invalid:', err)
      );
      return APIError.authFailed(details);
    }

    return createFallbackError(statusCode, message, details);
  } catch (parseError) {
    return createParseErrorFallback(parseError, error, () => {
      try {
        return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
      } catch {
        return 'Unable to stringify error';
      }
    });
  }
}

/**
 * Provider-aware error parsing (async version)
 * Routes to appropriate parser based on provider
 * 
 * @param error - Error object to parse
 * @param provider - AI provider that generated the error
 * @returns Enhanced APIError with provider-specific handling
 */
export async function parseProviderErrorAsync(
  error: any,
  provider: AIProvider | 'local'
): Promise<APIError> {
  if (provider === 'vertex') {
    return parseVertexErrorAsync(error);
  } else if (provider === 'google') {
    return parseGeminiErrorAsync(error);
  } else {
    // Local mode - use Gemini parser as fallback
    return parseGeminiErrorAsync(error);
  }
}

/**
 * Provider-aware error parsing (sync version)
 * Routes to appropriate parser based on provider
 * 
 * @param error - Error object to parse
 * @param provider - AI provider that generated the error
 * @returns Enhanced APIError with provider-specific handling
 */
export function parseProviderError(
  error: any,
  provider: AIProvider | 'local'
): APIError {
  if (provider === 'vertex') {
    return parseVertexError(error);
  } else if (provider === 'google') {
    return parseGeminiError(error);
  } else {
    // Local mode - use Gemini parser as fallback
    return parseGeminiError(error);
  }
}

