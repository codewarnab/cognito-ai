/**
 * Transcript Types
 * Shared types for YouTube video transcripts
 */

/**
 * Represents a single segment of a video transcript with timing information.
 */
export interface TranscriptSegment {
    /** The text content of the segment */
    text: string;
    /** Start time in seconds */
    start: number;
    /** Duration of the segment in seconds */
    duration: number;
}

/**
 * Request body for fetching a video transcript.
 */
export interface TranscriptRequestBody {
    /** The YouTube video URL */
    url: string;
    /** If true, bypasses the cache and fetches fresh data */
    disableCache?: boolean;
    /** Language code (e.g., 'en', 'es') */
    lang?: string;
}

/**
 * Detailed response containing video metadata and full transcript.
 */
export interface TranscriptResponse {
    /** Unique YouTube video ID */
    videoId: string;
    /** Video title */
    title: string;
    /** Video author/channel name */
    author: string;
    /** URL to the video thumbnail (max resolution) */
    thumbnail: string;
    /** Video description */
    description: string;
    /** Video tags */
    tags: string[];
    /** Duration in minutes (legacy field, use durationSeconds for precision) */
    duration: number;
    /** Duration in seconds */
    durationSeconds: number;
    /** Full concatenated transcript text */
    transcript: string;
    /** Array of transcript segments with timestamps */
    segments: TranscriptSegment[];
    /** Language code of the transcript */
    language: string;
}

/**
 * Legacy transcript response format
 */
export interface TranscriptLegacyResponse {
    /** Duration in minutes */
    duration: number;
    /** Video title */
    title: string;
    /** Full transcript text */
    transcript: string;
}

/**
 * Basic metadata information for a YouTube video.
 */
export interface VideoInfo {
    /** Video title */
    title: string;
    /** Video author/channel name */
    author: string;
    /** URL to the video thumbnail */
    thumbnail: string;
    /** Duration in seconds */
    duration: number;
    /** Video description */
    description: string;
    /** Video tags */
    tags: string[];
}
