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
        const results = output?.results as unknown[] | undefined;
        const count = results?.length || (output?.count as number) || 0;
        const engine = (output?.engine as string) || 'search';
        return {
            action: `Found ${count} results`,
            description: engine
        };
    }
    if (state === 'pending-approval') {
        return { action: 'Get search results', description: 'Waiting for approval' };
    }
    return { action: 'Search failed' };
};

export const chromeSearchFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = (input?.query || output?.query) as string | undefined;

    if (state === 'loading') {
        return {
            action: 'Searching Chrome',
            description: query ? `"${truncateText(query, 40)}"` : undefined
        };
    }
    if (state === 'success') {
        const results = output?.results as Array<{ type: string }> | undefined;
        const totalCount = (output?.totalCount as number) || results?.length || 0;
        const tabs = results?.filter((r) => r.type === 'tab').length || 0;
        const bookmarks = results?.filter((r) => r.type === 'bookmark').length || 0;
        const history = results?.filter((r) => r.type === 'history').length || 0;

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
    if (state === 'pending-approval') {
        return {
            action: 'Search Chrome',
            description: query ? `"${truncateText(query, 40)}"` : 'Waiting for approval'
        };
    }
    return {
        action: 'Search failed',
        description: query ? `"${truncateText(query, 40)}"` : undefined
    };
};

export const openSearchResultFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = (output?.title || input?.title) as string | undefined;
    const rank = (output?.rank || input?.rank || input?.index) as number | undefined;

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
    if (state === 'pending-approval') {
        return {
            action: 'Open search result',
            description: rank !== undefined ? `Result #${rank}` : 'Waiting for approval'
        };
    }
    return { action: 'Failed to open result' };
};

export const webSearchFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = (input?.query || output?.query) as string | undefined;

    if (state === 'loading') {
        return {
            action: 'Searching web',
            description: query ? `"${truncateText(query, 40)}"` : undefined
        };
    }
    if (state === 'success') {
        const results = output?.results as unknown[] | undefined;
        const count = results?.length || (output?.number_of_results as number) || 0;
        return {
            action: `Found ${count} results`,
            description: query ? `"${truncateText(query, 40)}"` : undefined
        };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Web search',
            description: query ? `"${truncateText(query, 40)}"` : 'Waiting for approval'
        };
    }
    return {
        action: 'Web search failed',
        description: query ? `"${truncateText(query, 40)}"` : undefined
    };
};

export const retrieveFormatter: ActionFormatter = ({ state, input, output }) => {
    const url = (input?.url || output?.url) as string | undefined;

    if (state === 'loading') {
        return {
            action: 'Retrieving content',
            description: url ? truncateText(url, 40) : undefined
        };
    }
    if (state === 'success') {
        const results = output?.results as Array<{ title?: string }> | undefined;
        const title = results?.[0]?.title as string | undefined;
        return {
            action: 'Retrieved content',
            description: title ? truncateText(title, 40) : (url ? truncateText(url, 40) : undefined)
        };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Retrieve content',
            description: url ? truncateText(url, 40) : 'Waiting for approval'
        };
    }
    return {
        action: 'Retrieve failed',
        description: url ? truncateText(url, 40) : undefined
    };
};

export const deepWebSearchFormatter: ActionFormatter = ({ state, input, output }) => {
    const queries = (input?.queries || output?.executed_queries) as unknown[] | undefined;

    if (state === 'loading') {
        return {
            action: 'Deep searching',
            description: queries ? `${queries.length} queries` : undefined
        };
    }
    if (state === 'success') {
        const uniqueCount = (output?.unique_results as number) || 0;
        const executedQueries = output?.executed_queries as unknown[] | undefined;
        const queryCount = executedQueries?.length || 0;
        return {
            action: `Found ${uniqueCount} unique results`,
            description: `${queryCount} queries executed`
        };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Deep web search',
            description: queries ? `${queries.length} queries` : 'Waiting for approval'
        };
    }
    return {
        action: 'Deep search failed',
        description: queries ? `${queries.length} queries` : undefined
    };
};
