/**
 * Error Handling Utilities for AI Logic
 * Handles error parsing, formatting, and API key validation updates
 */

import { createLogger } from '../../logger';
import { markApiKeyInvalid } from '../../utils/geminiApiKey';
import {
  APIError,
  NetworkError,
  ErrorType,
} from '../../errors/errorTypes';

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
    // Extract status code
    const statusCode = error?.statusCode || error?.status || error?.response?.status;

    // Extract error message
    const message = error?.message || error?.error?.message || String(error);
    const details = error?.error?.details || error?.details || message;

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
      return new APIError({
        message: 'Forbidden',
        statusCode: 403,
        retryable: false,
        userMessage: 'Access forbidden. Please check your API permissions.',
        technicalDetails: details,
        errorCode: ErrorType.API_INVALID_REQUEST,
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
    log.error('Error parsing Gemini error:', parseError);
    return new APIError({
      message: String(error),
      retryable: false,
      userMessage: 'An unexpected error occurred.',
      technicalDetails: String(error),
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
    const statusCode = error?.statusCode || error?.status || error?.response?.status;
    const message = error?.message || error?.error?.message || String(error);
    const details = error?.error?.details || error?.details || message;

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
      return new APIError({
        message: 'Forbidden',
        statusCode: 403,
        retryable: false,
        userMessage: 'Access forbidden. Please check your API permissions.',
        technicalDetails: details,
        errorCode: ErrorType.API_INVALID_REQUEST,
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
    log.error('Error parsing Gemini error:', parseError);
    return new APIError({
      message: String(error),
      retryable: false,
      userMessage: 'An unexpected error occurred.',
      technicalDetails: String(error),
      errorCode: ErrorType.UNKNOWN_ERROR,
    });
  }
}
