/**
 * YouTube Agent Tool for Browser Action Agent
 * 
 * This file provides the YouTube agent in Gemini's native function calling format
 * so it can be directly used by the browser action agent.
 */

import { initializeGenAIClient } from '../../core/genAIFactory';
import { createLogger } from '../../../logger';
import { ExternalServiceError, NetworkError, parseError } from '../../../errors';
import type { FunctionDeclaration } from '@google/genai';
import { fetchTranscript } from './utils/transcript';
import { getVideoDuration, getVideoDescription, MAX_CHUNK_DURATION } from './utils/videoMetadata';
import { analyzeYouTubeVideo } from './utils/videoAnalysis';
import { formatDuration } from './utils/formatting';
import { withRetry, MAX_RETRIES, INITIAL_RETRY_DELAY } from './utils/retry';

const log = createLogger('YouTube-Agent-Tool');

/**
 * YouTube Agent Tool Declaration for Gemini
 * This is the function declaration in Gemini's native format
 */
export const analyzeYouTubeVideoDeclaration: FunctionDeclaration = {
    name: 'analyzeYouTubeVideo',
    description: `Analyze YouTube videos and answer questions about their content.
  
This tool analyzes the currently active YouTube video tab or a specified YouTube URL.
It uses Gemini's native video understanding capabilities to answer questions about the video.

The tool will:
1. Extract the YouTube URL from the active tab (if not provided)
2. Get the video duration automatically
3. Handle long videos by chunking them into 30-minute segments
4. Provide comprehensive answers to questions about the video content

Use this when users ask about:
- What a YouTube video is about
- Specific information from a video
- Summaries of video content
- Questions about currently playing videos

IMPORTANT: 
- If no URL is provided, the active tab MUST be a YouTube video page
- For long videos (>30 min), the tool automatically chunks and analyzes intelligently
- Questions can be about specific topics or general summaries`,

    parametersJsonSchema: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                description: 'The question to answer about the YouTube video. Be specific about what information you need.'
            },
            youtubeUrl: {
                type: 'string',
                description: 'Optional YouTube URL. If not provided, will extract from the currently active tab.',
                nullable: true
            }
        },
        required: ['question']
    }
};

/**
 * YouTube Agent Executor
 * This function executes the YouTube analysis with the given parameters
 */
export async function executeYouTubeAnalysis(args: { question: string; youtubeUrl?: string }): Promise<any> {
    log.info('🎬 YouTube Analysis Tool called', { question: args.question, youtubeUrl: args.youtubeUrl });

    try {
        let finalUrl = args.youtubeUrl;

        // If URL not provided, extract from active tab
        if (!finalUrl) {
            log.info('YouTube URL not provided, extracting from active tab');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url) {
                throw new Error('Could not get active tab URL');
            }

            if (!tab.url.includes('youtube.com/watch')) {
                throw new Error('Active tab is not a YouTube video page. Please navigate to a YouTube video or provide a YouTube URL.');
            }

            finalUrl = tab.url;
            log.info('✅ Extracted YouTube URL from active tab', { url: finalUrl });
        }

        // At this point, finalUrl must be defined
        if (!finalUrl) {
            throw new Error('YouTube URL is required');
        }

        // Try to fetch transcript first (preferred method - faster and more accurate)
        log.info('Attempting to fetch transcript');

        // Fetch transcript and description in parallel for efficiency
        const [transcriptData, videoDescription] = await Promise.all([
            fetchTranscript(finalUrl),
            getVideoDescription(finalUrl)
        ]);

        let videoDuration: number | undefined;
        let transcript: string | undefined;
        let description: string | undefined = videoDescription;

        if (transcriptData && transcriptData.transcript) {
            // We have a transcript! Use it regardless of title/duration
            transcript = transcriptData.transcript;

            // Use duration from API if available
            if (transcriptData.duration) {
                videoDuration = transcriptData.duration * 60; // API returns duration in minutes, we need seconds
            }

            log.info('✅ Transcript available', {
                duration: videoDuration,
                formatted: videoDuration ? formatDuration(videoDuration) : 'unknown',
                transcriptLength: transcript.length,
                hasDescription: !!description,
            });
        } else {
            // No transcript available - we'll need to use video analysis
            log.info('ℹ️ No transcript available, will use Gemini video analysis');

            // Get video duration for chunking
            videoDuration = await getVideoDuration(finalUrl);

            if (videoDuration) {
                log.info('Video duration available', {
                    duration: videoDuration,
                    formatted: formatDuration(videoDuration),
                    willChunk: videoDuration > MAX_CHUNK_DURATION
                });
            } else {
                log.warn('Video duration not available - will analyze as single chunk');
            }
        }

        // Try to analyze the video
        let answer: string;
        let usedDescription = false;

        try {
            // Analyze the video
            answer = await analyzeYouTubeVideo(finalUrl, args.question, videoDuration, transcript);
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

User Question: ${args.question}

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

        log.info('✅ YouTube Analysis completed', {
            textLength: answer.length,
            usedTranscript: !!transcript,
            usedDescription,
            wasChunked: videoDuration ? videoDuration > MAX_CHUNK_DURATION && !transcript : false,
        });

        return {
            success: true,
            answer,
            videoUrl: finalUrl,
            videoDuration,
            usedTranscript: !!transcript,
            usedDescription,
            wasChunked: videoDuration ? videoDuration > MAX_CHUNK_DURATION && !transcript : false,
        };

    } catch (error) {
        log.error('❌ YouTube Analysis error', error);

        // Parse the error into a typed error for better user messaging
        const parsedError = parseError(error, { serviceName: 'YouTube' });

        // Return structured error that will be displayed in CompactToolCard
        return {
            success: false,
            error: parsedError.message,
            errorType: parsedError.constructor.name,
            answer: parsedError instanceof ExternalServiceError || parsedError instanceof NetworkError
                ? parsedError.userMessage
                : `I encountered an error analyzing the YouTube video: ${parsedError.message}`,
        };
    }
}
