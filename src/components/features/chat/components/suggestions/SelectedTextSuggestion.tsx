/**
 * SelectedTextSuggestion Component
 * 
 * Displays a suggestion badge when text is selected on a web page.
 * Allows users to quickly add the selected text to the chat as an attachment.
 */

import React, { useEffect } from 'react';
import { TypeIcon } from 'lucide-react';

interface SelectedTextSuggestionProps {
    /** Preview of the selected text (truncated) */
    textPreview: string;
    /** Full selected text length */
    textLength: number;
    /** Handler called when user clicks to add the selected text */
    onAttach: () => void;
    /** Handler called when user dismisses the suggestion */
    onDismiss: () => void;
    /** Whether the attach operation is in progress */
    isLoading?: boolean;
}

export const SelectedTextSuggestion: React.FC<SelectedTextSuggestionProps> = ({
    textPreview,
    textLength,
    onAttach,
    onDismiss,
    isLoading = false,
}) => {
    // Hide voice-mode-fab when showing selected text suggestion
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

    // Truncate preview for compact display
    const displayText = textPreview.length > 30
        ? `${textPreview.substring(0, 27)}...`
        : textPreview;

    // Format text length for display
    const lengthLabel = textLength > 1000
        ? `${(textLength / 1000).toFixed(1)}k chars`
        : `${textLength} chars`;

    return (
        <div
            className="local-pdf-suggestion selected-text-suggestion"
            role="region"
            aria-label="Selected text suggestion"
        >
            <button
                className="local-pdf-suggestion-button"
                onClick={onAttach}
                disabled={isLoading}
                title={`Add selected text (${lengthLabel})`}
            >
                <span className="local-pdf-suggestion-icon">
                    <TypeIcon size={14} />
                </span>
                <span className="local-pdf-suggestion-text">
                    {isLoading ? 'Adding...' : `Add: "${displayText}"`}
                    <span className="selected-text-badge-length">
                        {lengthLabel}
                    </span>
                </span>
            </button>

            {!isLoading && (
                <button
                    type="button"
                    className="local-pdf-suggestion-close"
                    onClick={onDismiss}
                    title="Dismiss suggestion"
                    aria-label="Dismiss selected text suggestion"
                >
                    ×
                </button>
            )}
        </div>
    );
};
