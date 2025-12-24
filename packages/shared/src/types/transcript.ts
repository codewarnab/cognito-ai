/**
 * Transcript Types
 * Shared types for YouTube video transcripts
 */

/**
 * Represents a single segment of a video transcript with timing information.
 */
export interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}

/**
 * Request body for fetching a video transcript.
 */
export interface TranscriptRequestBody {
    url: string;
    disableCache?: boolean;
    lang?: string;
}

/**
 * Detailed response containing video metadata and full transcript.
 */
export interface TranscriptResponse {
    videoId: string;
    title: string;
    author: string;
    thumbnail: string;
    description: string;
    tags: string[];
    duration: number;
    durationSeconds: number;
    transcript: string;
    segments: TranscriptSegment[];
    language: string;
}

/**
 * Legacy transcript response format
 */
export interface TranscriptLegacyResponse {
    duration: number;
    title: string;
    transcript: string;
}

/**
 * Basic metadata information for a YouTube video.
 */
export interface VideoInfo {
    title: string;
    author: string;
    thumbnail: string;
    duration: number;
    description: string;
    tags: string[];
}
