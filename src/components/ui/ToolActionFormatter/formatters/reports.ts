/**
 * Report generation tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const getReportTemplateFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = input?.query;
    const templateType = output?.templateType;
    const templateName = output?.templateName;
    const sectionCount = output?.sectionCount || 0;

    if (state === 'loading') {
        return {
            action: 'Analyzing research topic',
            description: query ? truncateText(query, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Template selected',
            description: templateName
                ? `${truncateText(templateName, 35)} (${sectionCount} sections)`
                : templateType
                    ? `${templateType} (${sectionCount} sections)`
                    : undefined
        };
    }
    return {
        action: 'Template selection failed',
        description: query ? truncateText(query, 40) : undefined
    };
};

export const generatePDFFormatter: ActionFormatter = ({ state, input, output }) => {
    const filename = output?.filename || input?.filename;
    const size = output?.size;
    const formattedSize = size ? `${Math.round(size / 1024)}KB` : '';

    if (state === 'loading') {
        return {
            action: 'Generating PDF',
            description: filename ? truncateText(filename, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'PDF Downloaded',
            description: filename ? `${truncateText(filename, 30)}${formattedSize ? ` (${formattedSize})` : ''}` : undefined
        };
    }
    return {
        action: 'PDF generation failed',
        description: filename ? truncateText(filename, 40) : undefined
    };
};

export const generateMarkdownFormatter: ActionFormatter = ({ state, input, output }) => {
    const filename = output?.filename || input?.filename;
    const size = output?.size;
    const formattedSize = size ? `${Math.round(size / 1024)}KB` : '';

    if (state === 'loading') {
        return {
            action: 'Generating Markdown',
            description: filename ? truncateText(filename, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Markdown Downloaded',
            description: filename ? `${truncateText(filename, 30)}${formattedSize ? ` (${formattedSize})` : ''}` : undefined
        };
    }
    return {
        action: 'Markdown generation failed',
        description: filename ? truncateText(filename, 40) : undefined
    };
};
