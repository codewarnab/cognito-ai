/**
 * YouTube Video Analysis Agent
 * Specialized agent that uses Gemini's native video understanding capabilities
 */

import { tool } from 'ai';
import { z } from 'zod';
import { initializeGenAIClient } from '../../core/genAIFactory';
import { createLogger } from '../../../logger';
import { ExternalServiceError, NetworkError, parseError } from '../../../errors';
import { TRANSCRIPT_API_URL } from '../../../constants';

const log = createLogger('YouTube-Agent');

// Maximum chunk duration in seconds (30 minutes)
const MAX_CHUNK_DURATION = 30 * 60; // 1800 seconds

// Retry configuration
const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Transcript API endpoint is centralized in constants.ts

/**
 * Retry wrapper with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds
 * @param operationName - Name of the operation for logging
 * @returns The result of the function
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = MAX_RETRIES,
    initialDelay: number = INITIAL_RETRY_DELAY,
    operationName: string = 'operation'
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                log.info(`🔄 Retry attempt ${attempt}/${maxRetries} for ${operationName}`);
            }
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry certain types of errors
            if (error instanceof ExternalServiceError) {
                const status = (error as any).status;
                // Don't retry 4xx errors except 429 (rate limit)
                if (status && status >= 400 && status < 500 && status !== 429) {
                    log.warn(`❌ Non-retryable error for ${operationName} (status ${status})`);
                    throw error;
                }
            }

            // If we've exhausted retries, throw the error
            if (attempt >= maxRetries) {
                log.error(`❌ All retry attempts exhausted for ${operationName}`);
                throw error;
            }

            // Calculate exponential backoff delay
            const delay = initialDelay * Math.pow(2, attempt);
            log.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
}

/**
 * Fetch transcript from the deployed API
 * @param youtubeUrl - The YouTube video URL
 * @returns Transcript data or undefined if not available
 */
async function fetchTranscript(youtubeUrl: string): Promise<{ title: string; duration: number; transcript: string } | undefined> {
    try {
        log.info('📝 Fetching transcript from API', { youtubeUrl });

        const response = await withRetry(
            async () => {
                return await fetch(TRANSCRIPT_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url: youtubeUrl }),
                });
            },
            MAX_RETRIES,
            INITIAL_RETRY_DELAY,
            'fetch transcript'
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 404) {
                log.info('ℹ️ No captions available for this video', errorData);
                return undefined;
            }

            if (response.status === 403) {
                log.warn('⚠️ Video is restricted or private', errorData);
                throw ExternalServiceError.youtubeError(403, 'This video is restricted, private, or unavailable.');
            }

            if (response.status === 429) {
                log.warn('⚠️ YouTube API rate limit hit', errorData);
                throw ExternalServiceError.youtubeError(429, 'YouTube API rate limit exceeded. Please try again later.');
            }

            if (response.status === 503) {
                log.warn('⚠️ Transcript service temporarily unavailable (YouTube API changes)', errorData);
                return undefined;
            }

            log.warn(`⚠️ Transcript API returned ${response.status}:`, errorData);
            return undefined;
        }

        const data = await response.json();
        log.info('✅ Transcript fetched successfully', {
            title: data.title,
            duration: data.duration,
            transcriptLength: data.transcript?.length || 0,
        });

        return data;
    } catch (error) {
        // Re-throw if it's already a typed error
        if (error instanceof ExternalServiceError) {
            throw error;
        }

        // Check for network errors
        const parsedError = parseError(error, { serviceName: 'YouTube' });
        if (parsedError instanceof NetworkError) {
            log.warn('⚠️ Network error fetching transcript:', parsedError.userMessage);
            throw parsedError;
        }

        log.warn('⚠️ Could not fetch transcript (will use video analysis):', error);
        return undefined;
    }
}

/**
 * Extract video duration from YouTube page
 * @param youtubeUrl - The YouTube video URL
 * @returns Duration in seconds, or undefined if not found
 */
