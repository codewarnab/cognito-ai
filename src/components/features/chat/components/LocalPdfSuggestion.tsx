/**
 * LocalPdfSuggestion Component
 * 
 * Displays a suggestion badge when a local PDF file is detected in the active tab.
 * Allows users to quickly attach the PDF with one click.
 * 
 * Phase 2: Suggestion Badge UI Component
 */

import React from 'react';
import { PaperclipIcon } from '../../../shared/icons';

interface LocalPdfSuggestionProps {
    /** Name of the PDF file */
    filename: string;
    /** Handler called when user clicks to attach the PDF */
    onAttach: () => void;
    /** Handler called when user dismisses the suggestion */
    onDismiss: () => void;
    /** Whether the attach operation is in progress */
    isLoading?: boolean;
}

export const LocalPdfSuggestion: React.FC<LocalPdfSuggestionProps> = ({
    filename,
    onAttach,
    onDismiss,
    isLoading = false,
}) => {
    // Truncate long filenames
    const displayName = filename.length > 30
        ? `${filename.substring(0, 27)}...`
        : filename;

    return (
        <div className="local-pdf-suggestion">
            <button
                className="local-pdf-suggestion-button"
                onClick={onAttach}
                disabled={isLoading}
                title={`Attach ${filename}`}
            >
                <span className="local-pdf-suggestion-icon">
                    <PaperclipIcon size={14} />
                </span>
                <span className="local-pdf-suggestion-text">
                    {isLoading ? 'Attaching...' : `Attach ${displayName}?`}
                </span>
            </button>

            {!isLoading && (
                <button
                    className="local-pdf-suggestion-close"
                    onClick={onDismiss}
                    title="Dismiss suggestion"
                    aria-label="Dismiss PDF attachment suggestion"
                >
                    ×
                </button>
            )}
        </div>
    );
};
