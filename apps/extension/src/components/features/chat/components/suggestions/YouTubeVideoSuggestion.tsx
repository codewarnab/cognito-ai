/**
 * YouTubeVideoSuggestion Component
 * 
 * Displays a suggestion badge when a YouTube video page is detected in the active tab.
 * Allows users to quickly attach the video transcript with one click.
 * Shows shimmer loading state during fetch operations.
 */

import React, { useEffect } from 'react';
import { YoutubeIcon } from '@assets/icons/chat/youtube';
import { useUINavigationStore, type UINavigationState } from '@/stores';

/** Loading state for the badge */
export type YouTubeBadgeLoadingState = 'idle' | 'fetching' | 'ready';

interface YouTubeVideoSuggestionProps {
    /** Title of the YouTube video */
    videoTitle: string;
    /** Handler called when user clicks to attach the video transcript */
    onAttach: () => void;
    /** Handler called when user dismisses the suggestion */
    onDismiss: () => void;
    /** Loading state: 'idle' (no fetch), 'fetching' (in progress), 'ready' (cached) */
    loadingState?: YouTubeBadgeLoadingState;
    /** Video thumbnail URL (optional, from API) */
    thumbnailUrl?: string;
    /** Video duration in seconds (optional, from API) */
    durationSeconds?: number;
}

/**
 * Format duration from seconds to human-readable string (e.g., "5:32")
 */
function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const YouTubeVideoSuggestion: React.FC<YouTubeVideoSuggestionProps> = ({
    videoTitle,
    onAttach,
    onDismiss,
    loadingState = 'idle',
    thumbnailUrl,
    durationSeconds,
}) => {
    const [thumbnailError, setThumbnailError] = React.useState(false);

    const isFetching = loadingState === 'fetching';
    const hasThumbnail = thumbnailUrl && !thumbnailError;

    // Hide voice-mode-fab when showing YouTube suggestion
    const setVoiceFabVisibility = useUINavigationStore((state: UINavigationState) => state.setVoiceFabVisibility);
    
    useEffect(() => {
        setVoiceFabVisibility(false);
        return () => {
            setVoiceFabVisibility(true);
        };
    }, [setVoiceFabVisibility]);

    // Reset thumbnail error when URL changes
    useEffect(() => {
        setThumbnailError(false);
    }, [thumbnailUrl]);

    const handleThumbnailError = () => {
        setThumbnailError(true);
    };

    // Truncate long video titles for compact display
    const displayTitle = videoTitle.length > 24
        ? `${videoTitle.substring(0, 21)}...`
        : videoTitle;

    return (
        <div
            className="absolute bottom-[calc(100%+6px)] left-3 flex items-center gap-1 bg-gradient-to-br from-[#cc0000] to-[#ff0000] rounded-[10px] shadow-[0_2px_6px_rgba(204,0,0,0.4)] animate-in slide-in-from-bottom-2 fade-in duration-200 z-[100] overflow-hidden opacity-50 transition-opacity hover:opacity-100"
            role="region"
            aria-label="YouTube video suggestion"
        >
            <button
                className="flex items-center gap-1.5 px-2.5 py-1 bg-transparent border-none text-white cursor-pointer text-[11px] font-medium transition-colors duration-150 rounded-l-[10px] hover:bg-white/10 active:bg-white/15 disabled:cursor-default disabled:opacity-80"
                onClick={onAttach}
                disabled={isFetching}
                title={`Attach transcript for: ${videoTitle}`}
                aria-busy={isFetching}
            >
                {hasThumbnail ? (
                    <span className="flex items-center justify-center w-[28px] h-[20px] rounded-[3px] overflow-hidden shrink-0">
                        <img
                            src={thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={handleThumbnailError}
                        />
                    </span>
                ) : (
                    <span className="text-[14px] flex items-center justify-center">
                        <YoutubeIcon size={16} />
                    </span>
                )}

                {isFetching ? (
                    <span className="flex items-center min-w-[80px] h-[14px]">
                        <span
                            className="block w-[80px] h-[12px] bg-white/30 rounded animate-pulse"
                            aria-hidden="true"
                        />
                        <span className="sr-only" aria-live="polite">
                            Fetching transcript...
                        </span>
                    </span>
                ) : (
                    <span className="font-semibold tracking-[0.01em] whitespace-nowrap overflow-hidden text-ellipsis max-w-[400px]">
                        {displayTitle}
                        {durationSeconds !== undefined && (
                            <span className="ml-1.5 px-1 py-px bg-black/25 rounded-[3px] text-[10px] font-medium opacity-90">
                                {formatDuration(durationSeconds)}
                            </span>
                        )}
                    </span>
                )}
            </button>

            {!isFetching && (
                <button
                    type="button"
                    className="bg-white/15 border-none text-white w-4 h-4 rounded-full flex items-center justify-center cursor-pointer text-sm leading-none transition-colors duration-150 p-0 mr-1.5 shrink-0 hover:bg-white/25 active:bg-white/35"
                    onClick={onDismiss}
                    title="Dismiss suggestion"
                    aria-label="Dismiss YouTube video attachment suggestion"
                >
                    ×
                </button>
            )}
        </div>
    );
};
