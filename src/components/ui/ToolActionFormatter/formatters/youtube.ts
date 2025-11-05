/**
 * YouTube tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const getYoutubeTranscriptFormatter: ActionFormatter = ({ state, input, output }) => {
    const videoTitle = output?.videoTitle;
    const lang = input?.lang;

    if (state === 'loading') {
        return {
            action: 'Fetching transcript',
            description: videoTitle ? truncateText(videoTitle, 40) : undefined
        };
    }
    if (state === 'success') {
        // Check if actually successful (YouTube tool returns success:false on error)
        if (output?.success === false || output?.error) {
            return {
                action: 'Transcript unavailable',
                description: videoTitle ? truncateText(videoTitle, 40) : output?.error ? truncateText(output.error, 40) : undefined
            };
        }
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

export const youtubeAgentFormatter: ActionFormatter = ({ state, input, output }) => {
    const question = input?.question;
    const wasChunked = output?.wasChunked;
    const usedTranscript = output?.usedTranscript;
    const errorMsg = output?.error || output?.errorType;

    if (state === 'loading') {
        return {
            action: 'Analyzing YouTube video',
            description: question ? truncateText(question, 40) : undefined
        };
    }
    if (state === 'success') {
        // Check if actually failed (YouTube tool may return success: false)
        if (output?.success === false || errorMsg) {
            return {
                action: 'Analysis failed',
                description: errorMsg ? truncateText(String(errorMsg), 50) : question ? truncateText(question, 40) : undefined
            };
        }

        const answerLength = output?.answer?.length || 0;
        const duration = output?.videoDuration;
        const durationText = duration
            ? duration >= 3600
                ? `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
                : duration >= 60
                    ? `${Math.floor(duration / 60)}m`
                    : `${duration}s`
            : '';

        // Build description showing analysis method
        const parts = [];
        if (usedTranscript) {
            parts.push('transcript');
        } else if (wasChunked) {
            parts.push('chunked');
        }
        if (durationText) {
            parts.push(durationText);
        }

        return {
            action: 'Video analyzed',
            description: parts.length > 0 ? parts.join(' • ') : 'Analysis complete'
        };
    }
    return {
        action: 'Analysis failed',
        description: errorMsg ? truncateText(String(errorMsg), 50) : question ? truncateText(question, 40) : undefined
    };
};
