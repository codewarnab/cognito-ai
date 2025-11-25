/**
 * YouTube Transcript Fetching Tool
 *
 * This tool fetches YouTube video transcripts and metadata for the main agent.
 * Unlike the old agent-based approach, this returns raw data for the main agent
 * to process, eliminating unnecessary sub-agent overhead.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { createLogger } from '~logger';
import { parseError } from '../../../errors';
import { fetchTranscript } from './utils/transcript';
import {
    getVideoDuration,
    getVideoDescription,
    extractVideoId,
} from './utils/videoMetadata';
import { formatDuration } from './utils/formatting';

const log = createLogger('YouTube-Transcript-Tool');

/**
 * Extract video title from the active tab using scripting API
 * Used as fallback when transcript API returns "Unknown" title
 * 
 * @returns The video title or undefined if extraction fails
 */
async function extractVideoTitleFromTab(): Promise<string | undefined> {
    try {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tab?.id || !tab?.url?.includes('youtube.com/watch')) {
            log.debug('Active tab is not a YouTube video page');
            return undefined;
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // Try multiple selectors for video title
                const titleElement =
                    document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                    document.querySelector('h1.title yt-formatted-string') ||
                    document.querySelector('meta[name="title"]');

                if (titleElement) {
                    return titleElement.textContent?.trim() ||
                        (titleElement as HTMLMetaElement).content?.trim() ||
                        undefined;
                }

                // Fallback to document title
                const docTitle = document.title;
                if (docTitle && docTitle !== 'YouTube') {
                    return docTitle.replace(' - YouTube', '').trim() || undefined;
                }

                return undefined;
            }
        });

        const title = results[0]?.result;
        if (title) {
            log.info('📝 Extracted video title from active tab', { title });
        }
        return title;
    } catch (error) {
        log.warn('Failed to extract video title from tab', error);
        return undefined;
    }
}

/**
 * Output schema for the YouTube transcript tool
 */
export interface YouTubeTranscriptResult {
    videoId: string;
    url: string;
    title?: string;
    duration?: number;
    durationFormatted?: string;
    transcript?: string;
    transcriptLength?: number;
    description?: string;
    descriptionLength?: number;
    hasTranscript: boolean;
    error?: string;
}

/**
 * YouTube Transcript Tool for Main Agent
 * Fetches transcript and metadata, returns to main agent for processing
 */
export const getYouTubeTranscript = tool({
    description: `Fetch YouTube video transcript and metadata.

Use this tool to get the transcript of a YouTube video so you can answer
questions about the video content directly.

The tool will:
- Fetch the video transcript (if available)
- Get video metadata (title, duration, description)
- Return everything to you for analysis

IMPORTANT:
- If no transcript, inform user and provide available metadata
- You can use the transcript for summaries, Q&A, analysis, etc.

Use this when users:
- Ask about YouTube video content
- Want summaries or explanations
- Have specific questions about videos
- Need information from video transcripts`,

    inputSchema: z.object({
        youtubeUrl: z
            .string()
            .describe(
                'The full YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)'
            ),
        includeDescription: z
            .boolean()
            .optional()
            .default(true)
            .describe('Whether to fetch video description (default: true)'),
    }),

    execute: async ({ youtubeUrl, includeDescription = true }): Promise<YouTubeTranscriptResult> => {
        log.info('📝 YouTube Transcript Tool called', {
            youtubeUrl,
            includeDescription,
        });

        try {
            // Extract video ID
            const videoId = extractVideoId(youtubeUrl);
            if (!videoId) {
                throw new Error(
                    'Invalid YouTube URL - could not extract video ID'
                );
            }

            // Fetch transcript and metadata in parallel
            const [transcriptData, description] = await Promise.all([
                fetchTranscript(youtubeUrl),
                includeDescription
                    ? getVideoDescription(youtubeUrl)
                    : Promise.resolve(undefined),
            ]);

            // Build response
            const response: YouTubeTranscriptResult = {
                videoId,
                url: youtubeUrl,
                hasTranscript: false,
            };

            if (transcriptData) {
                response.hasTranscript = true;

                // Use title from API, but fallback to extracting from tab if it's "Unknown"
                if (transcriptData.title && transcriptData.title !== 'Unknown') {
                    response.title = transcriptData.title;
                } else {
                    log.info('📝 API returned unknown title, extracting from active tab');
                    const tabTitle = await extractVideoTitleFromTab();
                    response.title = tabTitle || transcriptData.title;
                }

                response.transcript = transcriptData.transcript;
                response.transcriptLength = transcriptData.transcript.length;

                if (transcriptData.duration) {
                    response.duration = transcriptData.duration * 60; // Convert to seconds
                    response.durationFormatted = formatDuration(
                        response.duration
                    );
                }
            } else {
                // No transcript - try to get duration separately
                log.info('No transcript available, fetching metadata only');
                const duration = await getVideoDuration(youtubeUrl);
                if (duration) {
                    response.duration = duration;
                    response.durationFormatted = formatDuration(duration);
                }
            }

            if (description) {
                response.description = description;
                response.descriptionLength = description.length;
            }

            log.info('✅ YouTube data fetched', {
                hasTranscript: response.hasTranscript,
                transcriptLength: response.transcriptLength,
                hasDuration: !!response.duration,
                hasDescription: !!response.description,
            });

            return response;
        } catch (error) {
            log.error('❌ YouTube Transcript Tool error', error);
            const parsedError = parseError(error, { serviceName: 'YouTube' });

            // Return error in result instead of throwing
            // This allows the main agent to handle gracefully
            return {
                videoId: extractVideoId(youtubeUrl) || 'unknown',
                url: youtubeUrl,
                hasTranscript: false,
                error:
                    parsedError?.message ||
                    (error instanceof Error ? error.message : 'Unknown error'),
            };
        }
    },
});
