import { createLogger } from "../logger";

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
    // Log full error details for debugging
    log.error('API Error occurred', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200), // First 200 chars of stack
        statusCode: (error as any).statusCode,
        errorCode: (error as any).errorCode,
        technicalDetails: (error as any).technicalDetails
    });

    const errorMessage = error.message || 'An error occurred';
    const errorStack = error.stack || '';
    const errorObj = error as any;
    const statusCode = errorObj?.statusCode;
    const fullErrorText = (errorObj?.technicalDetails || errorStack).toLowerCase();

    // Extract user-friendly message based on HTTP status code and error patterns
    let displayMessage: string | null = null;
    let shouldShowToast = false;

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

    // Priority 3: Check for auth-related errors in message/stack
    if (!displayMessage) {
        const isAuthError = errorMessage.toLowerCase().includes('auth') ||
            errorMessage.toLowerCase().includes('forbidden') ||
            errorMessage.toLowerCase().includes('api key') ||
            errorMessage.toLowerCase().includes('leaked') ||
            fullErrorText.includes('api key') ||
            fullErrorText.includes('leaked') ||
            fullErrorText.includes('forbidden') ||
            fullErrorText.includes('403') ||
            fullErrorText.includes('401') ||
            (errorObj?.errorCode && (
                errorObj.errorCode.includes('API_AUTH') ||
                errorObj.errorCode.includes('AUTH') ||
                errorObj.errorCode === 'UNKNOWN_ERROR' && (
                    errorMessage.toLowerCase().includes('cannot read') ||
                    fullErrorText.includes('api key')
                )
            ));

        if (isAuthError) {
            shouldShowToast = true;

            // If it's a TypeError wrapping the real error, try to extract from stack
            if (errorMessage.includes("Cannot read properties")) {
                if (fullErrorText.includes('leaked') || fullErrorText.includes('api key was reported')) {
                    displayMessage = "🔒 Your API key was reported as leaked. Please generate a new API key in Google AI Studio.";
                } else if (fullErrorText.includes('403') || fullErrorText.includes('forbidden')) {
                    displayMessage = "🔒 API Authentication Failed (403 Forbidden). Please check your API key in Google AI Studio.";
                } else if (fullErrorText.includes('401') || fullErrorText.includes('unauthorized')) {
                    displayMessage = "🔒 API Authentication Failed (401 Unauthorized). Please verify your API key.";
                } else {
                    displayMessage = "🔒 API Authentication Error. Please check your API key in the settings.";
                }
            } else {
                displayMessage = errorMessage.includes('leaked')
                    ? "🔒 Your API key was reported as leaked. Please generate a new API key in Google AI Studio."
                    : "🔒 API Authentication Error. Please check your API key in the settings.";
            }
        }
    }

    // Priority 4: Show toast for any remaining errors (fallback)
    if (!displayMessage && !shouldShowToast) {
        shouldShowToast = true;
        // Generic error message for uncategorized errors
        displayMessage = `⚠️ ${errorMessage}`;
    }

    log.info('Error analysis:', {
        shouldShowToast,
        statusCode,
        hasDisplayMessage: !!displayMessage,
        errorMessagePreview: errorMessage.substring(0, 100),
        errorCode: errorObj?.errorCode
    });

    // Don't show toast if we didn't find a user-actionable error
    if (!shouldShowToast || !displayMessage) {
        return null;
    }

    log.info('Showing error toast:', displayMessage.substring(0, 100));

    return {
        message: displayMessage,
        details: errorObj?.technicalDetails || error.stack
    };
}
