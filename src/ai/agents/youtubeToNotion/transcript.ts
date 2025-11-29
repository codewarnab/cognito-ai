/**
 * Transcript Fetching (Transcript-Only Approach)
 * 
 * This module fetches YouTube video transcripts from the transcript API.
 * If transcript is unavailable, it returns an error message instead of
 * falling back to video analysis (per Phase 3 decision - transcript only).
 * 
 * API Response Contract (v2 - Supadata):
 * - Endpoint: POST TRANSCRIPT_API_URL with { url: youtubeUrl, lang?: string }
 * - Response: {
 *     videoId: string,
 *     title: string,
 *     author: string,
 *     thumbnail: string,
 *     description: string,
 *     tags: string[],
 *     duration: number (minutes - legacy),
 *     durationSeconds: number,
 *     transcript: string,
 *     segments: Array<{ text: string, start: number, duration: number }>,
 *     language: string
 *   }
 * 
 * Retry Logic:
 * - API sometimes incorrectly returns "no captions" for videos that have captions
 * - Retry up to 3 times with 1.5s delay before giving up on 404 responses
 */

import { TRANSCRIPT_API_URL } from "@/constants";
import { createLogger } from '~logger';
import type { TranscriptEntry, TranscriptSegment } from "./transcriptCache";

const log = createLogger("TranscriptFetch");

/** Max retries for "no captions" responses (API sometimes returns this incorrectly) */
const NO_CAPTIONS_MAX_RETRIES = 3;
const NO_CAPTIONS_RETRY_DELAY = 1500;

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
 * Processed transcript optimized for AI consumption
 */
export interface ProcessedTranscript {
    videoId: string;
    title: string;
    author?: string;
    durationSeconds?: number;
    language?: string;
    /** Compact segments with text and start time only */
    segments: CompactSegment[];
    /** Hint for AI to reference timestamps when needed */
    _note: string;
}

/**
 * Process TranscriptEntry into compact format for AI consumption
 * - Uses only segments (not full transcript) to avoid duplication
 * - Compacts segment format: { t: text, s: startSeconds }
 * - Significantly reduces token usage while preserving all content
 */
export function processTranscriptForAI(entry: TranscriptEntry): ProcessedTranscript {
    const compactSegments: CompactSegment[] = (entry.segments || []).map(seg => ({
        t: seg.text.trim(),
        s: Math.floor(seg.start)
    }));

    return {
        videoId: entry.videoId,
        title: entry.title || 'Untitled Video',
        author: entry.author,
        durationSeconds: entry.durationSeconds,
        language: entry.language,
        segments: compactSegments,
        _note: 'Reference timestamps (s) when user needs to verify specific parts'
    };
}

/**
 * Fetch transcript from API (transcript-only, no video analysis fallback)
 * 
 * Process:
 * 1. Call transcript API with video URL
 * 2. If 404 "no captions": Retry up to 3 times (API sometimes returns this incorrectly)
 * 3. If transcript available: Return it with metadata
 * 4. If transcript null/empty after retries: Return error entry
 * 5. If API fails: Return error entry
 * 
 * @param videoUrl - YouTube video URL
 * @returns TranscriptEntry with transcript or error message
 */
export async function fetchTranscriptDirect(
    videoUrl: string
): Promise<TranscriptEntry> {
    return fetchTranscriptWithRetry(videoUrl, NO_CAPTIONS_MAX_RETRIES);
}

/**
 * Internal fetch with retry logic for "no captions" responses
 */
