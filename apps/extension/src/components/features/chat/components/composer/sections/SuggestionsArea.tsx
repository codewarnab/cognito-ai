import React from 'react';
import { LocalPdfSuggestion } from '../../suggestions/LocalPdfSuggestion';
import { YouTubeVideoSuggestion, type YouTubeBadgeLoadingState } from '../../suggestions/YouTubeVideoSuggestion';
import { SelectedTextSuggestion } from '../../suggestions/SelectedTextSuggestion';
import { useAttachmentsStore, useCodeModeStore } from '@/stores';

interface SuggestionsAreaProps {
    /** Handler to attach local PDF - requires processFiles from parent */
    onAttachLocalPdf: () => void;
    /** Handler to attach YouTube video - requires processFiles from parent */
    onAttachYouTubeVideo: () => void;
    /** Handler to attach selected text - requires processFiles from parent */
    onAttachSelectedText: () => void;
}

/**
 * Derive loading state for YouTube badge from store state
 */
function deriveYouTubeLoadingState(
    isAttaching: boolean,
    isFetching: boolean,
    isPrefetched: boolean
): YouTubeBadgeLoadingState {
    if (isAttaching) return 'fetching';
    if (isPrefetched) return 'ready';
    if (isFetching) return 'fetching';
    return 'idle';
}

/**
 * Area displaying contextual suggestions for local PDFs, YouTube videos, and selected text.
 * Selected text suggestion takes priority and hides other suggestions when visible.
 * Uses Zustand store for state management.
 */
export const SuggestionsArea: React.FC<SuggestionsAreaProps> = ({
    onAttachLocalPdf,
    onAttachYouTubeVideo,
    onAttachSelectedText,
}) => {
    // Local PDF state from store
    const localPdfInfo = useAttachmentsStore((s) => s.localPdfInfo);
    const isLocalPdfDismissed = useAttachmentsStore((s) => s.isLocalPdfDismissed);
    const isAttachingLocalPdf = useAttachmentsStore((s) => s.isAttachingLocalPdf);
    const dismissLocalPdf = useAttachmentsStore((s) => s.dismissLocalPdf);

    // YouTube state from store
    const youtubeVideoInfo = useAttachmentsStore((s) => s.youtubeVideoInfo);
    const isYouTubeDismissed = useAttachmentsStore((s) => s.isYouTubeDismissed);
    const isAttachingYouTube = useAttachmentsStore((s) => s.isAttachingYouTube);
    const isFetchingYouTubeMetadata = useAttachmentsStore((s) => s.isFetchingYouTubeMetadata);
    const youtubeMetadata = useAttachmentsStore((s) => s.youtubeMetadata);
    const dismissYouTubeVideo = useAttachmentsStore((s) => s.dismissYouTubeVideo);

    // Selected text state from store
    const selectedTextInfo = useAttachmentsStore((s) => s.selectedTextInfo);
    const isSelectedTextDismissed = useAttachmentsStore((s) => s.isSelectedTextDismissed);
    const isAttachingSelectedText = useAttachmentsStore((s) => s.isAttachingSelectedText);
    const dismissSelectedText = useAttachmentsStore((s) => s.dismissSelectedText);
    // File attachments to check if YouTube video is already attached
    const fileAttachments = useAttachmentsStore((s) => s.fileAttachments);

    // Code mode element context - hide suggestions when element is selected
    const elementContext = useCodeModeStore((s) => s.elementContext);

    // Hide all suggestions when an element is selected in code mode
    if (elementContext) {
        return null;
    }

    // Check if a YouTube video is already attached
    const hasYouTubeAttached = fileAttachments.some((att) =>
        att.file.name.endsWith('_yt.txt') || att.meta?.source === 'youtube'
    );

    // Derive visibility
    const shouldShowLocalPdfSuggestion = !!localPdfInfo && !isLocalPdfDismissed;
    // Hide YouTube suggestion if video is already attached
    const shouldShowYouTubeVideoSuggestion = !!youtubeVideoInfo && !isYouTubeDismissed && !hasYouTubeAttached;
    const shouldShowSelectedTextSuggestion = !!selectedTextInfo && !isSelectedTextDismissed;

    const youtubeLoadingState = deriveYouTubeLoadingState(
        isAttachingYouTube,
        isFetchingYouTubeMetadata,
        youtubeMetadata?.isPrefetched ?? false
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
                    onAttach={onAttachSelectedText}
                    onDismiss={dismissSelectedText}
                    isLoading={isAttachingSelectedText}
                />
            )}

            {/* Local PDF Suggestion - shows when local PDF is detected and no selected text */}
            {showLocalPdf && (
                <LocalPdfSuggestion
                    filename={localPdfInfo.filename}
                    onAttach={onAttachLocalPdf}
                    onDismiss={dismissLocalPdf}
                    isLoading={isAttachingLocalPdf}
                />
            )}

            {/* YouTube Video Suggestion - shows when YouTube video is detected and no selected text */}
            {showYouTube && (
                <YouTubeVideoSuggestion
                    key={youtubeVideoInfo.videoId}
                    videoTitle={youtubeVideoInfo.title}
                    onAttach={onAttachYouTubeVideo}
                    onDismiss={dismissYouTubeVideo}
                    loadingState={youtubeLoadingState}
                    thumbnailUrl={youtubeMetadata?.thumbnail}
                    durationSeconds={youtubeMetadata?.durationSeconds}
                />
            )}
        </>
    );
};
