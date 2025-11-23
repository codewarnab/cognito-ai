/**
 * Chrome Scripting API Helpers
 */

import { BrowserAPIError, parseError } from '../../errors';
import { createLogger } from '~logger';

const log = createLogger('ChromeAPI:Scripting');

/**
 * Check if an error message indicates a CSP violation
 */
function isCspError(message: string): boolean {
    const lowerMsg = message.toLowerCase();
    return (
        lowerMsg.includes('content security policy') ||
        lowerMsg.includes('csp') ||
        lowerMsg.includes('script-src') ||
        lowerMsg.includes('refused to execute inline script') ||
        lowerMsg.includes('violates the following content security policy')
    );
}

/**
 * Get the page URL from a tab ID
 */
async function getPageUrl(tabId?: number): Promise<string | undefined> {
    if (!tabId) return undefined;
    try {
        const tab = await chrome.tabs.get(tabId);
        return tab.url;
    } catch {
        // Tab info not available
        return undefined;
    }
}

/**
 * Safely execute a script in a tab with error handling
 * 
 * IMPORTANT: CSP Detection
 * - When CSP blocks a script, the error appears in the PAGE'S console (which we cannot access)
 * - BUT Chrome also returns the error in the result object's 'error' property (which we CAN access)
 * - Example: results = [{error: "Refused to execute inline script because it violates..."}]
 * - We check the result.error property to detect CSP violations
 */
export async function safeScriptingExecute(injection: any): Promise<any> {
    try {
        const results = await chrome.scripting.executeScript(injection);

        // Check if any result contains a CSP or execution error
        // CSP errors don't throw - they appear in result.error property
        if (results && results.length > 0) {
            for (const result of results) {
                // When CSP blocks script execution, Chrome returns: {error: {...}}
                // The same error that appears in the page's console is returned here
                if (result && 'error' in result && result.error) {
                    const error = result.error as any;
                    const errorMsg = error.message || String(error);

                    // Detect Content Security Policy violations
                    if (isCspError(errorMsg)) {
                        const pageUrl = await getPageUrl(injection.target?.tabId);
                        throw BrowserAPIError.cspViolation(
                            pageUrl,
                            `CSP Error: ${errorMsg}`
                        );
                    }
                }
            }
        }

        return results ?? [];
    } catch (error) {
        // This catches errors thrown by the API itself or our CSP detection above
        if (error instanceof BrowserAPIError) {
            throw error; // Re-throw our custom errors
        }

        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error) {
            const errorMsg = error.message;

            // Detect Content Security Policy violations in API errors
            if (isCspError(errorMsg)) {
                const pageUrl = await getPageUrl(injection.target?.tabId);
                throw BrowserAPIError.cspViolation(
                    pageUrl,
                    `CSP Error: ${errorMsg}`
                );
            }

            if (errorMsg.includes('cannot access')) {
                throw BrowserAPIError.contentScriptInjectionFailed(
                    'Extension does not have permission to inject scripts into this page.'
                );
            }

            if (errorMsg.includes('chrome://') || errorMsg.includes('chrome-extension://')) {
                throw BrowserAPIError.contentScriptInjectionFailed(
                    'Cannot inject scripts into chrome:// or extension pages.'
                );
            }
        }

        log.error('Failed to execute script:', parsedError);
        throw parsedError;
    }
}
