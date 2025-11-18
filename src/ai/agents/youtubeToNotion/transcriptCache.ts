/**
 * Transcript Cache - Run-Scoped In-Memory Cache
 * 
 * This module provides a run-scoped cache for YouTube video transcripts.
 * Key behaviors:
 * - Always refetches transcript at the start of each workflow run
 * - Caches transcript for duration of workflow execution
 * - Guarantees cleanup in finally block after workflow completes
 * - Keys by videoId (not full URL) for normalization
 * - Supports concurrent runs of different videos in different browser windows
 * 
 * Edge case handling:
 * - Same video running in parallel in two windows: each gets own cache entry,
 *   last to finish cleans up (graceful handling, no errors)
 */

import { createLogger } from "../../../logger";

const log = createLogger("TranscriptCache");

/**
 * Transcript entry stored in cache
 */
export interface TranscriptEntry {
    /** Original video URL */
    videoUrl: string;

    /** Extracted video ID (used as cache key) */
    videoId: string;

    /** Video title (may be undefined if API returns null) */
    title?: string;

    /** Video duration in seconds (may be undefined if API returns null) */
    durationSeconds?: number;

    /** Video transcript text (required) */
    transcript: string;
}

/**
 * Run-scoped cache storage
 * Maps videoId -> TranscriptEntry
 */
const runCache = new Map<string, TranscriptEntry>();

/**
 * Extract YouTube video ID from URL
 * Handles various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - Fallback: base64 hash of URL
 * 
 * @param url - YouTube video URL
 * @returns Video ID string
 */
function getVideoId(url: string): string {
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

/**
 * Get cache key from video URL
 * Normalizes URL to videoId for consistent cache lookups
 * 
 * @param videoUrl - YouTube video URL
 * @returns Cache key (videoId)
 */
export function getCacheKey(videoUrl: string): string {
    return getVideoId(videoUrl);
}

/**
 * Get cached transcript entry
 * 
 * @param videoUrl - YouTube video URL
 * @returns TranscriptEntry if cached, undefined otherwise
 */
export function getCachedTranscript(
    videoUrl: string
): TranscriptEntry | undefined {
    const key = getCacheKey(videoUrl);
    return runCache.get(key);
}

/**
 * Set cached transcript entry
 * 
 * @param entry - TranscriptEntry to cache
 */
export function setCachedTranscript(entry: TranscriptEntry): void {
    const key = getCacheKey(entry.videoUrl);
    runCache.set(key, entry);

    log.info("📦 Transcript cached", {
        videoId: entry.videoId,
        title: entry.title,
        durationSeconds: entry.durationSeconds,
        transcriptLength: entry.transcript.length
    });
}

/**
 * Clear cached transcript entry
 * 
 * @param videoUrl - YouTube video URL
 */
export function clearCachedTranscript(videoUrl: string): void {
    const key = getCacheKey(videoUrl);
    const wasDeleted = runCache.delete(key);

    if (wasDeleted) {
        log.info("🧹 Transcript cache cleared", { videoId: key });
    }
}

/**
 * Run workflow with transcript cache management
 * 
 * This function:
 * 1. Always refetches transcript at start (deletes any existing cache entry)
 * 2. Calls fetcher function to get fresh transcript
 * 3. Caches transcript for duration of workflow
 * 4. Executes workflow function with cached transcript
 * 5. Guarantees cleanup in finally block (removes cache entry)
 * 
 * Cache lifecycle:
 * - Entry created: At workflow start (after fetch)
 * - Entry used: Throughout workflow execution
 * - Entry removed: In finally block (success or failure)
 * 
 * Concurrency:
 * - Different videos in different windows: Separate cache entries (no conflict)
 * - Same video in different windows: Each gets own cache entry, last to finish cleans up
 * 
 * @param videoUrl - YouTube video URL
 * @param fetcher - Function to fetch transcript (called once per run)
 * @param fn - Workflow function to execute with cached transcript
 * @returns Result from workflow function
 */
export async function withTranscriptCache<T>(
    videoUrl: string,
    fetcher: () => Promise<TranscriptEntry>,
    fn: (entry: TranscriptEntry) => Promise<T>
): Promise<T> {
    const key = getCacheKey(videoUrl);

    // Always refetch at start of workflow run (per requirements)
    if (runCache.has(key)) {
        log.info("🔄 Clearing existing cache entry for fresh fetch", { videoId: key });
        runCache.delete(key);
    }

    log.info("📝 Fetching transcript for new workflow run", { videoUrl });

    // Fetch fresh transcript
    const entry = await fetcher();

    // Cache for duration of workflow
    setCachedTranscript(entry);

    try {
        // Execute workflow with cached transcript
        return await fn(entry);
    } finally {
        // Guaranteed cleanup: remove cache entry after workflow completes
        log.info("🧹 Disposing transcript cache for completed run", { videoUrl });
        clearCachedTranscript(videoUrl);
    }
}
