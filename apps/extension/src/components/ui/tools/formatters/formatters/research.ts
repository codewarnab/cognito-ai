/**
 * Research memory tool formatters
 * For context-optimized research workflow memory management
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const addMemoryMetadataFormatter: ActionFormatter = ({ state, input }) => {
    const sourceId = input?.sourceId as string | undefined;
    const guideline = input?.futureUseGuideline as string | undefined;

    if (state === 'loading') {
        return {
            action: 'Tagging source',
            description: sourceId
        };
    }
    if (state === 'success') {
        return {
            action: 'Source tagged',
            description: sourceId
                ? `${sourceId}${guideline ? ` • ${truncateText(guideline, 30)}` : ''}`
                : undefined
        };
    }
    return { action: 'Failed to tag source' };
};

export const readResearchMemoryFormatter: ActionFormatter = ({ state, input, output }) => {
    const sourceId = input?.sourceId as string | undefined;
    const found = output?.found;
    const content = output?.content as string | undefined;
    const contentLength = content?.length || 0;
    const formattedLength = contentLength >= 1000
        ? `${Math.round(contentLength / 1000)}k chars`
        : `${contentLength} chars`;

    if (state === 'loading') {
        return {
            action: 'Loading source',
            description: sourceId
        };
    }
    if (state === 'success') {
        if (found) {
            return {
                action: 'Source loaded',
                description: sourceId ? `${sourceId} (${formattedLength})` : formattedLength
            };
        }
        return {
            action: 'Source not found',
            description: sourceId ? `${sourceId} expired or missing` : undefined
        };
    }
    return { action: 'Failed to load source' };
};

export const listResearchSourcesFormatter: ActionFormatter = ({ state, output }) => {
    const sources = output?.sources as unknown[] | undefined;
    const count = (output?.count as number) || sources?.length || 0;

    if (state === 'loading') {
        return {
            action: 'Listing sources',
            description: 'Research session'
        };
    }
    if (state === 'success') {
        return {
            action: 'Sources listed',
            description: `${count} source${count !== 1 ? 's' : ''} available`
        };
    }
    return { action: 'Failed to list sources' };
};

export const initResearchSessionFormatter: ActionFormatter = ({ state, output }) => {
    const sessionId = output?.sessionId as string | undefined;

    if (state === 'loading') {
        return {
            action: 'Starting session',
            description: 'Research memory'
        };
    }
    if (state === 'success') {
        return {
            action: 'Session started',
            description: sessionId ? truncateText(sessionId, 24) : undefined
        };
    }
    return { action: 'Failed to start session' };
};

export const appendToReportFormatter: ActionFormatter = ({ state, input, output }) => {
    const sectionName = input?.sectionName as string | undefined;
    const order = output?.order as number | undefined;
    const totalSections = output?.totalSectionsInReport as number | undefined;

    if (state === 'loading') {
        return {
            action: 'Adding section',
            description: sectionName ? truncateText(sectionName, 30) : 'Building report...'
        };
    }
    if (state === 'success') {
        if (output?.success) {
            const parts: string[] = [];
            if (sectionName) parts.push(truncateText(sectionName, 25));
            if (order && totalSections) parts.push(`(${order}/${totalSections})`);
            return {
                action: 'Section added',
                description: parts.length > 0 ? parts.join(' ') : undefined
            };
        }
        const errorMsg = output?.error as string | undefined;
        return {
            action: 'Failed to add section',
            description: errorMsg ? truncateText(errorMsg, 40) : undefined
        };
    }
    return { action: 'Failed to add section' };
};
