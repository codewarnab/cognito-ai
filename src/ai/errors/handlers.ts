/**
 * Error Handling Utilities for AI Logic
 * Handles error parsing, formatting, and API key validation updates
 * Supports both Google Generative AI and Vertex AI providers
 */

import { createLogger } from '../../logger';
import { markGoogleApiKeyInvalid } from '../../utils/providerCredentials';

// Helper function for compatibility
const markApiKeyInvalid = (errorCode?: string) => markGoogleApiKeyInvalid(errorCode || 'AUTH_FAILED');
import {
  APIError,
  NetworkError,
  ErrorType,
} from '../../errors/errorTypes';
import { parseVertexError, parseVertexErrorAsync } from './vertexErrorParser';
import type { AIProvider } from '../../utils/providerTypes';

const log = createLogger('AI-ErrorHandlers');

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
 * Parse error from Gemini API response
 * Handles various error formats and status codes
 * Also updates API key validation cache based on auth errors
 */
export async function parseGeminiErrorAsync(error: any): Promise<APIError> {
  try {
    // Log detailed error structure for debugging
    log.info('parseGeminiErrorAsync - Input error:', {
      errorType: typeof error,
      isError: error instanceof Error,
      hasStatusCode: 'statusCode' in (error || {}),
      hasStatus: 'status' in (error || {}),
      hasMessage: 'message' in (error || {}),
      hasText: 'text' in (error || {}),
      errorKeys: error ? Object.keys(error) : []
    });

    // Extract status code
    const statusCode = error?.statusCode || error?.status || error?.response?.status;

    // Enhanced message extraction with .text fallback
    let message = error?.message || error?.error?.message;

    // Check if error has a .text property (common in fetch responses)
    if (!message && error?.text) {
      try {
        // If .text is a function, call it (await since we're in async context)
        if (typeof error.text === 'function') {
          message = await error.text();
        } else {
          // If .text is a string, use it directly
          message = String(error.text);
        }
      } catch (textError) {
        log.warn('parseGeminiErrorAsync: Failed to extract .text property', textError);
        message = undefined;
      }
    }

    // Final fallback
    if (!message) {
      message = error ? String(error) : 'Unknown error';
    }

    const details = error?.error?.details || error?.details || message;

    log.info('parseGeminiErrorAsync - Extracted values:', {
      statusCode,
      message: message?.substring(0, 100),
      detailsLength: details?.length || 0
    });

    // Handle specific status codes
    if (statusCode === 429) {
      // Rate limit - check for Retry-After header
      const retryAfter = error?.headers?.['retry-after'] ||
        error?.response?.headers?.['retry-after'];
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      return APIError.rateLimitExceeded(retryAfterMs, details);
    }

    if (statusCode === 403) {
      // Check if it's quota exceeded or permission issue
      if (message.toLowerCase().includes('quota')) {
        return APIError.quotaExceeded(details);
      }

      // Check if API key was leaked or reported
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

      // Check if it's a permission issue
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

      // Generic 403 error
      return new APIError({
        message: 'Forbidden',
        statusCode: 403,
        retryable: false,
        userMessage: 'Access forbidden. Your API key may be invalid or restricted.',
        technicalDetails: details,
        errorCode: ErrorType.API_AUTH_FAILED,
      });
    }

    if (statusCode === 401) {
      // Mark API key as invalid in cache
      await markApiKeyInvalid('AUTH_FAILED_401');
      return APIError.authFailed(details);
    }

    if (statusCode >= 500 && statusCode < 600) {
      return APIError.serverError(statusCode, details);
    }

    // Check for network errors
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

    // Default to generic API error
    return new APIError({
      message,
      statusCode,
      retryable: statusCode ? statusCode >= 500 : false,
      userMessage: 'An error occurred while processing your request.',
      technicalDetails: details,
      errorCode: ErrorType.UNKNOWN_ERROR,
    });
  } catch (parseError) {
    log.error('❌ CRITICAL: Error parsing Gemini error (async):', {
      parseError,
      parseErrorMessage: parseError instanceof Error ? parseError.message : String(parseError),
      parseErrorStack: parseError instanceof Error ? parseError.stack : 'No stack',
      originalError: error,
      originalErrorType: typeof error,
      originalErrorStringified: await (async () => {
        try {
          return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
        } catch {
          return 'Unable to stringify error';
        }
      })()
    });

    // Create a safe fallback error
    return new APIError({
      message: parseError instanceof Error ? parseError.message : 'Error parsing failed',
      retryable: false,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalDetails: await (async () => {
        try {
          return `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}. Original error: ${error ? String(error) : 'undefined'}`;
        } catch {
          return 'Unable to extract error details';
        }
      })(),
      errorCode: ErrorType.UNKNOWN_ERROR,
    });
  }
}

