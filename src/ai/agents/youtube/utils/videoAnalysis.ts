import { initializeGenAIClient } from '../../../core/genAIFactory';
import { createLogger } from '../../../../logger';
import { parseError } from '../../../../errors';
import { withRetry, MAX_RETRIES, INITIAL_RETRY_DELAY } from './retry';
import { formatDuration } from './formatting';
import { MAX_CHUNK_DURATION } from './videoMetadata';

const log = createLogger('YouTube-Analysis');

/**
 * Analyzes a single chunk of a YouTube video
 */
export async function analyzeVideoChunk(
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
            return response.text || 'No response generated from video analysis.';
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
        return response.text || 'No response generated from video analysis.';
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
export async function analyzeYouTubeVideo(
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

