/**
 * PDF tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const pdfAgentFormatter: ActionFormatter = ({ state, input, output }) => {
    const question = input?.question;
    const pageCount = output?.pageCount;
    const title = output?.title;
    const errorMsg = output?.error || output?.errorType;

    if (state === 'loading') {
        return {
            action: 'Analyzing PDF document',
            description: question ? truncateText(question, 40) : undefined
        };
    }

    if (state === 'success') {
        // Check if actually failed (PDF tool may return success: false)
        if (output?.success === false || errorMsg) {
            return {
                action: 'Analysis failed',
                description: errorMsg ? truncateText(String(errorMsg), 50) : undefined
            };
        }

        const parts = [];
        if (title) parts.push(truncateText(title, 30));
        if (pageCount) parts.push(`${pageCount} pages`);

        return {
            action: 'PDF analyzed',
            description: parts.length > 0 ? parts.join(' • ') : 'Analysis complete'
        };
    }

    return {
        action: 'Analysis failed',
        description: errorMsg ? truncateText(String(errorMsg), 50) : undefined
    };
};
