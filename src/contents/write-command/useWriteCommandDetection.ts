/**
 * Write Command Detection Hook
 * Detects /write command in any input field or contenteditable element
 * 
 * Edge cases handled:
 * - Multiple rapid /write commands (debouncing)
 * - Shadow DOM inputs (event delegation)
 * - iFrame inputs (content script isolation)
 * - Target element removal (MutationObserver)
 * - Extension context invalidation
 */
import { useCallback, useEffect, useState, useRef } from 'react';
import { isWriteCommandEnabled } from '@/utils/settings';
import type { WritePosition, WriterModeState } from '@/types';
import { createLogger } from '~logger';

const log = createLogger('WriteCommandDetection');

const COMMAND_PATTERN = /\/write(?:\s|$)/i;
const OVERLAY_OFFSET_Y = 20; // Increased offset to position overlay further below input
const COMMAND_DEBOUNCE_MS = 200; // Prevent multiple rapid triggers

/**
 * Check if an element is editable (input, textarea, or contenteditable)
 */
function isEditableElement(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) {
        // Only text-like inputs
        const textTypes = ['text', 'email', 'search', 'url', 'tel', 'password'];
        return textTypes.includes(el.type);
    }
    if (el instanceof HTMLTextAreaElement) {
        return true;
    }
    // ContentEditable elements (Draft.js, Slate, Quill, etc.)
    return el.isContentEditable;
}

/**
 * Get text content from an element
 */
function getElementText(el: HTMLElement): string {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return el.value;
    }
    // For contenteditable, get text content
    return el.textContent || '';
}

/**
 * Remove the /write command from the element
 */
function removeCommandFromElement(el: HTMLElement, match: RegExpMatchArray): void {
    const text = getElementText(el);
    const commandStart = match.index || 0;
    const commandEnd = commandStart + match[0].length;
    const newText = text.slice(0, commandStart) + text.slice(commandEnd);

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = newText;
        // Set cursor to where command was
        el.setSelectionRange(commandStart, commandStart);
        // Trigger input event for frameworks
        el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.isContentEditable) {
        // For contenteditable, use execCommand or direct manipulation
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            // Try to remove the command text
            // This is tricky with rich text - use document.execCommand as fallback
            const range = document.createRange();

            // Find the text node containing the command
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let currentOffset = 0;
            let node: Text | null = null;

            while (walker.nextNode()) {
                const textNode = walker.currentNode as Text;
                const nodeLength = textNode.length;

                if (currentOffset + nodeLength > commandStart) {
                    node = textNode;
                    break;
                }
                currentOffset += nodeLength;
            }

            if (node) {
                const nodeOffset = commandStart - currentOffset;
                range.setStart(node, nodeOffset);
                range.setEnd(node, Math.min(nodeOffset + match[0].length, node.length));
                range.deleteContents();
            }
        }
        // Trigger input event
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
}

/**
 * Calculate overlay position based on element
 * Uses viewport-relative coordinates for position: fixed
 */
function calculateOverlayPosition(el: HTMLElement): WritePosition {
    const rect = el.getBoundingClientRect();

    // Position overlay below the input field
    // Use viewport-relative coordinates (no scroll offset for position: fixed)
    let x = rect.left;
    let y = rect.bottom + OVERLAY_OFFSET_Y;

    // Ensure it stays in viewport
    const padding = 16;
    const overlayWidth = 400;
    const overlayHeight = 300; // Approximate max height

    // Adjust horizontal position
    if (x + overlayWidth > window.innerWidth - padding) {
        x = window.innerWidth - overlayWidth - padding;
    }
    if (x < padding) {
        x = padding;
    }

    // Adjust vertical position - flip above if not enough space below
    if (y + overlayHeight > window.innerHeight - padding) {
        y = rect.top - overlayHeight - OVERLAY_OFFSET_Y;
        // If still out of viewport, just position at top
        if (y < padding) {
            y = padding;
        }
    }

    return { x, y };
}

