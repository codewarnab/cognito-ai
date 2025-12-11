import React from 'react';
import { LocalPdfSuggestion } from '../../suggestions/LocalPdfSuggestion';
import { YouTubeVideoSuggestion, type YouTubeBadgeLoadingState } from '../../suggestions/YouTubeVideoSuggestion';
import { SelectedTextSuggestion } from '../../suggestions/SelectedTextSuggestion';
import type { LocalPdfInfo, YouTubeVideoInfo, SelectedTextInfo } from '@/hooks/browser';
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
    // Selected Text
    selectedTextInfo?: SelectedTextInfo | null;
    shouldShowSelectedTextSuggestion: boolean;
    isAttachingSelectedText: boolean;
    handleAttachSelectedText: () => void;
    handleDismissSelectedText: () => void;
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
 * Area displaying contextual suggestions for local PDFs, YouTube videos, and selected text.
 * Selected text suggestion takes priority and hides other suggestions when visible.
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
    selectedTextInfo,
    shouldShowSelectedTextSuggestion,
    isAttachingSelectedText,
    handleAttachSelectedText,
    handleDismissSelectedText,
}) => {
    const youtubeLoadingState = deriveYouTubeLoadingState(
        isAttachingVideo,
        isFetchingInBackground,
        videoMetadata?.isPrefetched ?? false
    );

    // When selected text suggestion is shown, hide other suggestions
    const showSelectedText = shouldShowSelectedTextSuggestion && selectedTextInfo;
    const showLocalPdf = !showSelectedText && shouldShowLocalPdfSuggestion && localPdfInfo;
    const showYouTube = !showSelectedText && shouldShowYouTubeVideoSuggestion && youtubeVideoInfo;

    return (
        <>
            {/* Selected Text Suggestion - takes priority over other suggestions */}
            {showSelectedText && (
                <SelectedTextSuggestion
                    textPreview={selectedTextInfo.text}
                    textLength={selectedTextInfo.text.length}
                    onAttach={handleAttachSelectedText}
                    onDismiss={handleDismissSelectedText}
                    isLoading={isAttachingSelectedText}
                />
            )}

            {/* Local PDF Suggestion - shows when local PDF is detected and no selected text */}
            {showLocalPdf && (
                <LocalPdfSuggestion
                    filename={localPdfInfo.filename}
                    onAttach={handleAttachLocalPdf}
                    onDismiss={handleDismissLocalPdf}
                    isLoading={isAttachingLocalPdf}
                />
            )}

            {/* YouTube Video Suggestion - shows when YouTube video is detected and no selected text */}
            {showYouTube && (
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
