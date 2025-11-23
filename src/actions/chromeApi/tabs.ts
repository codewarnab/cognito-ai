/**
 * Chrome Tabs API Helpers
 */

import { BrowserAPIError, parseError } from '../../errors';
import { createLogger } from '~logger';

const log = createLogger('ChromeAPI:Tabs');

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
