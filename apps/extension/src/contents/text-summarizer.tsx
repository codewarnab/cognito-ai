import type { PlasmoCSConfig } from 'plasmo';
import { useCallback, useState } from 'react';
import cssText from 'data-text:~/styles/features/text-summarizer.css';

import { useTextSelection } from './text-summarizer/useTextSelection';
import { useSummarizer } from './text-summarizer/useSummarizer';
import { SummarizeButton } from './text-summarizer/SummarizeButton';
import { SummaryPopup } from './text-summarizer/SummaryPopup';

export const config: PlasmoCSConfig = {
    matches: ['<all_urls>'],
    all_frames: false,
    // Note: chrome://, chrome-extension://, and moz-extension:// URLs are automatically
    // excluded by the browser - content scripts cannot run on these pages
};

export const getStyle = () => {
    const style = document.createElement('style');
    style.textContent = cssText;
    return style;
};

function TextSummarizerContent() {
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
}

export default TextSummarizerContent;
