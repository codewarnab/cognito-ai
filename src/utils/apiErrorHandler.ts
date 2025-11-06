import { createLogger } from "../logger";
import { ErrorType } from "../errors/errorTypes";

const log = createLogger("APIErrorHandler");

export interface ErrorToastState {
    message: string;
    details?: string;
}

/**
 * Analyzes an error and determines if it should display an error toast
 * Returns the error toast state if the error should be displayed, null otherwise
 * 
 * Based on Google Gemini API error codes:
 * https://ai.google.dev/gemini-api/docs/troubleshooting
 */
export function handleAPIError(error: Error): ErrorToastState | null {
    // Log full error details for debugging with complete stack trace
    log.error('API Error occurred', {
        name: error.name,
        message: error.message,
        fullStack: error.stack, // Log complete stack, not truncated
        statusCode: (error as any).statusCode,
        errorCode: (error as any).errorCode,
        technicalDetails: (error as any).technicalDetails,
        userMessage: (error as any).userMessage,
        // Log the entire error object for maximum visibility
        completeError: error
    });

    const errorMessage = error.message || 'An error occurred';
    const errorStack = error.stack || '';
    const errorObj = error as any;
    const statusCode = errorObj?.statusCode;
    const errorCode = errorObj?.errorCode;
    const userMessage = errorObj?.userMessage;
    const fullErrorText = (errorObj?.technicalDetails || errorStack).toLowerCase();

    log.info('Error analysis start', {
        hasStatusCode: !!statusCode,
        statusCodeValue: statusCode,
        hasErrorCode: !!errorCode,
        errorCodeValue: errorCode,
        hasUserMessage: !!userMessage
    });

    // Extract user-friendly message based on HTTP status code and error patterns
    let displayMessage: string | null = null;
    let shouldShowToast = false;

    // Priority 0: Check for BrowserAPIError first (local mode issues)
    if (errorCode && errorCode.includes('BROWSER_AI')) {
        log.info('Browser AI error detected', { errorCode, message: errorMessage });
        shouldShowToast = true;

        if (errorCode === 'BROWSER_AI_MODEL_STORAGE_ERROR') {
            displayMessage = "💾 Local Mode Unavailable: Insufficient storage for Gemini Nano. Please free up at least 20GB of disk space or switch to Remote Mode in Settings.";
        } else {
            displayMessage = errorObj?.userMessage || errorMessage;
        }

        if (displayMessage) {
            log.info('Showing browser AI error toast:', displayMessage.substring(0, 100));
            return {
                message: displayMessage,
                details: errorObj?.technicalDetails || error.stack
            };
        }
    }

    // Priority 0.5: Check for errorCode API_AUTH_FAILED even without statusCode
    // This handles cases where API key validation fails before making an API call
    if (!statusCode && errorCode === ErrorType.API_AUTH_FAILED) {
        log.info('API_AUTH_FAILED error code detected without statusCode');
        shouldShowToast = true;
        // Use the userMessage if available, otherwise construct a message
        displayMessage = userMessage || errorMessage || "🔒 API Authentication Error. Please check your API key in the settings.";

        if (displayMessage) {
            log.info('Showing auth error toast:', displayMessage.substring(0, 100));
            return {
                message: displayMessage,
                details: errorObj?.technicalDetails || error.stack
            };
        }
    }

    // Priority 1: Check specific HTTP status codes (most reliable)
    if (statusCode) {
        switch (statusCode) {
            case 400:
                shouldShowToast = true;
                if (fullErrorText.includes('failed_precondition') ||
                    fullErrorText.includes('billing') ||
                    fullErrorText.includes('free tier')) {
                    displayMessage = "⚠️ API access requires billing. Please enable billing on your project in Google AI Studio.";
                } else if (fullErrorText.includes('invalid_argument') ||
                    errorMessage.toLowerCase().includes('malformed')) {
                    displayMessage = "⚠️ Invalid request format. Please check your input parameters.";
                } else {
                    displayMessage = "⚠️ Bad Request (400). Please verify your request parameters.";
                }
                break;

            case 401:
                shouldShowToast = true;
                displayMessage = "🔒 Authentication Failed (401). Please verify your API key in the settings.";
                break;

            case 403:
                shouldShowToast = true;
                if (fullErrorText.includes('leaked') || fullErrorText.includes('api key was reported')) {
                    displayMessage = "🔒 Your API key was reported as leaked. Please generate a new API key in Google AI Studio.";
                } else if (fullErrorText.includes('permission')) {
                    displayMessage = "🔒 Permission Denied (403). Your API key doesn't have the required permissions.";
                } else {
                    displayMessage = "🔒 Authentication Failed (403 Forbidden). Please check your API key in Google AI Studio.";
                }
                break;

            case 404:
                shouldShowToast = true;
                displayMessage = "❌ Resource Not Found (404). The requested resource or model doesn't exist.";
                break;

            case 429:
                // Don't show toast for rate limit errors - handle silently
                shouldShowToast = false;
                log.info('Rate limit hit (429) - not showing toast');
                return null;

            case 500:
                shouldShowToast = true;
                if (fullErrorText.includes('context') || fullErrorText.includes('too long')) {
                    displayMessage = "⚠️ Internal Error (500). Your input context may be too long. Try reducing input size or switching to Gemini 1.5 Flash.";
                } else {
                    displayMessage = "⚠️ Internal Server Error (500). Please try again later or report in Google AI Studio.";
                }
                break;

            case 503:
                shouldShowToast = true;
                displayMessage = "⏸️ Service Unavailable (503). The service is temporarily overloaded. Try switching to Gemini 1.5 Flash or wait a moment.";
                break;

            case 504:
                shouldShowToast = true;
                displayMessage = "⏱️ Request Timeout (504). Your prompt may be too large. Try reducing input size or increasing timeout.";
                break;

            default:
                if (statusCode >= 400) {
                    shouldShowToast = true;
                    displayMessage = `⚠️ API Error (${statusCode}). Please check the console for details.`;
                }
        }
    }

    // Priority 2: Check for safety/content blocking issues
    if (!displayMessage && (
        fullErrorText.includes('blocked') ||
        fullErrorText.includes('safety') ||
        fullErrorText.includes('harm_category') ||
        errorMessage.toLowerCase().includes('blocked')
    )) {
        shouldShowToast = true;
        if (fullErrorText.includes('recitation')) {
            displayMessage = "🛡️ Content Blocked: Response may resemble certain data. Try making your prompt more unique or use higher temperature.";
        } else if (fullErrorText.includes('other')) {
            displayMessage = "🛡️ Content Blocked: Request may violate terms of service or safety policies.";
        } else {
            displayMessage = "🛡️ Content Blocked: Request blocked by safety filters. Please review your prompt and safety settings.";
        }
    }

    // Priority 3: Check for browser AI errors (local mode failures)
    if (!displayMessage && (errorObj?.errorCode?.includes('BROWSER_AI') ||
        errorMessage.toLowerCase().includes('insufficient storage') ||
        errorMessage.toLowerCase().includes('gemini nano') ||
        fullErrorText.includes('insufficient storage') ||
        fullErrorText.includes('gemini nano'))) {
        shouldShowToast = true;
        displayMessage = "💾 Local Mode Unavailable: Insufficient storage for Gemini Nano. Please free up at least 20GB of disk space or switch to Remote Mode in Settings.";
    }

    // Priority 4: Check for auth-related errors in message/stack
    if (!displayMessage) {
        // Don't treat "Cannot read properties" TypeErrors as auth errors
        // These are usually local AI/browser errors, not API authentication issues
        const isTypeError = errorMessage.includes("Cannot read properties") ||
            errorMessage.includes("Cannot access") ||
            errorMessage.includes("is not defined");

        const isAuthError = !isTypeError && (
            errorMessage.toLowerCase().includes('auth') ||
            errorMessage.toLowerCase().includes('forbidden') ||
            errorMessage.toLowerCase().includes('api key') ||
            errorMessage.toLowerCase().includes('leaked') ||
            errorMessage.toLowerCase().includes('validation') ||  // Add this check
            fullErrorText.includes('api key') ||
            fullErrorText.includes('leaked') ||
            fullErrorText.includes('forbidden') ||
            fullErrorText.includes('403') ||
            fullErrorText.includes('401') ||
            fullErrorText.includes('validation') ||  // Add this check
            (errorObj?.errorCode && (
                errorObj.errorCode.includes('API_AUTH') ||
                errorObj.errorCode.includes('AUTH')
            ))
        );

        if (isAuthError) {
            shouldShowToast = true;
            displayMessage = errorMessage.includes('leaked')
                ? "🔒 Your API key was reported as leaked. Please generate a new API key in Google AI Studio."
                : errorMessage.includes('validation')
                    ? "🔒 API Key Validation Failed. Please check your API key in the settings."
                    : "🔒 API Authentication Error. Please check your API key in the settings.";

            log.info('Auth error detected and toast will be shown', {
                displayMessage,
                errorMessage: errorMessage.substring(0, 100)
            });
        }
    }

    // Priority 5: Check for stream processing errors (suppress these)
    // These often occur after BrowserAPIErrors when AI SDK tries to process undefined responses
    if (!displayMessage && !shouldShowToast) {
        const isStreamProcessingError =
            errorMessage.includes("Cannot read properties") ||
            errorMessage.includes("Cannot access") ||
            (errorMessage.includes("undefined") && errorObj?.name === 'TypeError');

        if (isStreamProcessingError) {
            log.info('Stream processing error detected - suppressing toast', {
                errorMessage: errorMessage.substring(0, 100),
                name: error.name
            });
            // Don't show toast for stream processing errors
            // These are likely secondary errors following a primary error that was already shown
            return null;
        }
    }

    // Priority 6: Show toast for any remaining errors (fallback)
    if (!displayMessage && !shouldShowToast) {
        shouldShowToast = true;

        // Generic error message for uncategorized errors
        displayMessage = `⚠️ ${errorMessage}`;
    }

    log.info('Error analysis complete:', {
        shouldShowToast,
        statusCode,
        hasDisplayMessage: !!displayMessage,
        displayMessagePreview: displayMessage?.substring(0, 100),
        errorMessagePreview: errorMessage.substring(0, 100),
        errorCode: errorObj?.errorCode,
        willShowToast: shouldShowToast && !!displayMessage
    });

    // Don't show toast if we didn't find a user-actionable error
    if (!shouldShowToast || !displayMessage) {
        log.info('Not showing toast', { shouldShowToast, hasDisplayMessage: !!displayMessage });
        return null;
    }

    log.info('Showing error toast:', displayMessage.substring(0, 100));

    return {
        message: displayMessage,
        details: errorObj?.technicalDetails || error.stack
    };
}
