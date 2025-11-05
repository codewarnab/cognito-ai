/**
 * Tab management tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText, extractDomain } from '../helpers';

export const switchTabsFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = output?.title || input?.title;

    if (state === 'loading') {
        return { action: 'Switching tab' };
    }
    if (state === 'success') {
        return {
            action: 'Switched tab',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Tab switch failed' };
};

export const getActiveTabFormatter: ActionFormatter = ({ state, output }) => {
    const title = output?.title;

    if (state === 'loading') {
        return { action: 'Getting active tab' };
    }
    if (state === 'success') {
        return {
            action: 'Active tab',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Failed to get tab' };
};

export const getAllTabsFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return { action: 'Getting all tabs' };
    }
    if (state === 'success') {
        const count = output?.count || output?.tabs?.length || 0;
        return {
            action: 'Retrieved all tabs',
            description: `${count} tab${count !== 1 ? 's' : ''}`
        };
    }
    return { action: 'Failed to get tabs' };
};

export const openNewTabFormatter: ActionFormatter = ({ state, input, output }) => {
    const url = input?.url;
    const title = output?.title;
    const domain = url ? extractDomain(url) : '';

    if (state === 'loading') {
        return {
            action: 'Opening new tab',
            description: domain ? truncateText(domain, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'New tab opened',
            description: title ? truncateText(title, 40) : domain ? truncateText(domain, 40) : undefined
        };
    }
    return { action: 'Failed to open tab' };
};

export const closeTabFormatter: ActionFormatter = ({ state, input }) => {
    const title = input?.title;

    if (state === 'loading') {
        return { action: 'Closing tab' };
    }
    if (state === 'success') {
        return {
            action: 'Tab closed',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Failed to close tab' };
};

export const listTabsFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return { action: 'Listing tabs' };
    }
    if (state === 'success') {
        const count = output?.tabs?.length || output?.count || 0;
        return {
            action: 'Found tabs',
            description: `${count} open tabs`
        };
    }
    return { action: 'Failed to list tabs' };
};

export const organizeTabsByContextFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        return { action: 'Organizing tabs' };
    }
    if (state === 'success') {
        if (output?.needsAIAnalysis) {
            const tabCount = output?.tabs?.length || 0;
            return {
                action: 'Prepared for analysis',
                description: `${tabCount} tabs`
            };
        }
        if (output?.groups) {
            const groupCount = output?.groups?.length || 0;
            return {
                action: 'Tabs organized',
                description: `${groupCount} groups`
            };

        }
        if (output?.error) {
            return { action: 'Organization failed' };
        }
        return { action: 'Tabs organized' };
    }
    return { action: 'Failed to organize tabs' };
};

export const applyTabGroupsFormatter: ActionFormatter = ({ state, input, output }) => {
    const groupCount = input?.groups?.length || 0;
    const groupsCreated = output?.groupsCreated || output?.groups?.length || 0;

    if (state === 'loading') {
        return {
            action: 'Applying tab groups',
            description: groupCount > 0 ? `${groupCount} groups` : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Tab groups applied',
            description: groupsCreated > 0 ? `${groupsCreated} groups created` : undefined
        };
    }
    return { action: 'Failed to apply groups' };
};

export const ungroupTabsFormatter: ActionFormatter = ({ state, input, output }) => {
    const groupCount = input?.groupIds?.length || 0;
    const ungrouped = output?.ungroupedCount || 0;

    if (state === 'loading') {
        if (input?.ungroupAll) {
            return { action: 'Ungrouping all tabs' };
        }
        return {
            action: 'Ungrouping tabs',
            description: groupCount > 0 ? `${groupCount} group(s)` : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Tabs ungrouped',
            description: ungrouped > 0 ? `${ungrouped} group(s)` : undefined
        };
    }
    return { action: 'Failed to ungroup tabs' };
};
