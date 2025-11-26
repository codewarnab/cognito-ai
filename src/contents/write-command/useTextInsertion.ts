/**
 * Text Insertion Hook
 * Hook to insert generated text into target elements (input, textarea, contenteditable)
 */
import { useCallback } from 'react';
import { createLogger } from '~logger';

const log = createLogger('TextInsertion');

export interface InsertResult {
    success: boolean;
    fallbackUsed?: 'clipboard' | 'none';
    error?: string;
}

/**
 * Check if element is still attached to the DOM
 */
function isElementInDOM(el: HTMLElement): boolean {
    // Check if in main document
    if (document.body.contains(el)) {
        return true;
    }
    // Check if in shadow DOM
    const root = el.getRootNode();
    if (root instanceof ShadowRoot && root.host) {
        return document.body.contains(root.host);
    }
    return false;
}

/**
 * Wait for next animation frame (allows focus to settle)
 */
function waitForFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

/**
 * Get cursor position in an element
 */
function getCursorPosition(el: HTMLElement): number {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return el.selectionStart || 0;
    }
    // For contenteditable, use Selection API
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Get offset relative to the element
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(el);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
    }
    return 0;
}

/**
 * Insert text at a specific position in a contenteditable element
 */
function insertTextAtCursor(el: HTMLElement, text: string): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        // Fallback: append to end
        el.textContent = (el.textContent || '') + text;
        return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // Move cursor to end of inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Focus an element and set cursor to a position
 */
function focusAndSetCursor(el: HTMLElement, position: number): void {
    el.focus();

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.setSelectionRange(position, position);
    } else if (el.isContentEditable) {
        // For contenteditable, we need to find the right text node
        const selection = window.getSelection();
        if (!selection) return;

        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let currentOffset = 0;

        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const nodeLength = node.length;

            if (currentOffset + nodeLength >= position) {
                const range = document.createRange();
                range.setStart(node, position - currentOffset);
                range.setEnd(node, position - currentOffset);
                selection.removeAllRanges();
                selection.addRange(range);
                return;
            }
            currentOffset += nodeLength;
        }

        // If position is beyond text, set to end
        const lastNode = el.lastChild;
        if (lastNode) {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false); // Collapse to end
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

export function useTextInsertion() {
    /**
     * Insert text into the target element at the specified cursor position
     * Returns a result object indicating success and any fallback used
     */
    const insertText = useCallback(async (
        target: HTMLElement,
        text: string,
        cursorPosition: number
    ): Promise<InsertResult> => {
        if (!target || !text) {
            log.warn('Invalid insert params', { hasTarget: !!target, hasText: !!text });
            return { success: false, error: 'Invalid parameters' };
        }

        // Validate element is still in DOM
        if (!isElementInDOM(target)) {
            log.warn('Target element is no longer in DOM');
            // Try clipboard fallback
            try {
                await navigator.clipboard.writeText(text);
                return { success: false, fallbackUsed: 'clipboard', error: 'Target field is no longer available' };
            } catch {
                return { success: false, error: 'Target field is no longer available' };
            }
        }

        log.debug('Inserting text', {
            length: text.length,
            position: cursorPosition,
            elementType: target.tagName,
        });

        try {
            // Focus the target first and wait for focus to settle
            target.focus();
            await waitForFrame();

            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                // Strategy 1: Direct value manipulation (most reliable for standard inputs)
                const before = target.value.substring(0, cursorPosition);
                const after = target.value.substring(cursorPosition);
                target.value = before + text + after;

                // Move cursor to end of inserted text
                const newPos = cursorPosition + text.length;
                target.setSelectionRange(newPos, newPos);

                // Strategy 2: Dispatch multiple event types for framework compatibility
                // Standard events
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));

                // InputEvent with more details (for React, Vue, etc.)
                try {
                    target.dispatchEvent(new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'insertText',
                        data: text,
                    }));
                } catch {
                    // Fallback for older browsers
                }

                // Strategy 3: React-specific property descriptor trick
                // Some React versions use Object.getOwnPropertyDescriptor to track value changes
                try {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype,
                        'value'
                    )?.set || Object.getOwnPropertyDescriptor(
                        window.HTMLTextAreaElement.prototype,
                        'value'
                    )?.set;

                    if (nativeInputValueSetter) {
                        nativeInputValueSetter.call(target, before + text + after);
                        target.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } catch {
                    // This is just an extra attempt, failure is acceptable
                }

                log.debug('Text inserted into input/textarea');
                return { success: true };
            } else if (target.isContentEditable) {
                // ContentEditable (Draft.js, Slate, rich editors)

                // Set cursor position first
                focusAndSetCursor(target, cursorPosition);
                await waitForFrame();

                // Strategy 1: execCommand (works with most frameworks, including Draft.js)
                let success = false;
                try {
                    success = document.execCommand('insertText', false, text);
                } catch {
                    success = false;
                }

                if (!success) {
                    log.debug('execCommand failed, using DOM manipulation fallback');
                    // Strategy 2: Direct DOM manipulation
                    insertTextAtCursor(target, text);
                }

                // Strategy 3: Dispatch events for framework compatibility
                try {
                    target.dispatchEvent(new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'insertText',
                        data: text,
                    }));
                } catch {
                    // Fallback for older browsers
                    target.dispatchEvent(new Event('input', { bubbles: true }));
                }

                // Some frameworks listen to keyup/keydown
                target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

                log.debug('Text inserted into contenteditable');
                return { success: true };
            }

            log.warn('Unsupported element type', { tagName: target.tagName });

            // Final fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(text);
                return { success: false, fallbackUsed: 'clipboard', error: 'Unsupported element type' };
            } catch {
                return { success: false, error: 'Unsupported element type' };
            }
        } catch (error) {
            log.error('Failed to insert text', { error });

            // Final fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(text);
                return { success: false, fallbackUsed: 'clipboard', error: 'Failed to insert text' };
            } catch {
                return { success: false, error: 'Failed to insert text' };
            }
        }
    }, []);

    /**
     * Replace all text in the target element
     */
    const replaceText = useCallback(async (
        target: HTMLElement,
        text: string
    ): Promise<InsertResult> => {
        if (!target) {
            log.warn('No target element for replaceText');
            return { success: false, error: 'No target element' };
        }

        // Validate element is still in DOM
        if (!isElementInDOM(target)) {
            log.warn('Target element is no longer in DOM');
            try {
                await navigator.clipboard.writeText(text);
                return { success: false, fallbackUsed: 'clipboard', error: 'Target field is no longer available' };
            } catch {
                return { success: false, error: 'Target field is no longer available' };
            }
        }

        try {
            target.focus();
            await waitForFrame();

            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                target.value = text;
                target.setSelectionRange(text.length, text.length);
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true };
            } else if (target.isContentEditable) {
                // Select all and replace
                const selection = window.getSelection();
                if (selection) {
                    const range = document.createRange();
                    range.selectNodeContents(target);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const success = document.execCommand('insertText', false, text);
                if (!success) {
                    target.textContent = text;
                }

                target.dispatchEvent(new InputEvent('input', {
                    bubbles: true,
                    inputType: 'insertText',
                    data: text,
                }));

                return { success: true };
            }

            return { success: false, error: 'Unsupported element type' };
        } catch (error) {
            log.error('Failed to replace text', { error });
            try {
                await navigator.clipboard.writeText(text);
                return { success: false, fallbackUsed: 'clipboard', error: 'Failed to replace text' };
            } catch {
                return { success: false, error: 'Failed to replace text' };
            }
        }
    }, []);

    return { insertText, replaceText, getCursorPosition };
}
