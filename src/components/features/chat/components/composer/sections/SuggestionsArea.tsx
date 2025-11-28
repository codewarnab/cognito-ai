import React from 'react';
import { LocalPdfSuggestion } from '../../suggestions/LocalPdfSuggestion';
import { YouTubeVideoSuggestion } from '../../suggestions/YouTubeVideoSuggestion';
import type { LocalPdfInfo, YouTubeVideoInfo } from '@/hooks/browser';

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
    handleAttachYouTubeVideo: () => void;
    handleDismissYouTubeVideo: () => void;
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
    handleAttachYouTubeVideo,
    handleDismissYouTubeVideo
}) => {
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
                    isLoading={isAttachingVideo}
                />
            )}
        </>
    );
};

