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
