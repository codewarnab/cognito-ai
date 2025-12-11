/**
 * Chrome History API Helpers
 */

import { BrowserAPIError, parseError } from '../../errors';
import { createLogger } from '~logger';

const log = createLogger('ChromeAPI:History');

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
