/**
 * YouTubeVideoSuggestion Component
 * 
 * Displays a suggestion badge when a YouTube video page is detected in the active tab.
 * Allows users to quickly attach the video transcript with one click.
 */

import React, { useEffect } from 'react';
import { YoutubeIcon } from '@assets/icons/chat/youtube';

interface YouTubeVideoSuggestionProps {
    /** Title of the YouTube video */
    videoTitle: string;
    /** Handler called when user clicks to attach the video transcript */
    onAttach: () => void;
    /** Handler called when user dismisses the suggestion */
    onDismiss: () => void;
    /** Whether the attach operation is in progress */
    isLoading?: boolean;
}

export const YouTubeVideoSuggestion: React.FC<YouTubeVideoSuggestionProps> = ({
    videoTitle,
    onAttach,
    onDismiss,
    isLoading = false,
}) => {
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

    // Truncate long video titles for compact display
    const displayTitle = videoTitle.length > 24
        ? `${videoTitle.substring(0, 21)}...`
        : videoTitle;

    return (
        <div className="local-pdf-suggestion">
            <button
                className="local-pdf-suggestion-button"
                onClick={onAttach}
                disabled={isLoading}
                title={`Attach transcript for: ${videoTitle}`}
            >
                <span className="local-pdf-suggestion-icon">
                    <YoutubeIcon size={16} />
                </span>
                <span className="local-pdf-suggestion-text">
                    {isLoading ? 'Fetching...' : displayTitle}
                </span>
            </button>

            {!isLoading && (
                <button
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
