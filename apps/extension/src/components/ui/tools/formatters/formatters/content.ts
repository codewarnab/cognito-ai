/**
 * Content extraction tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const readPageContentFormatter: ActionFormatter = ({ state, output }) => {
    const title = output?.title as string | undefined;
    const content = output?.content as string | undefined;
    const contentLength = content?.length || (output?.contentLength as number) || 0;
    const formattedLength = contentLength >= 1000 ? `${Math.round(contentLength / 1000)}k chars` : `${contentLength} chars`;

    if (state === 'loading') {
        return {
            action: 'Reading page content',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Read page content',
            description: title ? `${truncateText(title, 30)} (${formattedLength})` : formattedLength
        };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Read page content',
            description: 'Waiting for approval'
        };
    }
    return { action: 'Failed to read content' };
};

export const getSelectedTextFormatter: ActionFormatter = ({ state, output }) => {
    const text = (output?.text || output?.selectedText) as string | undefined;
    const length = text?.length || 0;

    if (state === 'loading') {
        return { action: 'Getting selected text' };
    }
    if (state === 'success') {
        if (length > 0) {
            return {
                action: 'Got selected text',
                description: `${length} characters`
            };
        }
        return { action: 'No text selected' };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Get selected text',
            description: 'Waiting for approval'
        };
    }
    return { action: 'Failed to get selection' };
};

export const extractTextFormatter: ActionFormatter = ({ state, input, output }) => {
    const selector = input?.selector as string | undefined;
    const text = output?.text as string | undefined;
    const charCount = text?.length || 0;
    const structure = output?.structure as { pageType?: string; headings?: Record<string, unknown[]> } | undefined;
    const pageType = structure?.pageType;
    const count = output?.count as number | undefined;
    const searchBars = output?.searchBars as Array<{ isVisible?: boolean }> | undefined;
    // primarySearchBar is available but not currently used
    // const primarySearchBar = output?.primarySearchBar;

    if (state === 'loading') {
        return {
            action: 'Extracting text',
            description: selector ? truncateText(selector, 40) : 'entire page'
        };
    }
    if (state === 'success') {
        // Build description with structure info
        let parts: string[] = [];

        if (charCount > 0) {
            parts.push(`${charCount} chars`);
        }

        if (count) {
            parts.push(`${count} elements`);
        }

        // Prioritize search bar info if detected
        if (searchBars && searchBars.length > 0) {
            const visibleCount = searchBars.filter((sb: any) => sb.isVisible).length;
            parts.push(`${searchBars.length} search bar${searchBars.length > 1 ? 's' : ''}${visibleCount < searchBars.length ? ` (${visibleCount} visible)` : ''}`);
        }

        if (pageType && pageType !== 'unknown') {
            parts.push(`${pageType} page`);
        }

        if (structure?.headings) {
            const headingCount = (structure.headings.h1?.length || 0) +
                (structure.headings.h2?.length || 0) +
                (structure.headings.h3?.length || 0);
            if (headingCount > 0) {
                parts.push(`${headingCount} headings`);
            }
        }

        return {
            action: 'Text extracted',
            description: parts.join(' • ') || undefined
        };
    }
    return {
        action: 'Extraction failed',
        description: selector ? truncateText(selector, 40) : undefined
    };
};

export const scrollIntoViewFormatter: ActionFormatter = ({ state, input }) => {
    const selector = input?.selector as string | undefined;
    const block = input?.block as string | undefined;

    if (state === 'loading') {
        return {
            action: 'Scrolling to element',
            description: selector ? truncateText(selector, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Scrolled to element',
            description: selector ? `${truncateText(selector, 30)}${block ? ` (${block})` : ''}` : undefined
        };
    }
    return {
        action: 'Scroll failed',
        description: selector ? truncateText(selector, 40) : undefined
    };
};

export const findSearchBarFormatter: ActionFormatter = ({ state, output }) => {
    const count = (output?.count as number) || 0;
    const primarySearchBar = output?.primarySearchBar as {
        placeholder?: string;
        id?: string;
        name?: string;
    } | undefined;

    if (state === 'loading') {
        return {
            action: 'Finding search bars',
            description: undefined
        };
    }
    if (state === 'success') {
        let description = `${count} search bar${count !== 1 ? 's' : ''}`;

        // Add info about the primary search bar
        if (primarySearchBar) {
            const details: string[] = [];
            if (primarySearchBar.placeholder) {
                details.push(`"${truncateText(primarySearchBar.placeholder, 20)}"`);
            }
            if (primarySearchBar.id) {
                details.push(`#${primarySearchBar.id}`);
            } else if (primarySearchBar.name) {
                details.push(`name="${primarySearchBar.name}"`);
            }

            if (details.length > 0) {
                description += ` • ${details.join(', ')}`;
            }
        }

        return {
            action: 'Search bars found',
            description
        };
    }
    return {
        action: 'No search bars found',
        description: undefined
    };
};
