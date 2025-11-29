/**
 * YouTubeVideoSuggestion Component
 * 
 * Displays a suggestion badge when a YouTube video page is detected in the active tab.
 * Allows users to quickly attach the video transcript with one click.
 * Shows shimmer loading state during fetch operations.
 */

import React, { useEffect } from 'react';
import { YoutubeIcon } from '@assets/icons/chat/youtube';

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
    /** Channel/author name (optional, from API) */
    author?: string;
    /** Video duration in seconds (optional, from API) */
    durationSeconds?: number;
    /** Whether transcript is already prefetched/cached */
    isPrefetched?: boolean;
    /** @deprecated Use loadingState instead */
    isLoading?: boolean;
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
    loadingState,
    thumbnailUrl,
    author,
    durationSeconds,
    isPrefetched = false,
    isLoading = false,
}) => {
    const [thumbnailError, setThumbnailError] = React.useState(false);

    // Derive effective loading state from props (support legacy isLoading prop)
    const effectiveLoadingState: YouTubeBadgeLoadingState = 
        loadingState ?? (isLoading ? 'fetching' : 'idle');
    
    const isFetching = effectiveLoadingState === 'fetching';
    const hasThumbnail = thumbnailUrl && !thumbnailError;

    // Hide voice-mode-fab when showing YouTube suggestion
    useEffect(() => {
        const voiceFab = document.querySelector('.voice-mode-fab') as HTMLElement;
        if (voiceFab) {
            voiceFab.style.visibility = 'hidden';
        }
        return () => {
            // Re-query to avoid stale reference
            const voiceFab = document.querySelector('.voice-mode-fab') as HTMLElement;
            if (voiceFab) {
                voiceFab.style.visibility = '';
            }
        };
    }, []);

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
            className="local-pdf-suggestion youtube-video-suggestion"
            role="region"
            aria-label="YouTube video suggestion"
        >
            <button
                className="local-pdf-suggestion-button"
                onClick={onAttach}
                disabled={isFetching}
                title={`Attach transcript for: ${videoTitle}`}
                aria-busy={isFetching}
            >
                {hasThumbnail ? (
                    <span className="youtube-badge-thumbnail">
                        <img
                            src={thumbnailUrl}
                            alt=""
                            onError={handleThumbnailError}
                        />
                    </span>
                ) : (
                    <span className="local-pdf-suggestion-icon">
                        <YoutubeIcon size={16} />
                    </span>
                )}
                
                {isFetching ? (
                    <span className="youtube-badge-shimmer-container">
                        <span 
                            className="youtube-badge-shimmer" 
                            aria-hidden="true"
                        />
                        <span className="sr-only" aria-live="polite">
                            Fetching transcript...
                        </span>
                    </span>
                ) : (
                    <span className="local-pdf-suggestion-text">
                        {displayTitle}
                        {durationSeconds !== undefined && (
                            <span className="youtube-badge-duration">
                                {formatDuration(durationSeconds)}
                            </span>
                        )}
                    </span>
                )}
            </button>

            {!isFetching && (
                <button
                    type="button"
                    className="local-pdf-suggestion-close"
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
