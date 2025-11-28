import { useState, useCallback, useEffect, useRef } from 'react';
import { createLogger } from '~logger';
import { fetchTranscriptDirect } from '@/ai/agents/youtubeToNotion/transcript';
import type { YouTubeVideoInfo } from '../browser';
import type { AIMode } from '@/components/features/chat/types';

const log = createLogger('useYouTubeVideoAttachment');

interface UseYouTubeVideoAttachmentOptions {
    youtubeVideoInfo?: YouTubeVideoInfo | null;
    mode: AIMode;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
    processFiles: (files: File[]) => Promise<void>;
}

/**
 * Storage key for dismissed YouTube videos
 */
const DISMISSED_VIDEOS_KEY = 'dismissedYouTubeVideos';

/**
 * Transcript segment with timing information
 */
interface TranscriptSegment {
    /** Segment text */
    text: string;
    /** Start time in seconds */
    start: number;
    /** Duration in seconds */
    duration: number;
}

/**
 * Cached transcript data
 */
interface CachedTranscript {
    videoId: string;
    title?: string;
    videoUrl: string;
    transcript: string;
    durationSeconds?: number;
    fetchedAt: number;
    /** Channel/author name */
    author?: string;
    /** Video thumbnail URL */
    thumbnail?: string;
    /** Video description */
    description?: string;
    /** Video tags/keywords */
    tags?: string[];
    /** Timestamped transcript segments */
    segments?: TranscriptSegment[];
    /** Detected transcript language */
    language?: string;
}

/**
 * Check if a video has been dismissed
 */
function isVideoDismissed(videoId: string): boolean {
    try {
        const dismissed = localStorage.getItem(DISMISSED_VIDEOS_KEY);
        if (!dismissed) return false;

        const dismissedVideos = JSON.parse(dismissed) as Record<string, number>;
        const dismissedTime = dismissedVideos[videoId];

        if (!dismissedTime) return false;

        // Auto-expire dismissals after 24 hours
        const hoursSinceDismissal = (Date.now() - dismissedTime) / (1000 * 60 * 60);
        return hoursSinceDismissal < 24;
    } catch (error) {
        log.error('Error checking dismissed videos', error);
        return false;
    }
}

/**
 * Mark a video as dismissed
 */
function dismissVideo(videoId: string): void {
    try {
        const dismissed = localStorage.getItem(DISMISSED_VIDEOS_KEY);
        const dismissedVideos = dismissed ? JSON.parse(dismissed) : {};

        dismissedVideos[videoId] = Date.now();
        localStorage.setItem(DISMISSED_VIDEOS_KEY, JSON.stringify(dismissedVideos));
    } catch (error) {
        log.error('Error dismissing video', error);
    }
}

