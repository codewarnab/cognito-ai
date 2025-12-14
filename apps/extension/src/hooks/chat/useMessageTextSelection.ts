import { useState, useCallback, useRef, useEffect, type RefObject } from 'react';

export interface MessageTextSelection {
    text: string;
    position: { x: number; y: number };
    isVisible: boolean;
}

const DEBOUNCE_DELAY = 100; // ms before showing popover
const MIN_SELECTION_LENGTH = 3; // minimum characters to trigger popover

/**
 * Hook to detect and manage text selection within chat messages.
 * Only activates for selections within assistant message elements.
 */
export function useMessageTextSelection(
    containerRef: RefObject<HTMLElement | null>
): MessageTextSelection {
    const [selection, setSelection] = useState<MessageTextSelection>({
        text: '',
        position: { x: 0, y: 0 },
        isVisible: false,
    });

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearSelectionState = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        setSelection(prev => prev.isVisible ? { ...prev, isVisible: false } : prev);
    }, []);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        // Clear any pending debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        const container = containerRef.current;
        if (!container) {
            return;
        }

        // Check if the mouseup is within the container
        const target = e.target as HTMLElement;
        if (!container.contains(target)) {
            return;
        }

        const windowSelection = window.getSelection();
        const text = windowSelection?.toString().trim();

        if (!text || text.length < MIN_SELECTION_LENGTH) {
            clearSelectionState();
            return;
        }

        const range = windowSelection?.getRangeAt(0);
        if (!range) {
            clearSelectionState();
            return;
        }

        // Check if selection is within an assistant message (not user message)
        const commonAncestor = range.commonAncestorContainer;
        const ancestorElement = commonAncestor instanceof HTMLElement
            ? commonAncestor
            : commonAncestor.parentElement;

        if (!ancestorElement) {
            clearSelectionState();
            return;
        }

        // Check if we're inside the messages container
        if (!container.contains(ancestorElement)) {
            clearSelectionState();
            return;
        }

        // Check if we're inside an actual assistant message content area
        // Only show popover for selections within markdown-content (assistant messages)
        const assistantMessageContent = ancestorElement.closest('.markdown-content');
        if (!assistantMessageContent) {
            // Not in an assistant message - could be EmptyState, user message, or other UI
            clearSelectionState();
            return;
        }

        // Get position for popover (above the selection)
        const rects = range.getClientRects();
        if (rects.length === 0) {
            clearSelectionState();
            return;
        }

        // Use the first rect to position above the selection
        const firstRect = rects[0];
        if (!firstRect) {
            clearSelectionState();
            return;
        }

        const containerRect = container.getBoundingClientRect();

        // Position above the selection, centered horizontally
        // Account for scroll position within the container
        const x = firstRect.left + (firstRect.width / 2) - containerRect.left;
        const y = firstRect.top - containerRect.top + container.scrollTop;

        // Debounce to avoid flickering on rapid selections
        debounceTimerRef.current = setTimeout(() => {
            setSelection({
                text,
                position: { x, y },
                isVisible: true,
            });
            debounceTimerRef.current = null;
        }, DEBOUNCE_DELAY);
    }, [containerRef, clearSelectionState]);

    const handleSelectionChange = useCallback(() => {
        const windowSelection = window.getSelection();
        const text = windowSelection?.toString().trim();

        // If selection is cleared, hide the popover
        if (!text) {
            clearSelectionState();
        }
    }, [clearSelectionState]);

    // Handle clicks outside to clear popover
    const handleMouseDown = useCallback((e: MouseEvent) => {
        // If clicking on the popover itself, don't clear
        const target = e.target as HTMLElement;
        if (target.closest('[data-quote-popover]')) {
            return;
        }

        // Small delay to allow selection to complete
        setTimeout(() => {
            const windowSelection = window.getSelection();
            if (!windowSelection?.toString().trim()) {
                clearSelectionState();
            }
        }, 0);
    }, [clearSelectionState]);

    useEffect(() => {
        // Listen on document for more reliable event capture
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('mousedown', handleMouseDown);

        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('selectionchange', handleSelectionChange);
            document.removeEventListener('mousedown', handleMouseDown);

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [handleMouseUp, handleSelectionChange, handleMouseDown]);

    return selection;
}
