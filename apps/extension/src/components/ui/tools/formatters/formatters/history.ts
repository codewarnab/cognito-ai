/**
 * History tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText, extractDomain } from '../helpers';

export const getHistoryFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = input?.query;

    if (state === 'loading') {
        return {
            action: 'Searching history',
            description: query ? truncateText(query, 30) : undefined
        };
    }
    if (state === 'success') {
        const count = output?.results?.length || output?.count || 0;
        return {
            action: 'Found history items',
            description: `${count} results`
        };
    }
    return { action: 'History search failed' };
};

export const getRecentHistoryFormatter: ActionFormatter = ({ state, input, output }) => {
    const hours = input?.hours || 24;

    if (state === 'loading') {
        return {
            action: 'Getting recent history',
            description: `Last ${hours} hours`
        };
    }
    if (state === 'success') {
        const count = output?.found || output?.results?.length || 0;
        return {
            action: 'Recent history retrieved',
            description: `${count} pages in ${output?.hours || hours}h`
        };
    }
    return { action: 'Failed to get history' };
};

export const getUrlVisitsFormatter: ActionFormatter = ({ state, input, output }) => {
    const url = input?.url;
    const domain = url ? extractDomain(url) : '';

    if (state === 'loading') {
        return {
            action: 'Getting visit details',
            description: domain ? truncateText(domain, 40) : undefined
        };
    }
    if (state === 'success') {
        const count = output?.visitCount || output?.visits?.length || 0;
        return {
            action: 'Visit details retrieved',
            description: `${count} visits`
        };
    }
    return { action: 'Failed to get visits' };
};
