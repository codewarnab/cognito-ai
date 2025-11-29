import React from 'react';
import { LocalPdfSuggestion } from '../../suggestions/LocalPdfSuggestion';
import { YouTubeVideoSuggestion, type YouTubeBadgeLoadingState } from '../../suggestions/YouTubeVideoSuggestion';
import type { LocalPdfInfo, YouTubeVideoInfo } from '@/hooks/browser';
import type { YouTubeVideoMetadata } from '@/hooks/attachments/useYouTubeVideoAttachment';

interface SuggestionsAreaProps {
    // Local PDF
    localPdfInfo?: LocalPdfInfo | null;
    shouldShowLocalPdfSuggestion: boolean;
    isAttachingLocalPdf: boolean;
    handleAttachLocalPdf: () => void;
    handleDismissLocalPdf: () => void;
    // YouTube Video
    youtubeVideoInfo?: YouTubeVideoInfo | null;
    shouldShowYouTubeVideoSuggestion: boolean;
    isAttachingVideo: boolean;
    isFetchingInBackground?: boolean;
    handleAttachYouTubeVideo: () => void;
    handleDismissYouTubeVideo: () => void;
    /** Video metadata from API (thumbnail, author, duration) */
    videoMetadata?: YouTubeVideoMetadata | null;
}

/**
 * Derive loading state for YouTube badge from component state
 */
function deriveYouTubeLoadingState(
    isAttaching: boolean,
    isFetchingInBackground: boolean,
    isPrefetched: boolean
): YouTubeBadgeLoadingState {
    if (isAttaching) return 'fetching';
    if (isPrefetched) return 'ready';
    if (isFetchingInBackground) return 'fetching';
    return 'idle';
}

/**
 * Area displaying contextual suggestions for local PDFs and YouTube videos.
 */
export const SuggestionsArea: React.FC<SuggestionsAreaProps> = ({
    localPdfInfo,
    shouldShowLocalPdfSuggestion,
    isAttachingLocalPdf,
    handleAttachLocalPdf,
    handleDismissLocalPdf,
    youtubeVideoInfo,
    shouldShowYouTubeVideoSuggestion,
    isAttachingVideo,
    isFetchingInBackground = false,
    handleAttachYouTubeVideo,
    handleDismissYouTubeVideo,
    videoMetadata,
}) => {
    const youtubeLoadingState = deriveYouTubeLoadingState(
        isAttachingVideo,
        isFetchingInBackground,
        videoMetadata?.isPrefetched ?? false
    );

    return (
        <>
            {/* Local PDF Suggestion - shows when local PDF is detected */}
            {shouldShowLocalPdfSuggestion && localPdfInfo && (
                <LocalPdfSuggestion
                    filename={localPdfInfo.filename}
                    onAttach={handleAttachLocalPdf}
                    onDismiss={handleDismissLocalPdf}
                    isLoading={isAttachingLocalPdf}
                />
            )}

            {/* YouTube Video Suggestion - shows when YouTube video is detected */}
            {shouldShowYouTubeVideoSuggestion && youtubeVideoInfo && (
                <YouTubeVideoSuggestion
                    key={youtubeVideoInfo.videoId}
                    videoTitle={youtubeVideoInfo.title}
                    onAttach={handleAttachYouTubeVideo}
                    onDismiss={handleDismissYouTubeVideo}
                    loadingState={youtubeLoadingState}
                    thumbnailUrl={videoMetadata?.thumbnail}
                    author={videoMetadata?.author}
                    durationSeconds={videoMetadata?.durationSeconds}
                    isPrefetched={videoMetadata?.isPrefetched}
                />
            )}
        </>
    );
};