async function getVideoDuration(youtubeUrl: string): Promise<number | undefined> {
    try {
        log.info('📹 Attempting to extract video duration', { youtubeUrl });

        // Extract video ID from URL
        const videoIdMatch = youtubeUrl.match(/[?&]v=([^&]+)/);
        if (!videoIdMatch) {
            log.warn('❌ Could not extract video ID from URL', { youtubeUrl });
            return undefined;
        }

        const videoId = videoIdMatch[1];
        log.info('✅ Video ID extracted', { videoId });

        // Query the active tab to get video duration
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        log.info('🔍 Active tab queried', {
            tabId: tab?.id,
            tabUrl: tab?.url,
            isYouTubePage: tab?.url?.includes('youtube.com/watch')
        });

        if (!tab || !tab.id || !tab.url?.includes('youtube.com/watch')) {
            log.warn('⚠️ Active tab is not a YouTube video page', {
                tabId: tab?.id,
                tabUrl: tab?.url
            });
            return undefined;
        }

        log.info('💉 Injecting script to extract duration from page', { tabId: tab.id });

        // Execute script to extract duration from page
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                try {
                    console.log('[YT Duration] Starting extraction...');

                    // Try to get ytInitialPlayerResponse
                    let ytData = (window as any).ytInitialPlayerResponse;
                    console.log('[YT Duration] window.ytInitialPlayerResponse exists:', !!ytData);

                    // If not found, try to extract from script tag
                    if (!ytData) {
                        console.log('[YT Duration] Searching script tags...');
                        const scripts = Array.from(document.querySelectorAll('script'));
                        const playerScript = scripts.find(s => s.textContent?.includes('ytInitialPlayerResponse'));
                        console.log('[YT Duration] Found script with ytInitialPlayerResponse:', !!playerScript);

                        if (playerScript?.textContent) {
                            const match = playerScript.textContent.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
                            if (match && match[1]) {
                                ytData = JSON.parse(match[1]);
                                console.log('[YT Duration] Successfully parsed ytData from script tag');
                            } else {
                                console.log('[YT Duration] Failed to match ytInitialPlayerResponse in script');
                            }
                        }
                    }

                    if (ytData?.videoDetails) {
                        console.log('[YT Duration] Video details found:', {
                            videoId: ytData.videoDetails.videoId,
                            title: ytData.videoDetails.title,
                            lengthSeconds: ytData.videoDetails.lengthSeconds
                        });
                    } else {
                        console.log('[YT Duration] No videoDetails found in ytData');
                    }

                    const lengthSeconds = ytData?.videoDetails?.lengthSeconds;
                    const duration = lengthSeconds ? parseInt(lengthSeconds, 10) : undefined;
                    console.log('[YT Duration] Final duration:', duration);

                    return duration;
                } catch (error) {
                    console.error('[YT Duration] Error extracting duration:', error);
                    return undefined;
                }
            },
        });

        const duration = results[0]?.result;

        if (duration) {
            log.info('✅ Video duration extracted successfully', {
                duration,
                formatted: formatDuration(duration),
                willRequireChunking: duration > MAX_CHUNK_DURATION,
                estimatedChunks: duration > MAX_CHUNK_DURATION ? Math.ceil(duration / MAX_CHUNK_DURATION) : 1
            });
        } else {
            log.warn('⚠️ Could not extract video duration from page', {
                scriptResult: results[0]?.result
            });
        }

        return duration;
    } catch (error) {
        log.error('❌ Error getting video duration:', error);
        return undefined;
    }
}

/**
 * Extract video description from YouTube page
 * @param youtubeUrl - The YouTube video URL
 * @returns Video description or undefined if not found
 */
async function getVideoDescription(youtubeUrl: string): Promise<string | undefined> {
    try {
        log.info('📝 Attempting to extract video description', { youtubeUrl });

        // Query the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id || !tab.url?.includes('youtube.com/watch')) {
            log.warn('⚠️ Active tab is not a YouTube video page');
            return undefined;
        }

        log.info('💉 Injecting script to extract description from page', { tabId: tab.id });

        // Execute script to extract description from page
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                return new Promise((resolve) => {
                    try {
                        console.log('[YT Description] Starting extraction...');

                        // Find the main description container element
                        const descriptionExpander = document.getElementById('description-inline-expander');

                        if (!descriptionExpander) {
                            console.error('[YT Description] Could not find description container');
                            resolve(undefined);
                            return;
                        }

                        // Check if the description is currently collapsed
                        const isCollapsed = !descriptionExpander.hasAttribute('is-expanded');

                        // Function to extract the description text
                        const extractDescription = () => {
                            const fullDescriptionElement = descriptionExpander.querySelector('#description-inline-expander #description-inner yt-attributed-string');
                            if (fullDescriptionElement && fullDescriptionElement.textContent) {
                                const description = fullDescriptionElement.textContent.trim();
                                console.log('[YT Description] Successfully extracted description, length:', description.length);
                                return description;
                            } else {
                                console.error('[YT Description] Could not find description text element');
                                return undefined;
                            }
                        };

                        // If collapsed, expand first
                        if (isCollapsed) {
                            console.log('[YT Description] Description is collapsed, expanding...');
                            const expandButton = descriptionExpander.querySelector('#expand') as HTMLElement;

                            if (expandButton) {
                                expandButton.click();
                                // Wait for DOM to update
                                setTimeout(() => {
                                    const description = extractDescription();
                                    // Collapse back to original state
                                    const collapseButton = descriptionExpander.querySelector('#collapse') as HTMLElement;
                                    if (collapseButton) {
                                        collapseButton.click();
                                    }
                                    resolve(description);
                                }, 500);
                            } else {
                                console.error('[YT Description] Could not find expand button');
                                resolve(undefined);
                            }
                        } else {
                            // Already expanded, extract directly
                            console.log('[YT Description] Description already expanded');
                            resolve(extractDescription());
                        }
                    } catch (error) {
                        console.error('[YT Description] Error extracting description:', error);
                        resolve(undefined);
                    }
                });
            },
        });

        const description = results[0]?.result;

        if (description && typeof description === 'string') {
            log.info('✅ Video description extracted successfully', {
                descriptionLength: description.length,
            });
            return description;
        } else {
            log.warn('⚠️ Could not extract video description from page');
            return undefined;
        }
    } catch (error) {
        log.error('❌ Error getting video description:', error);
        return undefined;
    }
}

