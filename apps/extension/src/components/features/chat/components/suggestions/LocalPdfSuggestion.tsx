/**
 * LocalPdfSuggestion Component
 * 
 * Displays a suggestion badge when a local PDF file is detected in the active tab.
 * Allows users to quickly attach the PDF with one click.
 */

import React, { useEffect } from 'react';
import { PaperclipIcon } from '@/components/shared/icons';
import { useUINavigationStore, type UINavigationState } from '@/stores';

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
    // Hide voice-mode-fab when showing PDF suggestion
    const setVoiceFabVisibility = useUINavigationStore((state: UINavigationState) => state.setVoiceFabVisibility);
    
    useEffect(() => {
        setVoiceFabVisibility(false);
        return () => {
            setVoiceFabVisibility(true);
        };
    }, [setVoiceFabVisibility]);

    // Truncate long filenames
    const displayName = filename.length > 30
        ? `${filename.substring(0, 27)}...`
        : filename;

    return (
        <div className="absolute bottom-[calc(100%+6px)] left-3 flex items-center gap-1 bg-gradient-to-br from-[#059669] to-[#10b981] rounded-[10px] shadow-[0_2px_6px_rgba(5,150,105,0.4)] animate-in slide-in-from-bottom-2 fade-in duration-200 z-[100] overflow-hidden opacity-50 transition-opacity hover:opacity-100">
            <button
                className="flex items-center gap-1.5 px-2.5 py-1 bg-transparent border-none text-[#d1fae5] cursor-pointer text-[11px] font-medium transition-colors duration-150 rounded-l-[10px] hover:bg-white/10 active:bg-white/15 disabled:cursor-default disabled:opacity-80"
                onClick={onAttach}
                disabled={isLoading}
                title={`Attach ${filename}`}
            >
                <span className="text-[14px] flex items-center justify-center">
                    <PaperclipIcon size={14} />
                </span>
                <span className="font-semibold tracking-[0.01em] whitespace-nowrap overflow-hidden text-ellipsis max-w-[400px]">
                    {isLoading ? 'Attaching...' : `Attach ${displayName}?`}
                </span>
            </button>

            {!isLoading && (
                <button
                    className="bg-white/15 border-none text-[#d1fae5] w-4 h-4 rounded-full flex items-center justify-center cursor-pointer text-sm leading-none transition-colors duration-150 p-0 mr-1.5 shrink-0 hover:bg-white/25 active:bg-white/35"
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
