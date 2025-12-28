/**
 * Bookmarks tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const createBookmarkFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = (output?.title || input?.title) as string | undefined;

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
    if (state === 'pending-approval') {
        return {
            action: 'Create bookmark',
            description: title ? truncateText(title, 40) : 'Waiting for approval'
        };
    }
    return { action: 'Failed to create bookmark' };
};

export const searchBookmarksFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = input?.query as string | undefined;
    const count = (output?.count as number) || 0;

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
    if (state === 'pending-approval') {
        return {
            action: 'Search bookmarks',
            description: query ? `"${truncateText(query, 30)}"` : 'Waiting for approval'
        };
    }
    return { action: 'Bookmark search failed' };
};

export const listBookmarksFormatter: ActionFormatter = ({ state, output }) => {
    const count = (output?.count as number) || 0;

    if (state === 'loading') {
        return { action: 'Loading bookmarks' };
    }
    if (state === 'success') {
        return {
            action: 'Listed bookmarks',
            description: `${count} item${count !== 1 ? 's' : ''}`
        };
    }
    if (state === 'pending-approval') {
        return { action: 'List bookmarks', description: 'Waiting for approval' };
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
    if (state === 'pending-approval') {
        return { action: 'Delete bookmark', description: 'Waiting for approval' };
    }
    return { action: 'Failed to delete bookmark' };
};

export const updateBookmarkFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = (output?.title || input?.title) as string | undefined;

    if (state === 'loading') {
        return { action: 'Updating bookmark' };
    }
    if (state === 'success') {
        return {
            action: 'Bookmark updated',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Update bookmark',
            description: title ? truncateText(title, 40) : 'Waiting for approval'
        };
    }
    return { action: 'Failed to update bookmark' };
};

export const getBookmarkTreeFormatter: ActionFormatter = ({ state, output }) => {
    const totalFolders = (output?.totalFolders as number) || 0;

    if (state === 'loading') {
        return { action: 'Loading bookmark tree' };
    }
    if (state === 'success') {
        return {
            action: 'Loaded bookmark tree',
            description: `${totalFolders} folder${totalFolders !== 1 ? 's' : ''}`
        };
    }
    if (state === 'pending-approval') {
        return { action: 'Get bookmark tree', description: 'Waiting for approval' };
    }
    return { action: 'Failed to load bookmark tree' };
};

export const organizeBookmarksFormatter: ActionFormatter = ({ state, output }) => {
    const suggestions = output?.suggestions as { newFolders?: unknown[] } | undefined;
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
    if (state === 'pending-approval') {
        return { action: 'Organize bookmarks', description: 'Waiting for approval' };
    }
    return { action: 'Failed to analyze bookmarks' };
};
