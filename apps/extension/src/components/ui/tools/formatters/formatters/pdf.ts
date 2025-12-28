/**
 * PDF tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const pdfAgentFormatter: ActionFormatter = ({ state, input, output }) => {
    const question = input?.question as string | undefined;
    const pageCount = output?.pageCount as number | undefined;
    const title = output?.title as string | undefined;
    const pdfFile = input?.pdfFile || output?.pdfFile;
    const errorMsg = (output?.error || output?.errorType) as string | undefined;

    // Check if it's a file upload (local file)
    const isFileUpload = !!pdfFile || (pdfFile instanceof File);

    if (state === 'loading') {
        // Show different loading message for file uploads
        if (isFileUpload) {
            return {
                action: 'Uploading & analyzing PDF',
                description: question ? truncateText(question, 40) : undefined,
                customIcon: 'upload' // This will trigger the UploadIcon
            };
        }

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
        if (isFileUpload) parts.push('📤');

        return {
            action: 'PDF analyzed',
            description: parts.length > 0 ? parts.join(' • ') : 'Analysis complete'
        };
    }

    if (state === 'pending-approval') {
        return {
            action: 'Analyze PDF',
            description: question ? truncateText(question, 40) : 'Waiting for approval'
        };
    }

    return {
        action: 'Analysis failed',
        description: errorMsg ? truncateText(String(errorMsg), 50) : undefined
    };
};
