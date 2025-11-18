import { createLogger } from '../../../../logger';
import { ExternalServiceError, NetworkError, parseError } from '../../../../errors';
import { TRANSCRIPT_API_URL } from '../../../../constants';
import { withRetry, MAX_RETRIES, INITIAL_RETRY_DELAY } from './retry';

const log = createLogger('YouTube-Transcript');

/**
 * Fetch transcript from the deployed API
 * @param youtubeUrl - The YouTube video URL
 * @returns Transcript data or undefined if not available
 */
export async function fetchTranscript(youtubeUrl: string): Promise<{ title: string; duration: number; transcript: string } | undefined> {
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

