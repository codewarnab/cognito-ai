/**
 * Transcript Fetching (Transcript-Only Approach)
 * 
 * This module fetches YouTube video transcripts from the transcript API.
 * If transcript is unavailable, it returns an error message instead of
 * falling back to video analysis (per Phase 3 decision - transcript only).
 * 
 * API Response Contract:
 * - Endpoint: POST TRANSCRIPT_API_URL with { url: youtubeUrl }
 * - Response: { duration: number | null, title: string | null, transcript: string | null }
 * - All fields can be null - must handle safely with fallbacks
 */

import { TRANSCRIPT_API_URL } from "@/constants";
import { createLogger } from '~logger';
import type { TranscriptEntry } from "./transcriptCache";

const log = createLogger("TranscriptFetch");

/**
 * Fetch transcript from API (transcript-only, no video analysis fallback)
 * 
 * Process:
 * 1. Call transcript API with video URL
 * 2. If transcript available: Return it with metadata
 * 3. If transcript null/empty: Return error entry
 * 4. If API fails: Return error entry
 * 
 * Handles null values:
 * - title: Falls back to "Untitled Video"
 * - duration: Left as undefined if null
 * - transcript: Returns error if null/empty (no fallback)
 * 
 * @param videoUrl - YouTube video URL
 * @returns TranscriptEntry with transcript or error message
 */
export async function fetchTranscriptDirect(
    videoUrl: string
): Promise<TranscriptEntry> {
    log.info("📝 Fetching transcript from API", { videoUrl });

    try {
        const res = await fetch(TRANSCRIPT_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: videoUrl })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
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

        // Handle null/empty transcript - return error (no fallback)
        if (!data.transcript || data.transcript.trim().length === 0) {
            log.info(
                "ℹ️ No transcript returned from API"
            );
            return createErrorEntry(videoUrl, "No transcript available for this video. The video may not have captions enabled.");
        }

        // API returns duration in minutes (can be null)
        const durationSeconds = data.duration
            ? Math.floor(data.duration * 60)
            : undefined;

        const entry: TranscriptEntry = {
            videoUrl,
            videoId: extractVideoId(videoUrl),
            title: data.title || "Untitled Video",
            durationSeconds,
            transcript: data.transcript
        };

        log.info("✅ Transcript fetched successfully", {
            videoId: entry.videoId,
            title: entry.title,
            transcriptLength: entry.transcript.length,
            durationSeconds: entry.durationSeconds
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