export const useYouTubeVideoAttachment = ({
    youtubeVideoInfo,
    mode,
    onError,
    processFiles,
}: UseYouTubeVideoAttachmentOptions) => {
    const [isAttachingVideo, setIsAttachingVideo] = useState(false);
    const [dismissedVideoId, setDismissedVideoId] = useState<string | null>(null);
    const [isFetchingInBackground, setIsFetchingInBackground] = useState(false);
    const cachedTranscriptRef = useRef<CachedTranscript | null>(null);
    const currentVideoIdRef = useRef<string | null>(null);

    // Reset dismissedVideoId and clear cache when video changes
    useEffect(() => {
        const currentVideoId = youtubeVideoInfo?.videoId;

        // Reset dismissed state if video changed
        if (currentVideoId && dismissedVideoId && dismissedVideoId !== currentVideoId) {
            log.info('Video changed, resetting dismissed state', {
                oldVideoId: dismissedVideoId,
                newVideoId: currentVideoId
            });
            setDismissedVideoId(null);
        }

        // Clear cache if video changed or no video
        if (!currentVideoId || (cachedTranscriptRef.current && cachedTranscriptRef.current.videoId !== currentVideoId)) {
            if (cachedTranscriptRef.current) {
                log.info('Video changed, clearing cached transcript', {
                    oldVideoId: cachedTranscriptRef.current.videoId,
                    newVideoId: currentVideoId
                });
            }
            cachedTranscriptRef.current = null;
            setIsFetchingInBackground(false);
        }

        // Update current video ID ref
        currentVideoIdRef.current = currentVideoId || null;
    }, [youtubeVideoInfo?.videoId, dismissedVideoId]);

    // Prefetch transcript in background when YouTube video is detected
    useEffect(() => {
        const prefetchTranscript = async () => {
            if (!youtubeVideoInfo || mode === 'local') {
                return;
            }

            const videoId = youtubeVideoInfo.videoId;

            // Skip if already fetching or if we already have this video cached
            if (
                isFetchingInBackground ||
                (cachedTranscriptRef.current?.videoId === videoId)
            ) {
                return;
            }

            // Skip if video is dismissed
            if (isVideoDismissed(videoId)) {
                return;
            }

            log.info('Prefetching YouTube transcript in background', {
                videoId,
                url: youtubeVideoInfo.url
            });

            setIsFetchingInBackground(true);

            try {
                const transcriptEntry = await fetchTranscriptDirect(youtubeVideoInfo.url);

                // Only cache if this is still the current video
                if (currentVideoIdRef.current === videoId) {
                    cachedTranscriptRef.current = {
                        videoId,
                        title: transcriptEntry.title,
                        videoUrl: transcriptEntry.videoUrl,
                        transcript: transcriptEntry.transcript,
                        durationSeconds: transcriptEntry.durationSeconds,
                        fetchedAt: Date.now(),
                    };

                    log.info('Transcript prefetched successfully', {
                        videoId,
                        transcriptLength: transcriptEntry.transcript.length
                    });
                }
            } catch (error) {
                log.error('Failed to prefetch transcript', error);
                // Don't show error to user since this is background fetch
                // Error will be shown if user clicks attach and it fails
            } finally {
                setIsFetchingInBackground(false);
            }
        };

        prefetchTranscript();
    }, [youtubeVideoInfo, mode, isFetchingInBackground]);

    // Handle dismissing the YouTube video suggestion
    const handleDismissYouTubeVideo = useCallback(() => {
        if (!youtubeVideoInfo) return;

        // Mark as dismissed in localStorage
        dismissVideo(youtubeVideoInfo.videoId);

        // Update local state to hide the badge immediately
        setDismissedVideoId(youtubeVideoInfo.videoId);

        // Clear cached transcript for this video
        if (cachedTranscriptRef.current?.videoId === youtubeVideoInfo.videoId) {
            cachedTranscriptRef.current = null;
        }
    }, [youtubeVideoInfo]);

    // Handle attaching YouTube video transcript
    const handleAttachYouTubeVideo = useCallback(async () => {
        if (!youtubeVideoInfo) return;

        const videoId = youtubeVideoInfo.videoId;

        // Check if we have cached transcript
        const cachedTranscript = cachedTranscriptRef.current;
        const hasCachedTranscript = cachedTranscript?.videoId === videoId;

        // If still fetching in background, show loading state
        if (isFetchingInBackground && !hasCachedTranscript) {
            setIsAttachingVideo(true);
        }

        try {
            let transcriptEntry;

            if (hasCachedTranscript) {
                // Use cached transcript - instant attach!
                log.info('Using cached transcript', { videoId });
                transcriptEntry = cachedTranscript;
            } else {
                // Need to fetch (shouldn't happen often due to prefetch)
                log.info('Fetching YouTube video transcript', {
                    videoId: youtubeVideoInfo.videoId,
                    url: youtubeVideoInfo.url
                });

                setIsAttachingVideo(true);
                transcriptEntry = await fetchTranscriptDirect(youtubeVideoInfo.url);
            }

            // Create transcript text file with description
            const transcriptText = `[YOUTUBE VIDEO TRANSCRIPT]
Title: ${transcriptEntry.title || youtubeVideoInfo.title}
Video URL: ${transcriptEntry.videoUrl}
Duration: ${transcriptEntry.durationSeconds ? `${Math.floor(transcriptEntry.durationSeconds / 60)}m ${transcriptEntry.durationSeconds % 60}s` : 'Unknown'}

IMPORTANT: This is a YouTube video transcript. Do NOT use the getYouTubeTranscript tool to fetch the transcript again. 
Answer questions based ONLY on this transcript content provided below.

--- TRANSCRIPT START ---

${transcriptEntry.transcript}

--- TRANSCRIPT END ---`;

            // Create a text file with the transcript - use title from active tab (shown in pill)
            const blob = new Blob([transcriptText], { type: 'text/plain' });
            const cleanTitle = youtubeVideoInfo.title
                .replace(/[^a-z0-9\s]/gi, '')
                .trim()
                .replace(/\s+/g, '_')
                .substring(0, 24);
            // Add _yt suffix to identify as YouTube transcript
            const filename = `${cleanTitle}_yt.txt`;
            const file = new File([blob], filename, {
                type: 'text/plain',
                lastModified: Date.now()
            });

            log.info('Created transcript file', {
                filename,
                size: file.size,
                transcriptLength: transcriptEntry.transcript.length
            });

            // Use existing processFiles function to handle the attachment
            await processFiles([file]);

            // Auto-dismiss suggestion after successful attachment
            handleDismissYouTubeVideo();

            // Show success message
            const displayTitle = youtubeVideoInfo.title.length > 30
                ? youtubeVideoInfo.title.substring(0, 30) + '...'
                : youtubeVideoInfo.title;
            onError?.(`Attached transcript for "${displayTitle}"`, 'info');

        } catch (error) {
            log.error('Error attaching YouTube video transcript', error);
            onError?.(
                'Failed to fetch video transcript. Please try again or ask about the video directly.',
                'error'
            );
        } finally {
            setIsAttachingVideo(false);
        }
    }, [youtubeVideoInfo, onError, processFiles, isFetchingInBackground, handleDismissYouTubeVideo]);

    // Check if we should show the YouTube video suggestion
    const shouldShowYouTubeVideoSuggestion =
        youtubeVideoInfo &&
        mode !== 'local' && // Don't show in local mode (attachments not supported)
        !isVideoDismissed(youtubeVideoInfo.videoId) &&
        dismissedVideoId !== youtubeVideoInfo.videoId;

    return {
        isAttachingVideo,
        shouldShowYouTubeVideoSuggestion,
        handleAttachYouTubeVideo,
        handleDismissYouTubeVideo,
        isFetchingInBackground, // Expose for debugging/UI purposes
    };
};