export function useWriteCommandDetection() {
    const [state, setState] = useState<WriterModeState>({
        isActive: false,
        targetElement: null,
        cursorPosition: 0,
        position: { x: 0, y: 0 },
    });
    const [isEnabled, setIsEnabled] = useState(true);
    const processingRef = useRef(false);
    const lastCommandTimeRef = useRef(0);

    // Check if feature is enabled on mount and validate extension context
    useEffect(() => {
        // Validate extension context is still valid
        if (!chrome.runtime?.id) {
            log.warn('Extension context invalidated, disabling write command');
            setIsEnabled(false);
            return;
        }

        isWriteCommandEnabled().then(setIsEnabled).catch(() => {
            log.warn('Failed to check write command settings');
            setIsEnabled(false);
        });
    }, []);

    // Set active state
    const setIsActive = useCallback((active: boolean) => {
        if (!active) {
            setState({
                isActive: false,
                targetElement: null,
                cursorPosition: 0,
                position: { x: 0, y: 0 },
            });
        }
    }, []);

    // Handle input events (including Shadow DOM via composed path)
    const handleInput = useCallback((e: Event) => {
        if (!isEnabled || processingRef.current) return;

        // Debounce multiple rapid commands
        const now = Date.now();
        if (now - lastCommandTimeRef.current < COMMAND_DEBOUNCE_MS) {
            return;
        }

        // Get target from composed path for Shadow DOM support
        let target = e.target as HTMLElement;

        // Try composed path for Shadow DOM
        if (e.composedPath && e.composedPath().length > 0) {
            const composedTarget = e.composedPath()[0] as HTMLElement;
            if (composedTarget && isEditableElement(composedTarget)) {
                target = composedTarget;
            }
        }

        // Check if it's an editable element
        if (!isEditableElement(target)) return;

        // Get text and check for /write command
        const text = getElementText(target);
        const match = text.match(COMMAND_PATTERN);

        if (match) {
            // Prevent re-processing and update last command time
            processingRef.current = true;
            lastCommandTimeRef.current = now;

            log.debug('Write command detected', {
                platform: window.location.hostname,
                elementType: target.tagName,
                inShadowDOM: target.getRootNode() !== document,
            });

            // Remove the command from the input
            removeCommandFromElement(target, match);

            // Calculate position for overlay
            const position = calculateOverlayPosition(target);

            // Activate writer mode
            setState({
                isActive: true,
                targetElement: target,
                cursorPosition: match.index || 0,
                position,
            });

            // Reset processing flag after debounce period
            setTimeout(() => {
                processingRef.current = false;
            }, COMMAND_DEBOUNCE_MS);
        }
    }, [isEnabled]);

    // Handle keydown for command detection (for paste scenarios)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isEnabled) return;

        // Close on Escape when writer is active
        if (e.key === 'Escape' && state.isActive) {
            setIsActive(false);
        }
    }, [isEnabled, state.isActive, setIsActive]);

    // Set up event listeners
    useEffect(() => {
        // Use capture phase to intercept events before frameworks
        document.addEventListener('input', handleInput, true);
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            document.removeEventListener('input', handleInput, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [handleInput, handleKeyDown]);

    // Watch for target element removal
    useEffect(() => {
        if (!state.targetElement) return;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.removedNodes) {
                    if (node === state.targetElement ||
                        (node instanceof Element && node.contains(state.targetElement))) {
                        log.debug('Target element removed, closing writer');
                        setIsActive(false);
                        return;
                    }
                }
            }
        });

        // Observe the root (document or shadow root)
        const root = state.targetElement.getRootNode();
        const observeTarget = root instanceof ShadowRoot ? root : document.body;

        observer.observe(observeTarget, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [state.targetElement, setIsActive]);

    return {
        isWriterMode: state.isActive,
        targetElement: state.targetElement,
        cursorPosition: state.cursorPosition,
        tooltipPosition: state.position,
        setIsWriterMode: setIsActive,
        isEnabled,
    };
}
