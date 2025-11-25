/**
 * YouTube tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const getYoutubeTranscriptFormatter: ActionFormatter = ({ state, input, output }) => {
    const videoTitle = output?.title || output?.videoTitle;
    const url = input?.youtubeUrl;

    if (state === 'loading') {
        return {
            action: 'Fetching transcript',
            description: videoTitle ? truncateText(videoTitle, 40) : url ? truncateText(url, 40) : undefined
        };
    }
    if (state === 'success') {
        // Check if actually successful (YouTube tool returns error on failure)
        if (output?.error) {
            return {
                action: 'Transcript unavailable',
                description: output.error ? truncateText(output.error, 40) : undefined
            };
        }

        // Handle new tool output format (hasTranscript, transcriptLength, durationFormatted)
        if (output?.hasTranscript !== undefined) {
            if (!output.hasTranscript) {
                return {
                    action: 'No transcript available',
                    description: videoTitle
                        ? truncateText(videoTitle, 40)
                        : output.durationFormatted
                            ? `Duration: ${output.durationFormatted}`
                            : 'Video metadata retrieved'
                };
            }

            const charCount = output.transcriptLength || 0;
            const durationStr = output.durationFormatted || '';

            return {
                action: 'Transcript fetched',
                description: videoTitle
                    ? `${truncateText(videoTitle, 30)}${durationStr ? ' • ' + durationStr : ''}`
                    : `${Math.round(charCount / 1000)}k chars${durationStr ? ' • ' + durationStr : ''}`
            };
        }

        // Legacy format (transcript array with segments)
        const segmentCount = output?.transcript?.length || 0;
        const duration = output?.transcript?.[output.transcript.length - 1]?.timestamp || 0;
        const minutes = Math.floor(duration / 60);
        const durationStr = duration > 0 ? `${minutes}m ${Math.floor(duration % 60)}s` : '';

        return {
            action: 'Transcript retrieved',
            description: videoTitle
                ? `${truncateText(videoTitle, 30)} (${segmentCount} segments${durationStr ? ', ' + durationStr : ''})`
                : `${segmentCount} segments${durationStr ? ', ' + durationStr : ''}`
        };
    }
    return {
        action: 'Transcript failed',
        description: videoTitle ? truncateText(videoTitle, 40) : undefined
    };
};
