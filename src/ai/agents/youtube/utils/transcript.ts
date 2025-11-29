import { createLogger } from '~logger';
import { ExternalServiceError, NetworkError, parseError } from '../../../../errors';
import { TRANSCRIPT_API_URL } from '@/constants';
import { withRetry, MAX_RETRIES, INITIAL_RETRY_DELAY } from './retry';

const log = createLogger('YouTube-Transcript');

/** Max retries specifically for "no captions" responses (API sometimes returns this incorrectly) */
const NO_CAPTIONS_MAX_RETRIES = 3;
const NO_CAPTIONS_RETRY_DELAY = 1500;

/**
 * Transcript segment with timing information
 */
export interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}

/**
 * Compact segment for AI consumption (reduced token usage)
 */
export interface CompactSegment {
    /** Segment text */
    t: string;
    /** Start time in seconds */
    s: number;
}

/**
 * Enhanced transcript response from API v2
 */
interface TranscriptResponse {
    videoId: string;
    title: string;
    duration: number;
    durationSeconds: number;
    transcript: string;
    author?: string;
    thumbnail?: string;
    description?: string;
    tags?: string[];
    segments?: TranscriptSegment[];
    language?: string;
}

/**
 * Processed transcript optimized for AI consumption
 * - Removes redundant full transcript (segments contain all text)
 * - Compacts segments to reduce token usage
 * - Preserves essential metadata
 */
export interface ProcessedTranscript {
    videoId: string;
    title: string;
    author?: string;
    durationSeconds: number;
    language?: string;
    /** Compact segments with text and start time only */
    segments: CompactSegment[];
    /** Hint for AI to reference timestamps when needed */
    _note: string;
}

/**
 * Process raw transcript response into compact format for AI
 * - Uses only segments (not full transcript) to avoid duplication
 * - Compacts segment format: { t: text, s: startSeconds }
 * - Removes duration from segments (not needed for AI context)
 */
export function processTranscriptForAI(data: TranscriptResponse): ProcessedTranscript {
    const compactSegments: CompactSegment[] = (data.segments || []).map(seg => ({
        t: seg.text.trim(),
        s: Math.floor(seg.start)
    }));

    return {
        videoId: data.videoId,
        title: data.title || 'Untitled Video',
        author: data.author,
        durationSeconds: data.durationSeconds,
        language: data.language,
        segments: compactSegments,
        _note: 'Reference timestamps (s) when user needs to verify specific parts'
    };
}

/**
 * Fetch transcript from the deployed API with retry for intermittent "no captions" errors
 * @param youtubeUrl - The YouTube video URL
 * @returns Transcript data or undefined if not available
 */
export async function fetchTranscript(youtubeUrl: string): Promise<TranscriptResponse | undefined> {
    return fetchTranscriptWithNoCaptionsRetry(youtubeUrl, NO_CAPTIONS_MAX_RETRIES);
}

/**
 * Internal fetch with retry logic for "no captions" responses
 * The API sometimes incorrectly returns 404 "no captions" - retry a few times before giving up
 */
async function fetchTranscriptWithNoCaptionsRetry(
    youtubeUrl: string,
    noCaptionsRetriesLeft: number
): Promise<TranscriptResponse | undefined> {
    try {
        log.info('📝 Fetching transcript from API', { youtubeUrl, noCaptionsRetriesLeft });

        const response = await withRetry(
            async () => {
                return await fetch(TRANSCRIPT_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Version': '2',
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
                // API sometimes incorrectly returns "no captions" - retry a few times
                if (noCaptionsRetriesLeft > 0) {
                    log.info(`🔄 Got "no captions" response, retrying (${noCaptionsRetriesLeft} attempts left)...`);
                    await new Promise(resolve => setTimeout(resolve, NO_CAPTIONS_RETRY_DELAY));
                    return fetchTranscriptWithNoCaptionsRetry(youtubeUrl, noCaptionsRetriesLeft - 1);
                }
                log.info('ℹ️ No captions available for this video (confirmed after retries)', errorData);
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
        
        // Check for empty transcript in response body (another form of "no captions")
        if (!data.transcript || data.transcript.trim().length === 0) {
            if (noCaptionsRetriesLeft > 0) {
                log.info(`🔄 Got empty transcript response, retrying (${noCaptionsRetriesLeft} attempts left)...`);
                await new Promise(resolve => setTimeout(resolve, NO_CAPTIONS_RETRY_DELAY));
                return fetchTranscriptWithNoCaptionsRetry(youtubeUrl, noCaptionsRetriesLeft - 1);
            }
            log.info('ℹ️ Empty transcript returned (confirmed after retries)');
            return undefined;
        }

        log.info('✅ Transcript fetched successfully', {
            videoId: data.videoId,
            title: data.title,
            author: data.author,
            durationSeconds: data.durationSeconds,
            transcriptLength: data.transcript?.length || 0,
            segmentsCount: data.segments?.length || 0,
            language: data.language
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


