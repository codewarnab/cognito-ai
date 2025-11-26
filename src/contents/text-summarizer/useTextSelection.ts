import { useCallback, useEffect, useState, useRef } from 'react';
import { isTextSummarizerEnabled } from '@/utils/settings';

export interface Position {
    x: number;
    y: number;
}

export interface TextSelection {
    text: string;
    position: Position;
    show: boolean;
}

const BUTTON_OFFSET_X = 8;
const BUTTON_OFFSET_Y = -4;
const DEFAULT_MIN_LENGTH = 100;
const DEBOUNCE_DELAY = 150; // ms to wait before showing button

export function useTextSelection(minTextLength: number = DEFAULT_MIN_LENGTH) {
    const [selection, setSelection] = useState<TextSelection>({
        text: '',
        position: { x: 0, y: 0 },
        show: false,
    });
    const [isEnabled, setIsEnabled] = useState(true);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Check if feature is enabled on mount
    useEffect(() => {
        isTextSummarizerEnabled().then(setIsEnabled);

        // Cleanup debounce timer on unmount
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const resetSelection = useCallback(() => {
        setSelection({
            text: '',
            position: { x: 0, y: 0 },
            show: false,
        });
    }, []);

    const handleSelection = useCallback(() => {
        if (!isEnabled) return;

        // Clear any pending debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        const windowSelection = window.getSelection();
        const text = windowSelection?.toString().trim();

        if (text && text.length >= minTextLength) {
            const range = windowSelection?.getRangeAt(0);
            if (range) {
                const rects = range.getClientRects();
                const lastRect = rects[rects.length - 1];
                if (lastRect) {
                    // Position at the end of selection
                    const x = lastRect.right + window.scrollX + BUTTON_OFFSET_X;
                    const y = lastRect.top + window.scrollY + BUTTON_OFFSET_Y;

                    // Debounce the button appearance to handle rapid selections
                    debounceTimerRef.current = setTimeout(() => {
                        setSelection({
                            text,
                            position: { x, y },
                            show: true,
                        });
                        debounceTimerRef.current = null;
                    }, DEBOUNCE_DELAY);
                }
            }
        } else {
            setSelection((prev) => ({ ...prev, show: false }));
        }
    }, [isEnabled, minTextLength]);

    const handleSelectionChange = useCallback(() => {
        const windowSelection = window.getSelection();
        const text = windowSelection?.toString().trim();

        if (!text) {
            // Clear pending debounce timer when selection is cleared
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            setSelection((prev) => ({ ...prev, show: false }));
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleSelection);
        document.addEventListener('selectionchange', handleSelectionChange);

        return () => {
            document.removeEventListener('mouseup', handleSelection);
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [handleSelection, handleSelectionChange]);

    return { selection, setSelection, resetSelection, isEnabled };
}
