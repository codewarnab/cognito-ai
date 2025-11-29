/**
 * Search tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const getSearchResultsFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return { action: 'Reading search results' };
    }
    if (state === 'success') {
        const count = output?.results?.length || output?.count || 0;
        const engine = output?.engine || 'search';
        return {
            action: `Found ${count} results`,
            description: engine
        };
    }
    return { action: 'Search failed' };
};

export const chromeSearchFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = input?.query || output?.query;

    if (state === 'loading') {
        return {
            action: 'Searching Chrome',
            description: query ? `"${truncateText(query, 40)}"` : undefined
        };
    }
    if (state === 'success') {
        const totalCount = output?.totalCount || output?.results?.length || 0;
        const tabs = output?.results?.filter((r: any) => r.type === 'tab').length || 0;
        const bookmarks = output?.results?.filter((r: any) => r.type === 'bookmark').length || 0;
        const history = output?.results?.filter((r: any) => r.type === 'history').length || 0;

        // Build description showing breakdown
        const parts = [];
        if (tabs > 0) parts.push(`${tabs} tab${tabs > 1 ? 's' : ''}`);
        if (bookmarks > 0) parts.push(`${bookmarks} bookmark${bookmarks > 1 ? 's' : ''}`);
        if (history > 0) parts.push(`${history} history`);

        const description = parts.length > 0 ? parts.join(', ') : `${totalCount} results`;

        return {
            action: `Found ${totalCount} results`,
            description: query ? `"${truncateText(query, 30)}": ${description}` : description
        };
    }
    return {
        action: 'Search failed',
        description: query ? `"${truncateText(query, 40)}"` : undefined
    };
};

export const openSearchResultFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = output?.title || input?.title;
    const rank = output?.rank || input?.rank || input?.index;

    if (state === 'loading') {
        return {
            action: 'Opening search result',
            description: rank !== undefined ? `Result #${rank}` : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Opened search result',
            description: title ? truncateText(title, 40) : rank !== undefined ? `Result #${rank}` : undefined
        };
    }
    return { action: 'Failed to open result' };
};

export const webSearchFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = input?.query || output?.query;

    if (state === 'loading') {
        return {
            action: 'Searching web',
            description: query ? `"${truncateText(query, 40)}"` : undefined
        };
    }
    if (state === 'success') {
        const count = output?.results?.length || output?.number_of_results || 0;
        return {
            action: `Found ${count} results`,
            description: query ? `"${truncateText(query, 40)}"` : undefined
        };
    }
    return {
        action: 'Web search failed',
        description: query ? `"${truncateText(query, 40)}"` : undefined
    };
};

export const retrieveFormatter: ActionFormatter = ({ state, input, output }) => {
    const url = input?.url || output?.url;

    if (state === 'loading') {
        return {
            action: 'Retrieving content',
            description: url ? truncateText(url, 40) : undefined
        };
    }
    if (state === 'success') {
        const title = output?.results?.[0]?.title;
        return {
            action: 'Retrieved content',
            description: title ? truncateText(title, 40) : (url ? truncateText(url, 40) : undefined)
        };
    }
    return {
        action: 'Retrieve failed',
        description: url ? truncateText(url, 40) : undefined
    };
};

export const deepWebSearchFormatter: ActionFormatter = ({ state, input, output }) => {
    const queries = input?.queries || output?.executed_queries;

    if (state === 'loading') {
        return {
            action: 'Deep searching',
            description: queries ? `${queries.length} queries` : undefined
        };
    }
    if (state === 'success') {
        const uniqueCount = output?.unique_results || 0;
        const queryCount = output?.executed_queries?.length || 0;
        return {
            action: `Found ${uniqueCount} unique results`,
            description: `${queryCount} queries executed`
        };
    }
    return {
        action: 'Deep search failed',
        description: queries ? `${queries.length} queries` : undefined
    };
};
