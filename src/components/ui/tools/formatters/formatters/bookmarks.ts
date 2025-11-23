/**
 * Bookmarks tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const createBookmarkFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = output?.title || input?.title;

    if (state === 'loading') {
        return {
            action: 'Creating bookmark',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Bookmark created',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Failed to create bookmark' };
};

export const searchBookmarksFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = input?.query;
    const count = output?.count || 0;

    if (state === 'loading') {
        return {
            action: 'Searching bookmarks',
            description: query ? `"${truncateText(query, 30)}"` : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Found bookmarks',
            description: `${count} result${count !== 1 ? 's' : ''}`
        };
    }
    return { action: 'Bookmark search failed' };
};

export const listBookmarksFormatter: ActionFormatter = ({ state, output }) => {
    const count = output?.count || 0;

    if (state === 'loading') {
        return { action: 'Loading bookmarks' };
    }
    if (state === 'success') {
        return {
            action: 'Listed bookmarks',
            description: `${count} item${count !== 1 ? 's' : ''}`
        };
    }
    return { action: 'Failed to list bookmarks' };
};

export const deleteBookmarkFormatter: ActionFormatter = ({ state }) => {
    if (state === 'loading') {
        return { action: 'Deleting bookmark' };
    }
    if (state === 'success') {
        return { action: 'Bookmark deleted' };
    }
    return { action: 'Failed to delete bookmark' };
};

export const updateBookmarkFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = output?.title || input?.title;

    if (state === 'loading') {
        return { action: 'Updating bookmark' };
    }
    if (state === 'success') {
        return {
            action: 'Bookmark updated',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Failed to update bookmark' };
};

export const getBookmarkTreeFormatter: ActionFormatter = ({ state, output }) => {
    const totalFolders = output?.totalFolders || 0;

    if (state === 'loading') {
        return { action: 'Loading bookmark tree' };
    }
    if (state === 'success') {
        return {
            action: 'Loaded bookmark tree',
            description: `${totalFolders} folder${totalFolders !== 1 ? 's' : ''}`
        };
    }
    return { action: 'Failed to load bookmark tree' };
};

export const organizeBookmarksFormatter: ActionFormatter = ({ state, output }) => {
    const suggestions = output?.suggestions;
    const count = suggestions?.newFolders?.length || 0;

    if (state === 'loading') {
        return { action: 'Analyzing bookmarks' };
    }
    if (state === 'success') {
        return {
            action: 'Organization suggestions',
            description: count > 0 ? `${count} suggestion${count !== 1 ? 's' : ''}` : 'No changes needed'
        };
    }
    return { action: 'Failed to analyze bookmarks' };
};