/**
 * Format seconds to readable time format (e.g., "1h 30m" or "45m 30s")
 */
function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else if (minutes > 0) {
        return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    } else {
        return `${secs}s`;
    }
}

/**
 * Analyzes a single chunk of a YouTube video
 * @param youtubeUrl - The YouTube video URL
 * @param question - The question to ask about the video
 * @param transcript - Optional transcript text for faster analysis
 * @param startOffset - Start time in seconds (optional)
 * @param endOffset - End time in seconds (optional)
 * @param chunkInfo - Optional info about chunk position (e.g., "chunk 1/4")
 * @returns The analysis result for this chunk
 */
async function analyzeVideoChunk(
    youtubeUrl: string,
    question: string,
    transcript?: string,
    startOffset?: number,
    endOffset?: number,
    chunkInfo?: string
): Promise<string> {
    try {
        // Initialize Gen AI client with provider awareness
        const client = await initializeGenAIClient();

        // If transcript is available, use text-based analysis
        if (transcript) {
            log.info('📝 Using transcript-based analysis', { transcriptLength: transcript.length });

            const timeRange = startOffset !== undefined && endOffset !== undefined
                ? ` (analyzing ${formatDuration(startOffset)} to ${formatDuration(endOffset)})`
                : '';

            const systemPrompt = `You are a specialized YouTube video analysis expert${chunkInfo ? ` analyzing ${chunkInfo}` : ''}.
  
You have access to the complete transcript of the video, which allows you to provide precise answers with accurate quotes.

Your capabilities:
- Analyzing video transcripts thoroughly
- Answering specific questions about video content
- Extracting key information and insights
- Providing accurate quotes from the transcript
- Summarizing video content accurately

${chunkInfo ? `IMPORTANT: You are analyzing ${chunkInfo}${timeRange}. Focus on content within this time range.` : ''}

Always be thorough, accurate, and cite specific quotes from the transcript when relevant.
Focus on directly answering the user's specific question about the video.`;

            const prompt = `${systemPrompt}\n\nTranscript:\n${transcript}\n\nUser Question: ${question}`;

            const response = await withRetry(
                async () => {
                    return await client.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: [{ role: 'user', parts: [{ text: prompt }] }]
                    });
                },
                MAX_RETRIES,
                INITIAL_RETRY_DELAY,
                'transcript analysis'
            );
            return response.text || 'No response generated';
        }

        // Fallback to video-based analysis if no transcript
        log.info('🎥 Using video-based analysis (no transcript available)');

        const timeRange = startOffset !== undefined && endOffset !== undefined
            ? ` (analyzing ${formatDuration(startOffset)} to ${formatDuration(endOffset)})`
            : '';

        const systemPrompt = `You are a specialized YouTube video analysis expert${chunkInfo ? ` analyzing ${chunkInfo}` : ''}.
  
Your capabilities:
- Understanding video content directly through Gemini's native video analysis
- Answering specific questions about video content
- Extracting key information and insights
- Providing timestamps when relevant
- Summarizing video content accurately

${chunkInfo ? `IMPORTANT: You are analyzing ${chunkInfo}${timeRange}. Focus on content within this time range.` : ''}

Always be thorough, accurate, and cite specific moments from the video when relevant.
Focus on directly answering the user's specific question about the video.`;

        const prompt = `${systemPrompt}\n\nUser Question: ${question}`;

        // Build the parts for the request
        const parts: any[] = [
            {
                text: prompt,
            },
        ];

        // Add video file data with optional time offsets
        const videoPart: any = {
            fileData: {
                mimeType: "video/*",
                fileUri: youtubeUrl,
            },
        };

        // Add video metadata with time offsets if specified
        if (startOffset !== undefined && endOffset !== undefined) {
            videoPart.videoMetadata = {
                startOffset: `${startOffset}s`,
                endOffset: `${endOffset}s`,
            };
        }

        parts.push(videoPart);

        const response = await withRetry(
            async () => {
                return await client.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [{ role: 'user', parts }]
                });
            },
            MAX_RETRIES,
            INITIAL_RETRY_DELAY,
            'video analysis'
        );
        return response.text || 'No response generated';
    } catch (error) {
        log.error('❌ Error in analyzeVideoChunk:', error);

        // Parse and re-throw the error so it propagates up
        const parsedError = parseError(error, { serviceName: 'Gemini Video Analysis' });
        throw parsedError;
    }
}

