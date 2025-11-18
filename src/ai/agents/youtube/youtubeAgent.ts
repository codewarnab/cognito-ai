/**
 * YouTube Video Analysis Agent
 * Specialized agent that uses Gemini's native video understanding capabilities
 */

import { tool } from 'ai';
import { z } from 'zod';
import { initializeGenAIClient } from '../../core/genAIFactory';
import { createLogger } from '../../../logger';
import { parseError } from '../../../errors';
import { fetchTranscript } from './utils/transcript';
import { getVideoDuration, getVideoDescription, MAX_CHUNK_DURATION } from './utils/videoMetadata';
import { analyzeYouTubeVideo } from './utils/videoAnalysis';
import { formatDuration } from './utils/formatting';
import { withRetry, MAX_RETRIES, INITIAL_RETRY_DELAY } from './utils/retry';

const log = createLogger('YouTube-Agent');

/**
 * YouTube Agent wrapped as a Tool for the main agent
 * This allows the main agent to delegate YouTube video questions to the specialist
 */
export const youtubeAgentAsTool = tool({
    description: `Analyze YouTube videos and answer questions about their content.
  
  Use this tool when users:
  - Ask about YouTube video content
  - Want to understand what a video is about
  - Need specific information from a video
  - Request video summaries or analysis
  - Have questions about videos they're watching
  
  This specialist agent uses Gemini's native video understanding capabilities
  to directly process and analyze YouTube videos.
  
  IMPORTANT FOR LONG VIDEOS:
  - Videos longer than 30 minutes are automatically chunked into 30-minute segments
  - For summaries: All chunks are analyzed and combined into a comprehensive summary
  - For questions: Chunks are analyzed sequentially until relevant information is found
  - Always provide videoDuration when available for optimal chunking`,

    inputSchema: z.object({
        youtubeUrl: z.string().describe('The full YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)'),
        question: z.string().describe('The specific question the user wants answered about the video'),
        videoDuration: z.number().optional().describe('Duration of the video in seconds (CRITICAL for videos > 30 min). Extract from YouTube page data when available.'),
    }),

    execute: async ({ youtubeUrl, question, videoDuration }) => {
        log.info('🎬 YouTube Agent called', { youtubeUrl, question, videoDuration });

        try {
            // Try to fetch transcript first (preferred method - faster and more accurate)
            log.info('Attempting to fetch transcript');

            // Fetch transcript and description in parallel for efficiency
            const [transcriptData, videoDescription] = await Promise.all([
                fetchTranscript(youtubeUrl),
                getVideoDescription(youtubeUrl)
            ]);

            let finalDuration = videoDuration;
            let transcript: string | undefined;
            let description: string | undefined = videoDescription;

            if (transcriptData && transcriptData.transcript) {
                // We have a transcript! Use it regardless of title/duration
                transcript = transcriptData.transcript;

                // Use duration from API if available, otherwise use provided or extract it
                if (transcriptData.duration) {
                    finalDuration = transcriptData.duration * 60; // API returns duration in minutes, we need seconds
                }

                log.info('✅ Transcript available', {
                    duration: finalDuration,
                    formatted: finalDuration ? formatDuration(finalDuration) : 'unknown',
                    transcriptLength: transcript.length,
                    hasDescription: !!description,
                });
            } else {
                // No transcript available - we'll need to use video analysis
                log.info('ℹ️ No transcript available, will use Gemini video analysis');

                // Try to get duration for chunking if not provided
                if (!finalDuration) {
                    log.info('Attempting to extract duration from page for chunking');
                    finalDuration = await getVideoDuration(youtubeUrl);
                }

                if (finalDuration) {
                    log.info('Video duration available', {
                        duration: finalDuration,
                        formatted: formatDuration(finalDuration),
                        willChunk: finalDuration > MAX_CHUNK_DURATION
                    });
                } else {
                    log.warn('Video duration not available - will analyze as single chunk');
                }
            }

            // Try to analyze the YouTube video
            let answer: string;
            let usedDescription = false;

            try {
                // Use Gemini's direct video understanding to analyze the YouTube video
                answer = await analyzeYouTubeVideo(youtubeUrl, question, finalDuration, transcript);
            } catch (videoAnalysisError) {
                // Video analysis failed - use description as fallback if available
                if (description) {
                    log.warn('⚠️ Video analysis failed, using description as fallback', videoAnalysisError);
                    usedDescription = true;

                    // Initialize Gen AI client and analyze based on description
                    const client = await initializeGenAIClient();

                    const descriptionPrompt = `⚠️ Note: Unable to directly analyze the video content. The following answer is generated based on the video description only.

Video Description:
${description}

User Question: ${question}

Please answer the question based on the video description above. Be clear that this is based on the description, not the actual video content.`;

                    const response = await withRetry(
                        async () => {
                            return await client.models.generateContent({
                                model: 'gemini-2.5-flash',
                                contents: [{ role: 'user', parts: [{ text: descriptionPrompt }] }]
                            });
                        },
                        MAX_RETRIES,
                        INITIAL_RETRY_DELAY,
                        'description-based analysis'
                    );
                    answer = `⚠️ **Note:** Unable to directly analyze the video. The following response is based on the video description.\n\n---\n\n${response.text}`;
                } else {
                    // No description available either - re-throw the error
                    throw videoAnalysisError;
                }
            } 
            
            log.info('✅ YouTube Agent completed', {
                textLength: answer.length,
                usedTranscript: !!transcript,
                usedDescription,
                wasChunked: finalDuration ? finalDuration > MAX_CHUNK_DURATION && !transcript : false,
            });

            return {
                answer,
                videoUrl: youtubeUrl,
                videoDuration: finalDuration ?? undefined,
                usedTranscript: !!transcript,
                usedDescription,
                wasChunked: finalDuration ? finalDuration > MAX_CHUNK_DURATION && !transcript : false,
            };

        } catch (error) {
            log.error('❌ YouTube Agent error', error);

            // Parse the error into a typed error
            const parsedError = parseError(error, { serviceName: 'YouTube' });

            // Throw the error so it gets displayed properly in CompactToolCard
            throw parsedError;
        }
    },
});
