/**
 * Vertex AI Error Parser
 * Handles Vertex AI specific error codes and messages
 * 
 * Based on: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/api-errors
 */

import { createLogger } from '~logger';
import { APIError, NetworkError, ErrorType } from '../../errors/errorTypes';
import { markVertexCredentialsInvalid } from '../../utils/providerCredentials';

const log = createLogger('AI-VertexErrorParser');

/**
 * Parse Vertex AI error with provider-specific handling
 * Handles various error codes specific to Vertex AI
 * Also updates credential validation cache based on auth errors
 */
export async function parseVertexErrorAsync(error: any): Promise<APIError> {
    try {
        log.info('parseVertexErrorAsync - Input error:', {
            errorType: typeof error,
            isError: error instanceof Error,
            hasStatusCode: 'statusCode' in (error || {}),
            hasStatus: 'status' in (error || {}),
            hasMessage: 'message' in (error || {}),
            errorKeys: error ? Object.keys(error) : []
        });

        // Extract status code
        const statusCode = error?.statusCode || error?.status || error?.response?.status;

        // Enhanced message extraction
        let message = error?.message || error?.error?.message;

        // Check if error has a .text property (common in fetch responses)
        if (!message && error?.text) {
            try {
                if (typeof error.text === 'function') {
                    message = await error.text();
                } else {
                    message = String(error.text);
                }
            } catch (textError) {
                log.warn('parseVertexErrorAsync: Failed to extract .text property', textError);
                message = undefined;
            }
        }

        // Final fallback
        if (!message) {
            message = error ? String(error) : 'Unknown error';
        }

        const details = error?.error?.details || error?.details || message;
        const messageLower = message.toLowerCase();

        log.info('parseVertexErrorAsync - Extracted values:', {
            statusCode,
            message: message?.substring(0, 100),
            detailsLength: details?.length || 0
        });

        // ========== 400: Invalid Argument / Failed Precondition ==========
        if (statusCode === 400) {
            // Check for model allowlisting required
            if (messageLower.includes('allowlist') || messageLower.includes('not available')) {
                return APIError.vertexModelAccessRequired(details);
            }

            // Check for organization policy block
            if (messageLower.includes('organization policy') || messageLower.includes('blocked by policy')) {
                return APIError.vertexModelAccessRequired(
                    `${details} - Your organization policy may be blocking access to this model.`
                );
            }

            // Check for token limit exceeded
            if (messageLower.includes('token limit') || messageLower.includes('too large')) {
                return new APIError({
                    message: 'Input exceeds token limit',
                    statusCode: 400,
                    retryable: false,
                    userMessage: 'Input is too large. Try reducing the message length or context.',
                    technicalDetails: details,
                    errorCode: ErrorType.API_INVALID_REQUEST,
                });
            }

            // Generic 400 error
            return new APIError({
                message: 'Invalid request',
                statusCode: 400,
                retryable: false,
                userMessage: 'Invalid request. Please check your input and try again.',
                technicalDetails: details,
                errorCode: ErrorType.API_INVALID_REQUEST,
            });
        }

        // ========== 401: Unauthorized ==========
        if (statusCode === 401) {
            // Mark credentials as invalid in cache
            await markVertexCredentialsInvalid('AUTH_FAILED_401');
            return APIError.authFailed(details);
        }

        // ========== 403: Permission Denied ==========
        if (statusCode === 403) {
            // Vertex AI 403 indicates service account permission issues
            // Different from Google AI 403 (API key issues)

            // Check if it's a quota issue (some quota errors return 403)
            if (messageLower.includes('quota')) {
                return APIError.quotaExceeded(details);
            }

            // Check for Cloud Storage permission issues
            if (messageLower.includes('storage') || messageLower.includes('bucket')) {
                return new APIError({
                    message: 'Cloud Storage permission denied',
                    statusCode: 403,
                    retryable: false,
                    userMessage: 'Service account lacks Cloud Storage permissions. Grant Storage Object Viewer role in GCP.',
                    technicalDetails: details,
                    errorCode: ErrorType.API_VERTEX_PERMISSION_DENIED,
                });
            }

            // Generic Vertex permission denied
            return APIError.vertexPermissionDenied(details);
        }

        // ========== 404: Not Found ==========
        if (statusCode === 404) {
            return APIError.vertexResourceNotFound(details);
        }

        // ========== 429: Resource Exhausted ==========
        if (statusCode === 429) {
            // Parse quota type from message if available
            let quotaType = 'API quota';
            if (messageLower.includes('requests per minute')) {
                quotaType = 'Requests per minute quota';
            } else if (messageLower.includes('daily')) {
                quotaType = 'Daily quota';
            } else if (messageLower.includes('logprobs')) {
                quotaType = 'Daily logprobs quota';
            }

            // Check for Retry-After header
            const retryAfter = error?.headers?.['retry-after'] ||
                error?.response?.headers?.['retry-after'];
            const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;

            return APIError.vertexQuotaExhausted(
                `${quotaType} exceeded. ${details}`,
                retryAfterMs
            );
        }

        // ========== 499: Cancelled ==========
        if (statusCode === 499) {
            // User intentionally cancelled - don't treat as error
            return APIError.vertexCancelled(details);
        }

        // ========== 500: Internal / Unknown ==========
        if (statusCode === 500) {
            // Server error or dependency failure
            return APIError.serverError(statusCode, details);
        }

        // ========== 503: Unavailable ==========
        if (statusCode === 503) {
            // Service temporarily unavailable
            return new APIError({
                message: 'Vertex AI service unavailable',
                statusCode: 503,
                retryable: true,
                userMessage: 'Vertex AI is temporarily unavailable. Retrying...',
                technicalDetails: details,
                errorCode: ErrorType.API_SERVER_ERROR,
            });
        }

        // ========== 504: Deadline Exceeded ==========
        if (statusCode === 504) {
            return APIError.vertexDeadlineExceeded(details);
        }

        // ========== Network Errors ==========
        if (error?.code === 'ETIMEDOUT' || messageLower.includes('timeout')) {
            return new NetworkError({
                message: 'Request timeout',
                retryable: true,
                userMessage: 'Request timed out. Retrying...',
                technicalDetails: details,
                errorCode: ErrorType.NETWORK_TIMEOUT,
            });
        }

        if (error?.code === 'ECONNRESET' || messageLower.includes('connection reset')) {
            return NetworkError.connectionReset(details);
        }

        // ========== Generic 5xx Server Errors ==========
        if (statusCode >= 500 && statusCode < 600) {
            return APIError.serverError(statusCode, details);
        }

        // ========== Default: Unknown Error ==========
        return new APIError({
            message,
            statusCode,
            retryable: statusCode ? statusCode >= 500 : false,
            userMessage: 'An error occurred while processing your request with Vertex AI.',
            technicalDetails: details,
            errorCode: ErrorType.UNKNOWN_ERROR,
        });
    } catch (parseError) {
        log.error('❌ CRITICAL: Error parsing Vertex error (async):', {
            parseError,
            parseErrorMessage: parseError instanceof Error ? parseError.message : String(parseError),
            parseErrorStack: parseError instanceof Error ? parseError.stack : 'No stack',
            originalError: error,
        });

        // Create a safe fallback error
        return new APIError({
            message: parseError instanceof Error ? parseError.message : 'Error parsing failed',
            retryable: false,
            userMessage: 'An unexpected error occurred with Vertex AI. Please try again.',
            technicalDetails: `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            errorCode: ErrorType.UNKNOWN_ERROR,
        });
    }
}

/**
 * Synchronous version for backward compatibility
 */
export function parseVertexError(error: any): APIError {
    try {
        log.info('parseVertexError - Input error:', {
            errorType: typeof error,
            isError: error instanceof Error,
            hasStatusCode: 'statusCode' in (error || {}),
            errorKeys: error ? Object.keys(error) : []
        });

        const statusCode = error?.statusCode || error?.status || error?.response?.status;
        let message = error?.message || error?.error?.message;

        if (!message && error?.text) {
            try {
                if (typeof error.text === 'function') {
                    log.warn('parseVertexError: error.text is a function - cannot call in sync context');
                    message = 'Error response contains text (async)';
                } else {
                    message = String(error.text);
                }
            } catch (textError) {
                log.warn('parseVertexError: Failed to extract .text property', textError);
                message = undefined;
            }
        }

        if (!message) {
            message = error ? String(error) : 'Unknown error';
        }

        const details = error?.error?.details || error?.details || message;
        const messageLower = message.toLowerCase();

        // Handle all status codes with same logic as async version
        // (Sync version for backward compatibility - mark credentials async)

        if (statusCode === 400) {
            if (messageLower.includes('allowlist') || messageLower.includes('not available')) {
                return APIError.vertexModelAccessRequired(details);
            }
            if (messageLower.includes('organization policy') || messageLower.includes('blocked by policy')) {
                return APIError.vertexModelAccessRequired(
                    `${details} - Your organization policy may be blocking access.`
                );
            }
            if (messageLower.includes('token limit') || messageLower.includes('too large')) {
                return new APIError({
                    message: 'Input exceeds token limit',
                    statusCode: 400,
                    retryable: false,
                    userMessage: 'Input is too large. Try reducing the message length.',
                    technicalDetails: details,
                    errorCode: ErrorType.API_INVALID_REQUEST,
                });
            }
            return new APIError({
                message: 'Invalid request',
                statusCode: 400,
                retryable: false,
                userMessage: 'Invalid request. Please check your input.',
                technicalDetails: details,
                errorCode: ErrorType.API_INVALID_REQUEST,
            });
        }

        if (statusCode === 401) {
            markVertexCredentialsInvalid('AUTH_FAILED_401').catch((err: Error) =>
                log.error('Failed to mark Vertex credentials invalid:', err)
            );
            return APIError.authFailed(details);
        }

        if (statusCode === 403) {
            if (messageLower.includes('quota')) {
                return APIError.quotaExceeded(details);
            }
            if (messageLower.includes('storage') || messageLower.includes('bucket')) {
                return new APIError({
                    message: 'Cloud Storage permission denied',
                    statusCode: 403,
                    retryable: false,
                    userMessage: 'Service account lacks Cloud Storage permissions.',
                    technicalDetails: details,
                    errorCode: ErrorType.API_VERTEX_PERMISSION_DENIED,
                });
            }
            return APIError.vertexPermissionDenied(details);
        }

        if (statusCode === 404) {
            return APIError.vertexResourceNotFound(details);
        }

        if (statusCode === 429) {
            const retryAfter = error?.headers?.['retry-after'] ||
                error?.response?.headers?.['retry-after'];
            const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
            return APIError.vertexQuotaExhausted(details, retryAfterMs);
        }

        if (statusCode === 499) {
            return APIError.vertexCancelled(details);
        }

        if (statusCode === 504) {
            return APIError.vertexDeadlineExceeded(details);
        }

        if (error?.code === 'ETIMEDOUT' || messageLower.includes('timeout')) {
            return new NetworkError({
                message: 'Request timeout',
                retryable: true,
                userMessage: 'Request timed out. Retrying...',
                technicalDetails: details,
                errorCode: ErrorType.NETWORK_TIMEOUT,
            });
        }

        if (error?.code === 'ECONNRESET' || messageLower.includes('connection reset')) {
            return NetworkError.connectionReset(details);
        }

        if (statusCode >= 500 && statusCode < 600) {
            return APIError.serverError(statusCode, details);
        }

        return new APIError({
            message,
            statusCode,
            retryable: statusCode ? statusCode >= 500 : false,
            userMessage: 'An error occurred with Vertex AI.',
            technicalDetails: details,
            errorCode: ErrorType.UNKNOWN_ERROR,
        });
    } catch (parseError) {
        log.error('❌ CRITICAL: Error parsing Vertex error:', {
            parseError,
            originalError: error,
        });

        return new APIError({
            message: parseError instanceof Error ? parseError.message : 'Error parsing failed',
            retryable: false,
            userMessage: 'An unexpected error occurred with Vertex AI.',
            technicalDetails: `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            errorCode: ErrorType.UNKNOWN_ERROR,
        });
    }
}