/**
 * Analyzes a YouTube video, chunking it if necessary for long videos
 * @param youtubeUrl - The YouTube video URL
 * @param question - The question to ask about the video
 * @param videoDuration - Duration of the video in seconds (optional, but recommended for long videos)
 * @param transcript - Optional transcript text for faster analysis
 * @returns The complete analysis result
 */
async function analyzeYouTubeVideo(
    youtubeUrl: string,
    question: string,
    videoDuration?: number,
    transcript?: string
): Promise<string> {
    // If transcript is available, use it for analysis (much faster and more accurate)
    if (transcript) {
        log.info('📝 Using transcript for analysis', {
            transcriptLength: transcript.length,
            videoDuration,
        });
        return await analyzeVideoChunk(youtubeUrl, question, transcript);
    }

    // If video duration is not provided or video is short enough, analyze it whole
    if (!videoDuration || videoDuration <= MAX_CHUNK_DURATION) {
        log.info('Analyzing video as single chunk', { videoDuration, maxChunkDuration: MAX_CHUNK_DURATION });
        return await analyzeVideoChunk(youtubeUrl, question);
    }

    // Video is long - need to chunk it
    const numChunks = Math.ceil(videoDuration / MAX_CHUNK_DURATION);
    log.info('Long video detected - chunking analysis', {
        videoDuration: formatDuration(videoDuration),
        numChunks,
        chunkDuration: formatDuration(MAX_CHUNK_DURATION)
    });

    // Determine if this is a summary request or a search request
    const isSummaryRequest = /summar|overview|what.*about|explain|describe|key points/i.test(question);

    if (isSummaryRequest) {
        // For summaries, analyze all chunks and combine
        log.info('Summary request detected - analyzing all chunks');
        const chunkResults: string[] = [];

        for (let i = 0; i < numChunks; i++) {
            const startOffset = i * MAX_CHUNK_DURATION;
            const endOffset = Math.min((i + 1) * MAX_CHUNK_DURATION, videoDuration);
            const chunkInfo = `chunk ${i + 1}/${numChunks}`;

            log.info(`Analyzing ${chunkInfo}`, {
                timeRange: `${formatDuration(startOffset)} - ${formatDuration(endOffset)}`
            });

            const chunkResult = await analyzeVideoChunk(
                youtubeUrl,
                question,
                undefined, // no transcript for chunked video analysis
                startOffset,
                endOffset,
                chunkInfo
            );

            chunkResults.push(`\n### Part ${i + 1}/${numChunks} (${formatDuration(startOffset)} - ${formatDuration(endOffset)}):\n${chunkResult}`);
        }

        // Combine all chunk results
        const combinedResult = `# Complete Video Analysis (${formatDuration(videoDuration)} total)\n\n` +
            `The video has been analyzed in ${numChunks} parts (${formatDuration(MAX_CHUNK_DURATION)} each):\n` +
            chunkResults.join('\n\n---\n');

        // If there are many chunks, create a final summary
        if (numChunks > 3) {
            log.info('Creating final consolidated summary from all chunks');

            // Initialize Gen AI client with provider awareness
            const client = await initializeGenAIClient();

            const consolidationPrompt = `You are synthesizing analysis from ${numChunks} parts of a ${formatDuration(videoDuration)} video.

Here are the individual part analyses:

${combinedResult}

Please provide a comprehensive, consolidated answer to the original question: "${question}"

Create a cohesive response that:
1. Integrates insights from all parts
2. Maintains chronological flow where relevant
3. Highlights key themes and patterns across the entire video
4. Provides a clear, unified answer to the question

Your consolidated response:`;

            const finalResponse = await withRetry(
                async () => {
                    return await client.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: [{ role: 'user', parts: [{ text: consolidationPrompt }] }]
                    });
                },
                MAX_RETRIES,
                INITIAL_RETRY_DELAY,
                'consolidation summary'
            );
            return `# Consolidated Summary\n\n${finalResponse.text}\n\n---\n\n<details>\n<summary>View Detailed Part-by-Part Analysis</summary>\n\n${combinedResult}</details>`;
        }

        return combinedResult;

    } else {
        // For search/specific questions, analyze chunks sequentially until we find relevant info
        log.info('Search/question request detected - analyzing chunks sequentially');
        const chunkResults: Array<{ chunkNum: number; timeRange: string; result: string; hasAnswer: boolean }> = [];

        for (let i = 0; i < numChunks; i++) {
            const startOffset = i * MAX_CHUNK_DURATION;
            const endOffset = Math.min((i + 1) * MAX_CHUNK_DURATION, videoDuration);
            const chunkInfo = `chunk ${i + 1}/${numChunks}`;
            const timeRange = `${formatDuration(startOffset)} - ${formatDuration(endOffset)}`;

            log.info(`Searching ${chunkInfo}`, { timeRange });

            const chunkResult = await analyzeVideoChunk(
                youtubeUrl,
                question,
                undefined, // no transcript for chunked video analysis
                startOffset,
                endOffset,
                chunkInfo
            );

            // Check if this chunk seems to have relevant information
            const hasAnswer = !/no.*mention|not.*discussed|don't.*see|doesn't.*cover|no.*information/i.test(chunkResult);

            chunkResults.push({
                chunkNum: i + 1,
                timeRange,
                result: chunkResult,
                hasAnswer
            });

            // If we found relevant info and analyzed at least 2 chunks, we can stop early
            // (unless it's a very short video where we should check everything)
            if (hasAnswer && i >= 1 && numChunks > 3) {
                log.info('Found relevant information, checking one more chunk to be thorough');
                // Check one more chunk to be thorough, then stop
                if (i < numChunks - 1) {
                    const nextI = i + 1;
                    const nextStartOffset = nextI * MAX_CHUNK_DURATION;
                    const nextEndOffset = Math.min((nextI + 1) * MAX_CHUNK_DURATION, videoDuration);
                    const nextChunkInfo = `chunk ${nextI + 1}/${numChunks}`;
                    const nextTimeRange = `${formatDuration(nextStartOffset)} - ${formatDuration(nextEndOffset)}`;

                    const nextChunkResult = await analyzeVideoChunk(
                        youtubeUrl,
                        question,
                        undefined, // no transcript for chunked video analysis
                        nextStartOffset,
                        nextEndOffset,
                        nextChunkInfo
                    );

                    const nextHasAnswer = !/no.*mention|not.*discussed|don't.*see|doesn't.*cover|no.*information/i.test(nextChunkResult);

                    chunkResults.push({
                        chunkNum: nextI + 1,
                        timeRange: nextTimeRange,
                        result: nextChunkResult,
                        hasAnswer: nextHasAnswer
                    });
                }
                break;
            }
        }

        // Combine results from chunks that had relevant information
        const relevantChunks = chunkResults.filter(c => c.hasAnswer);

        if (relevantChunks.length === 0) {
            // No relevant info found in any chunk
            return `After searching through ${chunkResults.length} parts of the video (${formatDuration(videoDuration)} total), I could not find specific information answering: "${question}"\n\n` +
                `The video content may not cover this topic, or it might be discussed in a way that wasn't detected in the analyzed segments.`;
        }

        // Compile the answer from relevant chunks
        let answer = `# Answer from Video Analysis\n\n`;
        answer += `Found relevant information in ${relevantChunks.length} part(s) of the ${formatDuration(videoDuration)} video:\n\n`;

        for (const chunk of relevantChunks) {
            answer += `### Part ${chunk.chunkNum}/${numChunks} (${chunk.timeRange}):\n${chunk.result}\n\n`;
        }

        if (chunkResults.length > relevantChunks.length) {
            answer += `\n*Note: Analyzed ${chunkResults.length} parts total. ${chunkResults.length - relevantChunks.length} parts did not contain relevant information.*`;
        }

        return answer;
    }
}/**
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
            } log.info('✅ YouTube Agent completed', {
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