/**
 * Synchronous version for backward compatibility
 */
export function parseGeminiError(error: any): APIError {
  // For synchronous contexts, we can't await the async operations
  // So we'll use a simplified version without API key cache updates
  try {
    // Log detailed error structure for debugging
    log.info('parseGeminiError - Input error:', {
      errorType: typeof error,
      isError: error instanceof Error,
      hasStatusCode: 'statusCode' in (error || {}),
      hasStatus: 'status' in (error || {}),
      hasMessage: 'message' in (error || {}),
      hasText: 'text' in (error || {}),
      errorKeys: error ? Object.keys(error) : []
    });

    const statusCode = error?.statusCode || error?.status || error?.response?.status;

    // Enhanced message extraction with .text fallback
    let message = error?.message || error?.error?.message;

    // Check if error has a .text property (common in fetch responses)
    if (!message && error?.text) {
      try {
        // If .text is a function, call it
        if (typeof error.text === 'function') {
          log.warn('parseGeminiError: error.text is a function - cannot call in sync context');
          message = 'Error response contains text (async)';
        } else {
          // If .text is a string, use it directly
          message = String(error.text);
        }
      } catch (textError) {
        log.warn('parseGeminiError: Failed to extract .text property', textError);
        message = undefined;
      }
    }

    // Final fallback
    if (!message) {
      message = error ? String(error) : 'Unknown error';
    }

    const details = error?.error?.details || error?.details || message;

    log.info('parseGeminiError - Extracted values:', {
      statusCode,
      message: message?.substring(0, 100),
      detailsLength: details?.length || 0
    });

    if (statusCode === 429) {
      const retryAfter = error?.headers?.['retry-after'] ||
        error?.response?.headers?.['retry-after'];
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      return APIError.rateLimitExceeded(retryAfterMs, details);
    }

    if (statusCode === 403) {
      if (message.toLowerCase().includes('quota')) {
        return APIError.quotaExceeded(details);
      }

      // Check if API key was leaked or reported
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

      // Check if it's a permission issue
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

      // Generic 403 error
      return new APIError({
        message: 'Forbidden',
        statusCode: 403,
        retryable: false,
        userMessage: 'Access forbidden. Your API key may be invalid or restricted.',
        technicalDetails: details,
        errorCode: ErrorType.API_AUTH_FAILED,
      });
    }

    if (statusCode === 401) {
      // Note: Cache update should be done in async context
      markApiKeyInvalid('AUTH_FAILED_401').catch(err =>
        log.error('Failed to mark API key invalid:', err)
      );
      return APIError.authFailed(details);
    }

    if (statusCode >= 500 && statusCode < 600) {
      return APIError.serverError(statusCode, details);
    }

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

    return new APIError({
      message,
      statusCode,
      retryable: statusCode ? statusCode >= 500 : false,
      userMessage: 'An error occurred while processing your request.',
      technicalDetails: details,
      errorCode: ErrorType.UNKNOWN_ERROR,
    });
  } catch (parseError) {
    log.error('❌ CRITICAL: Error parsing Gemini error:', {
      parseError,
      parseErrorMessage: parseError instanceof Error ? parseError.message : String(parseError),
      parseErrorStack: parseError instanceof Error ? parseError.stack : 'No stack',
      originalError: error,
      originalErrorType: typeof error,
      originalErrorStringified: (() => {
        try {
          return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
        } catch {
          return 'Unable to stringify error';
        }
      })()
    });

    // Create a safe fallback error
    return new APIError({
      message: parseError instanceof Error ? parseError.message : 'Error parsing failed',
      retryable: false,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalDetails: (() => {
        try {
          return `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}. Original error: ${error ? String(error) : 'undefined'}`;
        } catch {
          return 'Unable to extract error details';
        }
      })(),
      errorCode: ErrorType.UNKNOWN_ERROR,
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
