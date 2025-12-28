/**
 * History tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText, extractDomain } from '../helpers';

export const getHistoryFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = input?.query as string | undefined;

    if (state === 'loading') {
        return {
            action: 'Searching history',
            description: query ? truncateText(query, 30) : undefined
        };
    }
    if (state === 'success') {
        const results = output?.results as unknown[] | undefined;
        const count = results?.length || (output?.count as number) || 0;
        return {
            action: 'Found history items',
            description: `${count} results`
        };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Search history',
            description: query ? truncateText(query, 30) : 'Waiting for approval'
        };
    }
    return { action: 'History search failed' };
};

export const getRecentHistoryFormatter: ActionFormatter = ({ state, input, output }) => {
    const hours = (input?.hours as number) || 24;

    if (state === 'loading') {
        return {
            action: 'Getting recent history',
            description: `Last ${hours} hours`
        };
    }
    if (state === 'success') {
        const results = output?.results as unknown[] | undefined;
        const count = (output?.found as number) || results?.length || 0;
        const outputHours = (output?.hours as number) || hours;
        return {
            action: 'Recent history retrieved',
            description: `${count} pages in ${outputHours}h`
        };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Get recent history',
            description: `Last ${hours} hours`
        };
    }
    return { action: 'Failed to get history' };
};

export const getUrlVisitsFormatter: ActionFormatter = ({ state, input, output }) => {
    const url = input?.url as string | undefined;
    const domain = url ? extractDomain(url) : '';

    if (state === 'loading') {
        return {
            action: 'Getting visit details',
            description: domain ? truncateText(domain, 40) : undefined
        };
    }
    if (state === 'success') {
        const visits = output?.visits as unknown[] | undefined;
        const count = (output?.visitCount as number) || visits?.length || 0;
        return {
            action: 'Visit details retrieved',
            description: `${count} visits`
        };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Get URL visits',
            description: domain ? truncateText(domain, 40) : 'Waiting for approval'
        };
    }
    return { action: 'Failed to get visits' };
};
