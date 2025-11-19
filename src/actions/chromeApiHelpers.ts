/**
 * Chrome API Error Handling Helpers
 * Wraps Chrome API calls with proper error handling and typed errors
 */

import { BrowserAPIError, parseError } from '../errors';
import { createLogger } from '~logger';

const log = createLogger('ChromeAPIHelpers');

/**
 * Safely execute a Chrome tabs API call with error handling
 */
export async function safeTabsQuery(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    try {
        const tabs = await chrome.tabs.query(queryInfo);
        return tabs ?? [];
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('tabs', 'Extension does not have permission to access tabs.');
        }

        log.error('Failed to query tabs:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely get a specific tab by ID with error handling
 */
export async function safeTabGet(tabId: number): Promise<chrome.tabs.Tab | null> {
    try {
        const tab = await chrome.tabs.get(tabId);
        return tab ?? null;
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('No tab with id')) {
            log.warn(`Tab not found: ${tabId}`);
            return null;
        }

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('tabs', 'Extension does not have permission to access tab.');
        }

        log.error('Failed to get tab:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely create a new tab with error handling
 */
export async function safeTabCreate(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
    try {
        const tab = await chrome.tabs.create(createProperties);
        if (!tab) {
            throw BrowserAPIError.tabNotFound(0);
        }
        return tab;
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('tabs', 'Extension does not have permission to create tabs.');
        }

        log.error('Failed to create tab:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely update a tab with error handling
 */
export async function safeTabUpdate(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab> {
    try {
        const tab = await chrome.tabs.update(tabId, updateProperties);
        if (!tab) {
            throw BrowserAPIError.tabNotFound(tabId);
        }
        return tab;
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('No tab with id')) {
            throw BrowserAPIError.tabNotFound(tabId);
        }

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('tabs', 'Extension does not have permission to update tabs.');
        }

        log.error('Failed to update tab:', parsedError);
        throw parsedError;
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
                    const errorMsg = (error.message || String(error)).toLowerCase();

                    // Detect Content Security Policy violations
                    if (errorMsg.includes('content security policy') ||
                        errorMsg.includes('csp') ||
                        errorMsg.includes('script-src') ||
                        errorMsg.includes('refused to execute inline script') ||
                        errorMsg.includes('violates the following content security policy')) {

                        // Get the page URL from the injection target
                        let pageUrl: string | undefined;
                        if (injection.target?.tabId) {
                            try {
                                const tab = await chrome.tabs.get(injection.target.tabId);
                                pageUrl = tab.url;
                            } catch {
                                // Tab info not available
                            }
                        }

                        throw BrowserAPIError.cspViolation(
                            pageUrl,
                            `CSP Error: ${error.message || String(error)}`
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
            const errorMsg = error.message.toLowerCase();

            // Detect Content Security Policy violations in API errors
            if (errorMsg.includes('content security policy') ||
                errorMsg.includes('csp') ||
                errorMsg.includes('script-src') ||
                errorMsg.includes('refused to execute inline script') ||
                errorMsg.includes('violates the following content security policy')) {

                let pageUrl: string | undefined;
                if (injection.target?.tabId) {
                    try {
                        const tab = await chrome.tabs.get(injection.target.tabId);
                        pageUrl = tab.url;
                    } catch {
                        // Tab info not available
                    }
                }

                throw BrowserAPIError.cspViolation(
                    pageUrl,
                    `CSP Error: ${error.message}`
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

/**
 * Safely access Chrome storage with error handling
 */
export async function safeStorageGet(keys?: string | string[] | null): Promise<{ [key: string]: any }> {
    try {
        const result = await chrome.storage.local.get(keys);
        return result ?? {};
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.toLowerCase().includes('quota')) {
            throw BrowserAPIError.storageQuotaExceeded('Storage quota has been exceeded.');
        }

        log.error('Failed to get storage:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely set Chrome storage with error handling
 */
export async function safeStorageSet(items: { [key: string]: any }): Promise<void> {
    try {
        await chrome.storage.local.set(items);
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.toLowerCase().includes('quota')) {
            throw BrowserAPIError.storageQuotaExceeded('Storage quota has been exceeded. Please clear some data.');
        }

        log.error('Failed to set storage:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely search Chrome history with error handling
 */
export async function safeHistorySearch(query: chrome.history.HistoryQuery): Promise<chrome.history.HistoryItem[]> {
    try {
        const results = await chrome.history.search(query);
        return results ?? [];
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('history', 'Extension does not have permission to access browsing history.');
        }

        log.error('Failed to search history:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely get Chrome bookmarks with error handling
 */
export async function safeBookmarksSearch(query: string): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
export async function safeBookmarksSearch(query: chrome.bookmarks.BookmarkSearchQuery): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
export async function safeBookmarksSearch(query: string | chrome.bookmarks.BookmarkSearchQuery): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    try {
        if (typeof query === 'string') {
            return await chrome.bookmarks.search(query);
        } else {
            return await chrome.bookmarks.search(query);
        }
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Extension does not have permission to access bookmarks.');
        }

        log.error('Failed to search bookmarks:', parsedError);
        throw parsedError;
    }
}

/**
 * Check if we have permission for a specific Chrome API
 */
export async function checkPermission(permission: string): Promise<boolean> {
    try {
        const hasPermission = await chrome.permissions.contains({
            permissions: [permission],
        });
        return hasPermission;
    } catch (error) {
        log.warn(`Failed to check permission ${permission}:`, error);
        return false;
    }
}

/**
 * Request a specific Chrome API permission
 */
export async function requestPermission(permission: string): Promise<boolean> {
    try {
        const granted = await chrome.permissions.request({
            permissions: [permission],
        });

        if (granted) {
            log.info(`✅ Permission granted: ${permission}`);
        } else {
            log.warn(`❌ Permission denied: ${permission}`);
        }

        return granted;
    } catch (error) {
        log.error(`Failed to request permission ${permission}:`, error);
        return false;
    }
}


