/**
 * YouTube Agent Tool for Browser Action Agent
 * 
 * This file provides the YouTube agent in Gemini's native function calling format
 * so it can be directly used by the browser action agent.
 */

import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import { createLogger } from '../../logger';
import { ExternalServiceError, NetworkError, BrowserAPIError, parseError } from '../../errors';
import { validateAndGetApiKey } from '../../utils/geminiApiKey';

const log = createLogger('YouTube-Agent-Tool');

// Maximum chunk duration in seconds (30 minutes)
const MAX_CHUNK_DURATION = 30 * 60; // 1800 seconds

// Transcript API endpoint
const TRANSCRIPT_API_URL = 'https://youtube-transcript-generator-five.vercel.app/simple-transcript';

/**
 * Fetch transcript from the deployed API
 * @param youtubeUrl - The YouTube video URL
 * @returns Transcript data or undefined if not available
 */
async function fetchTranscript(youtubeUrl: string): Promise<{ title: string; duration: number; transcript: string } | undefined> {
    try {
        log.info('📝 Fetching transcript from API', { youtubeUrl });

        const response = await fetch(TRANSCRIPT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: youtubeUrl }),
        });

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
            tabId: tab.id,
            tabUrl: tab.url,
            isYouTubePage: tab.url?.includes('youtube.com/watch')
        });

        if (!tab.id) {
            log.warn('⚠️ No active tab found');
            return undefined;
        }

        if (!tab.url?.includes('youtube.com/watch')) {
            log.warn('⚠️ Active tab is not a YouTube video page', {
                tabId: tab.id,
                tabUrl: tab.url
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
                            if (match) {
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
        // Check for Chrome API permission errors
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (parsedError instanceof BrowserAPIError) {
            log.error('❌ Browser API error getting video duration:', parsedError.userMessage);
            // Don't throw - just return undefined and fallback to video analysis
            return undefined;
        }

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

        if (!tab.id || !tab.url?.includes('youtube.com/watch')) {
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
 * Analyzes a single chunk of a YouTube video
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
        // Get API key from storage and initialize Google AI
        const apiKey = await validateAndGetApiKey();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

            const result = await model.generateContent([{ text: prompt }]);
            return result.response.text();
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

        const result = await model.generateContent(parts);
        return result.response.text();
    } catch (error) {
        log.error('❌ Error in analyzeVideoChunk:', error);

        // Parse and re-throw the error so it propagates up
        const parsedError = parseError(error, { serviceName: 'Gemini Video Analysis' });
        throw parsedError;
    }
}

/**
 * Analyzes a YouTube video, chunking it if necessary for long videos
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

            // Get API key from storage and initialize Google AI
            const apiKey = await validateAndGetApiKey();
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

            const finalResult = await model.generateContent([{ text: consolidationPrompt }]);
            return `# Consolidated Summary\n\n${finalResult.response.text()}\n\n---\n\n<details>\n<summary>View Detailed Part-by-Part Analysis</summary>\n\n${combinedResult}\n</details>`;
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
}

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

    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            question: {
                type: SchemaType.STRING,
                description: 'The question to answer about the YouTube video. Be specific about what information you need.'
            },
            youtubeUrl: {
                type: SchemaType.STRING,
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

            if (!tab.url) {
                throw new Error('Could not get active tab URL');
            }

            if (!tab.url.includes('youtube.com/watch')) {
                throw new Error('Active tab is not a YouTube video page. Please navigate to a YouTube video or provide a YouTube URL.');
            }

            finalUrl = tab.url;
            log.info('✅ Extracted YouTube URL from active tab', { url: finalUrl });
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

                // Get API key and analyze based on description
                const apiKey = await validateAndGetApiKey();
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

                const descriptionPrompt = `⚠️ Note: Unable to directly analyze the video content. The following answer is generated based on the video description only.

Video Description:
${description}

User Question: ${args.question}

Please answer the question based on the video description above. Be clear that this is based on the description, not the actual video content.`;

                const result = await model.generateContent([{ text: descriptionPrompt }]);
                answer = `⚠️ **Note:** Unable to directly analyze the video. The following response is based on the video description.\n\n---\n\n${result.response.text()}`;
            } else {
                // No description available either - re-throw the error
                throw videoAnalysisError;
            }
        } log.info('✅ YouTube Analysis completed', {
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
