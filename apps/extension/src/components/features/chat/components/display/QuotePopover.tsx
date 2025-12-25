import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { MessageTextSelection } from '@/hooks/chat/useMessageTextSelection';

interface QuotePopoverProps {
    selection: MessageTextSelection;
    onQuote: (text: string) => void;
}

/**
 * Minimal popover that appears when text is selected in chat messages.
 * Allows users to quote the selected text into their reply.
 */
export const QuotePopover: React.FC<QuotePopoverProps> = ({ selection, onQuote }) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 });

    // Adjust position to keep popover within viewport
    useEffect(() => {
        if (!selection.isVisible || !popoverRef.current) return;

        const popover = popoverRef.current;
        const popoverRect = popover.getBoundingClientRect();
        const popoverWidth = popoverRect.width || 100; // fallback width

        let x = selection.position.x;
        let y = selection.position.y;

        // Center horizontally on selection
        x = x - (popoverWidth / 2);

        // Keep within horizontal bounds (with padding)
        const padding = 8;
        if (x < padding) x = padding;

        // Position above selection (negative offset from selection top)
        y = y - 40; // 40px above selection

        // Ensure not above viewport
        if (y < padding) {
            y = selection.position.y + 24; // Show below instead
        }

        setAdjustedPosition({ x, y });
    }, [selection.position, selection.isVisible]);

    const handleQuoteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onQuote(selection.text);
        // Clear selection after quoting
        window.getSelection()?.removeAllRanges();
    };

    return (
        <AnimatePresence>
            {selection.isVisible && (
                <motion.div
                    ref={popoverRef}
                    data-quote-popover
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute z-[100] pointer-events-auto"
                    style={{
                        left: adjustedPosition.x,
                        top: adjustedPosition.y,
                    }}
                >
                    <button
                        onClick={handleQuoteClick}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                            bg-[var(--bg-secondary)] border border-[var(--border-color)]
                            text-[var(--text-primary)] text-xs font-medium
                            shadow-lg backdrop-blur-sm
                            hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-hover)]
                            transition-colors duration-150 cursor-pointer
                            whitespace-nowrap"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-70"
                        >
                            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
                            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3" />
                        </svg>
                        <span>Reply</span>
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
