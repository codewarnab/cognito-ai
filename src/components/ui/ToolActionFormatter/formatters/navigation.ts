/**
 * Navigation tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText, extractDomain } from '../helpers';

export const navigateToFormatter: ActionFormatter = ({ state, input, output }) => {
    const url = output?.url || input?.url || input?.targetUrl;
    const domain = url ? extractDomain(url) : '';
    const newTab = input?.newTab || output?.newTab;

    if (state === 'loading') {
        return {
            action: 'Navigating',
            description: domain ? truncateText(domain, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: newTab ? 'Opened in new tab' : 'Navigated',
            description: domain ? truncateText(domain, 40) : undefined
        };
    }
    return {
        action: 'Navigation failed',
        description: domain ? truncateText(domain, 40) : undefined
    };
};
