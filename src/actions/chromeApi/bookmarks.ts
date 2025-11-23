/**
 * Chrome Bookmarks API Helpers
 */

import { BrowserAPIError, parseError } from '../../errors';
import { createLogger } from '~logger';

const log = createLogger('ChromeAPI:Bookmarks');

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
 * Safely create a bookmark with error handling
 */
export async function safeBookmarksCreate(bookmark: chrome.bookmarks.BookmarkCreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    try {
        if (!chrome.bookmarks) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Bookmarks API is not available.');
        }

        const result = await chrome.bookmarks.create(bookmark);
        if (!result) {
            throw new Error('Failed to create bookmark: No result returned');
        }
        return result;
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Extension does not have permission to create bookmarks.');
        }

        log.error('Failed to create bookmark:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely get bookmark(s) by ID with error handling
 */
export async function safeBookmarksGet(id: string | string[]): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    try {
        if (!chrome.bookmarks) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Bookmarks API is not available.');
        }

        const results = Array.isArray(id) 
            ? await chrome.bookmarks.get(id)
            : await chrome.bookmarks.get(id);
        return results ?? [];
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Can not find bookmark')) {
            log.warn(`Bookmark not found: ${id}`);
            return [];
        }

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Extension does not have permission to access bookmarks.');
        }

        log.error('Failed to get bookmark(s):', parsedError);
        throw parsedError;
    }
}

/**
 * Safely get bookmark tree with error handling
 */
export async function safeBookmarksGetTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    try {
        if (!chrome.bookmarks) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Bookmarks API is not available.');
        }

        const tree = await chrome.bookmarks.getTree();
        return tree ?? [];
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Extension does not have permission to access bookmarks.');
        }

        log.error('Failed to get bookmark tree:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely get bookmark children with error handling
 */
export async function safeBookmarksGetChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    try {
        if (!chrome.bookmarks) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Bookmarks API is not available.');
        }

        const children = await chrome.bookmarks.getChildren(id);
        return children ?? [];
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Can not find bookmark')) {
            log.warn(`Bookmark folder not found: ${id}`);
            return [];
        }

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Extension does not have permission to access bookmarks.');
        }

        log.error('Failed to get bookmark children:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely remove a bookmark with error handling
 */
export async function safeBookmarksRemove(id: string): Promise<void> {
    try {
        if (!chrome.bookmarks) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Bookmarks API is not available.');
        }

        await chrome.bookmarks.remove(id);
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Can not find bookmark')) {
            throw new Error(`Bookmark not found: ${id}`);
        }

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Extension does not have permission to delete bookmarks.');
        }

        log.error('Failed to remove bookmark:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely update a bookmark with error handling
 */
export async function safeBookmarksUpdate(id: string, changes: chrome.bookmarks.BookmarkChangesArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    try {
        if (!chrome.bookmarks) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Bookmarks API is not available.');
        }

        const result = await chrome.bookmarks.update(id, changes);
        if (!result) {
            throw new Error('Failed to update bookmark: No result returned');
        }
        return result;
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Can not find bookmark')) {
            throw new Error(`Bookmark not found: ${id}`);
        }

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Extension does not have permission to update bookmarks.');
        }

        log.error('Failed to update bookmark:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely move a bookmark with error handling
 */
export async function safeBookmarksMove(id: string, destination: chrome.bookmarks.BookmarkDestinationArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    try {
        if (!chrome.bookmarks) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Bookmarks API is not available.');
        }

        const result = await chrome.bookmarks.move(id, destination);
        if (!result) {
            throw new Error('Failed to move bookmark: No result returned');
        }
        return result;
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Can not find bookmark')) {
            throw new Error(`Bookmark not found: ${id}`);
        }

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Extension does not have permission to move bookmarks.');
        }

        log.error('Failed to move bookmark:', parsedError);
        throw parsedError;
    }
}

/**
 * Safely get recent bookmarks with error handling
 */
export async function safeBookmarksGetRecent(numberOfItems: number): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    try {
        if (!chrome.bookmarks) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Bookmarks API is not available.');
        }

        const results = await chrome.bookmarks.getRecent(numberOfItems);
        return results ?? [];
    } catch (error) {
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (error instanceof Error && error.message.includes('Cannot access')) {
            throw BrowserAPIError.permissionDenied('bookmarks', 'Extension does not have permission to access bookmarks.');
        }

        log.error('Failed to get recent bookmarks:', parsedError);
        throw parsedError;
    }
}
