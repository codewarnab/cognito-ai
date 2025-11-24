/**
 * Transcript Fetching with Graceful Degradation
 * 
 * This module fetches YouTube video transcripts from the transcript API.
 * If transcript is unavailable (null/empty), it gracefully degrades to
 * video-based analysis using the existing youtubeAgentTool.
 * 
 * API Response Contract:
 * - Endpoint: POST TRANSCRIPT_API_URL with { url: youtubeUrl }
 * - Response: { duration: number | null, title: string | null, transcript: string | null }
 * - All fields can be null - must handle safely with fallbacks
 * 
 * Graceful Degradation:
 * - If transcript is null/empty: Use video-based analysis as fallback
 * - If API fails: Use video-based analysis as fallback
 * - Video analysis produces transcript-like text from existing analyzeYouTubeVideo
 */

import { TRANSCRIPT_API_URL } from "@/constants";
import { createLogger } from '~logger';
import { executeYouTubeAnalysis } from "../youtube/youtubeAgentTool";
import type { TranscriptEntry } from "./transcriptCache";

const log = createLogger("TranscriptFetch");

/**
 * Fetch transcript from API with graceful degradation to video analysis
 * 
 * Process:
 * 1. Call transcript API with video URL
 * 2. If transcript available: Return it with metadata
 * 3. If transcript null/empty: Degrade to video analysis
 * 4. If API fails: Degrade to video analysis
 * 
 * Handles null values:
 * - title: Falls back to "Untitled Video"
 * - duration: Left as undefined if null
 * - transcript: Degrades to video analysis if null/empty
 * 
 * @param videoUrl - YouTube video URL
 * @returns TranscriptEntry with transcript (from API or video analysis)
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
                `⚠️ Transcript API error ${res.status}, degrading to video analysis`,
                data
            );
            return await degradeToVideoAnalysis(videoUrl);
        }

        const data = await res.json();

        // Validate response structure
        if (!data || typeof data !== 'object') {
            log.warn("Invalid API response structure, degrading to video analysis", { data });
            return await degradeToVideoAnalysis(videoUrl);
        }

        // Handle null/empty transcript - degrade to video analysis
        if (!data.transcript || data.transcript.trim().length === 0) {
            log.info(
                "ℹ️ No transcript returned from API, degrading to video analysis"
            );
            return await degradeToVideoAnalysis(videoUrl);
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
            "❌ Transcript API request failed, degrading to video analysis",
            error
        );
        return await degradeToVideoAnalysis(videoUrl);
    }
}

/**
 * Degrade to video-based analysis when transcript is unavailable
 * 
 * Uses existing youtubeAgentTool's analyzeYouTubeVideo function with a
 * comprehensive question to get detailed transcript-like text.
 * 
 * This ensures the workflow continues even when transcripts are unavailable
 * (e.g., videos without captions, private videos, API failures).
 * 
 * @param videoUrl - YouTube video URL
 * @returns TranscriptEntry with video analysis text as transcript
 */
async function degradeToVideoAnalysis(
    videoUrl: string
): Promise<TranscriptEntry> {
    log.info("🎥 Using video-based analysis as fallback", { videoUrl });

    // Call existing video analysis tool with comprehensive question
    // This produces detailed text similar to a transcript
    const question =
        "Please provide a detailed, comprehensive overview of this video's content. Include all major topics discussed, key points made, main arguments, examples given, and important information covered. Be thorough and extract as much detail as possible from the video.";

    try {
        const result = await executeYouTubeAnalysis({
            youtubeUrl: videoUrl,
            question
        });

        if (!result.success || !result.answer || result.answer.trim().length === 0) {
            throw new Error(result.error || "Video analysis produced no content");
        }

        log.info("✅ Video analysis completed as fallback", {
            textLength: result.answer.length
        });

        return {
            videoUrl,
            videoId: extractVideoId(videoUrl),
            title: "Video Analysis",
            durationSeconds: undefined,
            transcript: result.answer
        };
    } catch (error) {
        log.error("❌ Video analysis fallback failed", error);

        // Last resort: return error message as transcript
        // This allows workflow to continue and provide feedback
        return {
            videoUrl,
            videoId: extractVideoId(videoUrl),
            title: "Unable to Analyze Video",
            durationSeconds: undefined,
            transcript: `Unable to analyze video content. Error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
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

