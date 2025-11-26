/**
 * Text Insertion Hook
 * Hook to insert generated text into target elements (input, textarea, contenteditable)
 */
import { useCallback } from 'react';
import { createLogger } from '~logger';

const log = createLogger('TextInsertion');

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
     */
    const insertText = useCallback((
        target: HTMLElement,
        text: string,
        cursorPosition: number
    ): boolean => {
        if (!target || !text) {
            log.warn('Invalid insert params', { hasTarget: !!target, hasText: !!text });
            return false;
        }

        log.debug('Inserting text', {
            length: text.length,
            position: cursorPosition,
            elementType: target.tagName,
        });

        try {
            // Focus the target first
            target.focus();

            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                // Standard input/textarea
                const before = target.value.substring(0, cursorPosition);
                const after = target.value.substring(cursorPosition);
                target.value = before + text + after;

                // Move cursor to end of inserted text
                const newPos = cursorPosition + text.length;
                target.setSelectionRange(newPos, newPos);

                // Trigger framework events - these help React/Vue/Angular pick up the change
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));

                // Also dispatch InputEvent for more compatibility
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

                log.debug('Text inserted into input/textarea');
                return true;
            } else if (target.isContentEditable) {
                // ContentEditable (Draft.js, Slate, rich editors)

                // Set cursor position first
                focusAndSetCursor(target, cursorPosition);

                // Try execCommand first (works well with most frameworks)
                const success = document.execCommand('insertText', false, text);

                if (!success) {
                    log.debug('execCommand failed, using fallback');
                    // Fallback: direct DOM manipulation
                    insertTextAtCursor(target, text);
                }

                // Trigger InputEvent for frameworks (especially React with Draft.js)
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
                return true;
            }

            log.warn('Unsupported element type', { tagName: target.tagName });
            return false;
        } catch (error) {
            log.error('Failed to insert text', { error });
            return false;
        }
    }, []);

    /**
     * Replace all text in the target element
     */
    const replaceText = useCallback((
        target: HTMLElement,
        text: string
    ): boolean => {
        if (!target) {
            log.warn('No target element for replaceText');
            return false;
        }

        try {
            target.focus();

            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                target.value = text;
                target.setSelectionRange(text.length, text.length);
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
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

                return true;
            }

            return false;
        } catch (error) {
            log.error('Failed to replace text', { error });
            return false;
        }
    }, []);

    return { insertText, replaceText, getCursorPosition };
}
