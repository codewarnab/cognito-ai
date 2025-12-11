/**
 * Text Rewriter Selection Hook
 * Detects text selection and captures Range for replacement
 */
import { useCallback, useEffect, useState, useRef } from 'react';
import { isRewriteEnabled, getRewriteSettings } from '@/utils/settings/rewriteSettings';
import type { RewriteSelectionData } from '@/types';

const BUTTON_OFFSET_Y = 10; // Position above selection
const DEBOUNCE_DELAY = 200; // ms to wait before showing tooltip
const DEFAULT_MIN_LENGTH = 10;

export function useTextRewriterSelection() {
    const [selection, setSelection] = useState<RewriteSelectionData | null>(null);
    const [isEnabled, setIsEnabled] = useState(true);
    const [minLength, setMinLength] = useState(DEFAULT_MIN_LENGTH);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Check if feature is enabled and load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            const enabled = await isRewriteEnabled();
            setIsEnabled(enabled);

            if (enabled) {
                const settings = await getRewriteSettings();
                setMinLength(settings.minSelectionLength);
            }
        };

        void loadSettings();

        // Cleanup debounce timer on unmount
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const resetSelection = useCallback(() => {
        setSelection(null);
    }, []);

    const handleMouseUp = useCallback(() => {
        if (!isEnabled) return;

        // Clear any pending debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        const windowSelection = window.getSelection();
        if (!windowSelection || windowSelection.isCollapsed) {
            setSelection(null);
            return;
        }

        const text = windowSelection.toString().trim();
        if (text.length < minLength) {
            setSelection(null);
            return;
        }

        const range = windowSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position tooltip centered above the selection
        const x = rect.left + window.scrollX + rect.width / 2;
        const y = rect.top + window.scrollY - BUTTON_OFFSET_Y;

        // Get the target element (for context)
        const targetElement = range.commonAncestorContainer instanceof HTMLElement
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement || undefined;

        // Debounce to handle rapid selections
        debounceTimerRef.current = setTimeout(() => {
            setSelection({
                text,
                range: range.cloneRange(), // Clone to preserve for later replacement
                position: { x, y },
                targetElement,
            });
            debounceTimerRef.current = null;
        }, DEBOUNCE_DELAY);
    }, [isEnabled, minLength]);

    const handleSelectionChange = useCallback(() => {
        const windowSelection = window.getSelection();
        const text = windowSelection?.toString().trim();

        if (!text) {
            // Clear pending debounce timer when selection is cleared
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            // Only clear if there's no active selection
            setSelection((prev) => (prev ? null : prev));
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('selectionchange', handleSelectionChange);

        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [handleMouseUp, handleSelectionChange]);

    return { selection, setSelection, resetSelection, isEnabled };
}
