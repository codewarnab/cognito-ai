/**
 * YouTube tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const getYoutubeTranscriptFormatter: ActionFormatter = ({ state, input, output }) => {
    const videoTitle = (output?.title || output?.videoTitle) as string | undefined;
    const url = input?.youtubeUrl as string | undefined;

    if (state === 'loading') {
        return {
            action: 'Fetching transcript',
            description: videoTitle ? truncateText(videoTitle, 40) : url ? truncateText(url, 40) : undefined
        };
    }
    if (state === 'success') {
        // Check if actually successful (YouTube tool returns error on failure)
        const errorMsg = output?.error as string | undefined;
        if (errorMsg) {
            return {
                action: 'Transcript unavailable',
                description: truncateText(errorMsg, 40)
            };
        }

        // Handle new tool output format (hasTranscript, transcriptLength, durationFormatted)
        if (output?.hasTranscript !== undefined) {
            if (!output.hasTranscript) {
                const durationFormatted = output.durationFormatted as string | undefined;
                return {
                    action: 'No transcript available',
                    description: videoTitle
                        ? truncateText(videoTitle, 40)
                        : durationFormatted
                            ? `Duration: ${durationFormatted}`
                            : 'Video metadata retrieved'
                };
            }

            const charCount = (output.transcriptLength as number) || 0;
            const durationStr = (output.durationFormatted as string) || '';

            return {
                action: 'Transcript fetched',
                description: videoTitle
                    ? `${truncateText(videoTitle, 30)}${durationStr ? ' • ' + durationStr : ''}`
                    : `${Math.round(charCount / 1000)}k chars${durationStr ? ' • ' + durationStr : ''}`
            };
        }

        // Legacy format (transcript array with segments)
        const transcript = output?.transcript as Array<{ timestamp?: number }> | undefined;
        const segmentCount = transcript?.length || 0;
        const lastSegment = transcript?.[transcript.length - 1];
        const duration = (lastSegment?.timestamp as number) || 0;
        const minutes = Math.floor(duration / 60);
        const durationStr = duration > 0 ? `${minutes}m ${Math.floor(duration % 60)}s` : '';

        return {
            action: 'Transcript retrieved',
            description: videoTitle
                ? `${truncateText(videoTitle, 30)} (${segmentCount} segments${durationStr ? ', ' + durationStr : ''})`
                : `${segmentCount} segments${durationStr ? ', ' + durationStr : ''}`
        };
    }
    if (state === 'pending-approval') {
        return {
            action: 'Get YouTube transcript',
            description: videoTitle ? truncateText(videoTitle, 40) : url ? truncateText(url, 40) : 'Waiting for approval'
        };
    }
    return {
        action: 'Transcript failed',
        description: videoTitle ? truncateText(videoTitle, 40) : undefined
    };
};
