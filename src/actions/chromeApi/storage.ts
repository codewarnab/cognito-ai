/**
 * Chrome Storage API Helpers
 */

import { BrowserAPIError, parseError } from '../../errors';
import { createLogger } from '~logger';

const log = createLogger('ChromeAPI:Storage');

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