async function fetchTranscriptWithRetry(
    videoUrl: string,
    retriesLeft: number
): Promise<TranscriptEntry> {
    log.info("📝 Fetching transcript from API", { videoUrl, retriesLeft });

    try {
        const res = await fetch(TRANSCRIPT_API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "X-API-Version": "2"
            },
            body: JSON.stringify({ url: videoUrl })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            
            // Handle 404 "no captions" - retry as API sometimes returns this incorrectly
            if (res.status === 404 && retriesLeft > 0) {
                log.info(`🔄 Got "no captions" response, retrying (${retriesLeft} attempts left)...`);
                await new Promise(resolve => setTimeout(resolve, NO_CAPTIONS_RETRY_DELAY));
                return fetchTranscriptWithRetry(videoUrl, retriesLeft - 1);
            }
            
            log.warn(
                `⚠️ Transcript API error ${res.status}`,
                data
            );
            return createErrorEntry(videoUrl, `Transcript API error: ${res.status}`);
        }

        const data = await res.json();

        // Validate response structure
        if (!data || typeof data !== 'object') {
            log.warn("Invalid API response structure", { data });
            return createErrorEntry(videoUrl, "Invalid API response structure");
        }

        // Handle null/empty transcript - retry as API sometimes returns empty incorrectly
        if (!data.transcript || data.transcript.trim().length === 0) {
            if (retriesLeft > 0) {
                log.info(`🔄 Got empty transcript, retrying (${retriesLeft} attempts left)...`);
                await new Promise(resolve => setTimeout(resolve, NO_CAPTIONS_RETRY_DELAY));
                return fetchTranscriptWithRetry(videoUrl, retriesLeft - 1);
            }
            log.info("ℹ️ No transcript returned from API (confirmed after retries)");
            return createErrorEntry(videoUrl, "No transcript available for this video. The video may not have captions enabled.");
        }

        // API v2 returns durationSeconds directly, with duration in minutes as legacy
        const durationSeconds = data.durationSeconds ?? (data.duration ? Math.floor(data.duration * 60) : undefined);

        const entry: TranscriptEntry = {
            videoUrl,
            videoId: data.videoId || extractVideoId(videoUrl),
            title: data.title || "Untitled Video",
            durationSeconds,
            transcript: data.transcript,
            // New v2 fields
            author: data.author,
            thumbnail: data.thumbnail,
            description: data.description,
            tags: data.tags,
            segments: data.segments,
            language: data.language
        };

        log.info("✅ Transcript fetched successfully", {
            videoId: entry.videoId,
            title: entry.title,
            author: entry.author,
            transcriptLength: entry.transcript.length,
            segmentsCount: entry.segments?.length ?? 0,
            durationSeconds: entry.durationSeconds,
            language: entry.language
        });

        return entry;
    } catch (error) {
        log.error(
            "❌ Transcript API request failed",
            error
        );
        return createErrorEntry(videoUrl, `Failed to fetch transcript: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Create an error entry when transcript is unavailable
 * 
 * @param videoUrl - YouTube video URL
 * @param errorMessage - Error message to include
 * @returns TranscriptEntry with error message as transcript
 */
function createErrorEntry(videoUrl: string, errorMessage: string): TranscriptEntry {
    log.info("⚠️ Creating error entry", { videoUrl, errorMessage });

    return {
        videoUrl,
        videoId: extractVideoId(videoUrl),
        title: "Transcript Unavailable",
        durationSeconds: undefined,
        transcript: `⚠️ ${errorMessage}`
    };
}

/**
 * Extract YouTube video ID from URL
 * 
 * Handles various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - Fallback: base64 hash of URL
 * 
 * @param url - YouTube video URL
 * @returns Video ID string
 */
function extractVideoId(url: string): string {
    try {
        const u = new URL(url);

        // Standard YouTube URL: youtube.com/watch?v=ID
        const id = u.searchParams.get("v");
        if (id) return id;

        // Short URL: youtu.be/ID
        if (u.hostname.includes("youtu.be")) {
            return u.pathname.replace("/", "");
        }

        // Fallback: hash the URL
        return Buffer.from(url).toString("base64").slice(0, 16);
    } catch {
        // Invalid URL: hash it
        return Buffer.from(url).toString("base64").slice(0, 16);
    }
}

