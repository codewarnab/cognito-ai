import { useCallback, useState } from 'react';

import { useTextSelection } from '@/contents/text-summarizer/useTextSelection';
import { useSummarizer } from '@/contents/text-summarizer/useSummarizer';
import { SummarizeButton } from '@/contents/text-summarizer/SummarizeButton';
import { SummaryPopup } from '@/contents/text-summarizer/SummaryPopup';

interface AppProps {
    ctx: any;
}

const TextSummarizerContent = ({ ctx: _ctx }: AppProps) => {
    const { selection, setSelection, resetSelection, isEnabled } = useTextSelection();
    const { summary, isLoading, isStreaming, error, summarize, resetSummary } = useSummarizer();
    const [showPopup, setShowPopup] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

    // Handle button click - start summarization
    const handleButtonClick = useCallback(() => {
        // Save position for popup
        setPopupPosition(selection.position);

        // Hide button, show popup
        setSelection((prev) => ({ ...prev, show: false }));
        setShowPopup(true);

        // Start summarization
        void summarize(selection.text);
    }, [selection, setSelection, summarize]);

    // Handle popup close
    const handleClose = useCallback(() => {
        setShowPopup(false);
        resetSelection();
        resetSummary();
    }, [resetSelection, resetSummary]);

    // Don't render if disabled
    if (!isEnabled) return null;

    return (
        <>
            {/* Floating summarize button */}
            {selection.show && !showPopup && (
                <SummarizeButton
                    position={selection.position}
                    onClick={handleButtonClick}
                />
            )}

            {/* Summary popup */}
            {showPopup && (
                <SummaryPopup
                    position={popupPosition}
                    summary={summary}
                    isLoading={isLoading}
                    isStreaming={isStreaming}
                    error={error}
                    onClose={handleClose}
                />
            )}
        </>
    );
};

export default TextSummarizerContent;
