/**
 * Memory and reminder tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText, humanizeKey } from '../helpers';

export const saveMemoryFormatter: ActionFormatter = ({ state, input }) => {
    const key = input?.key || input?.name;

    if (state === 'loading') {
        return {
            action: 'Saving memory',
            description: key ? humanizeKey(key) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Memory saved',
            description: key ? humanizeKey(key) : undefined
        };
    }
    return { action: 'Failed to save memory' };
};

export const getMemoryFormatter: ActionFormatter = ({ state, input, output }) => {
    const key = input?.key || input?.name;
    const found = output?.value !== undefined || output?.found;

    if (state === 'loading') {
        return {
            action: 'Retrieving memory',
            description: key ? humanizeKey(key) : undefined
        };
    }
    if (state === 'success') {
        if (found) {
            return {
                action: 'Memory retrieved',
                description: key ? humanizeKey(key) : undefined
            };
        }
        return {
            action: 'Memory not found',
            description: key ? humanizeKey(key) : undefined
        };
    }
    return { action: 'Failed to retrieve memory' };
};

export const deleteMemoryFormatter: ActionFormatter = ({ state, input }) => {
    const key = input?.key || input?.name;

    if (state === 'loading') {
        return {
            action: 'Deleting memory',
            description: key ? humanizeKey(key) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Memory deleted',
            description: key ? humanizeKey(key) : undefined
        };
    }
    return { action: 'Failed to delete memory' };
};

export const listMemoriesFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return { action: 'Listing memories' };
    }
    if (state === 'success') {
        const count = output?.memories?.length || output?.count || 0;
        return {
            action: 'Found memories',
            description: `${count} items`
        };
    }
    return { action: 'Failed to list memories' };
};

export const cancelReminderFormatter: ActionFormatter = ({ state, input, output }) => {
    const identifier = input?.identifier;
    const title = output?.title || identifier;

    if (state === 'loading') {
        return {
            action: 'Cancelling reminder',
            description: identifier ? truncateText(identifier, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Reminder cancelled',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return {
        action: 'Failed to cancel reminder',
        description: identifier ? truncateText(identifier, 40) : undefined
    };
};
