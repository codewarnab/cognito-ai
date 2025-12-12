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
        const voiceFab = document.querySelector('#voice-mode-fab') as HTMLElement;
        if (voiceFab) {
            voiceFab.style.visibility = 'hidden';
        }
        return () => {
            // Re-query to avoid stale reference
            const voiceFab = document.querySelector('#voice-mode-fab') as HTMLElement;
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
            className="absolute bottom-[calc(100%+6px)] left-3 flex items-center gap-1 bg-gradient-to-br from-[#7c3aed] to-[#8b5cf6] rounded-[10px] shadow-[0_2px_6px_rgba(124,58,237,0.4)] animate-in slide-in-from-bottom-2 fade-in duration-200 z-[100] overflow-hidden opacity-50 transition-opacity hover:opacity-100"
            role="region"
            aria-label="Selected text suggestion"
        >
            <button
                className="flex items-center gap-1.5 px-2.5 py-1 bg-transparent border-none text-white cursor-pointer text-[11px] font-medium transition-colors duration-150 rounded-l-[10px] hover:bg-white/10 active:bg-white/15 disabled:cursor-default disabled:opacity-80"
                onClick={onAttach}
                disabled={isLoading}
                title={`Add selected text (${lengthLabel})`}
            >
                <span className="text-[14px] flex items-center justify-center">
                    <TypeIcon size={14} />
                </span>
                <span className="font-semibold tracking-[0.01em] whitespace-nowrap overflow-hidden text-ellipsis max-w-[400px]">
                    {isLoading ? 'Adding...' : `Add: "${displayText}"`}
                    <span className="ml-1.5 px-1 py-px bg-black/20 rounded-[3px] text-[10px] font-medium opacity-90">
                        {lengthLabel}
                    </span>
                </span>
            </button>

            {!isLoading && (
                <button
                    type="button"
                    className="bg-white/15 border-none text-white w-4 h-4 rounded-full flex items-center justify-center cursor-pointer text-sm leading-none transition-colors duration-150 p-0 mr-1.5 shrink-0 hover:bg-white/25 active:bg-white/35"
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
