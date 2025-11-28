/**
 * Ask Command Detection Hook
 * Detects /ask command in any input field or contenteditable element
 *
 * Edge cases handled:
 * - Multiple rapid /ask commands (debouncing)
 * - Shadow DOM inputs (event delegation via composed path)
 * - iFrame inputs (content script isolation with all_frames: true)
 * - Target element removal (MutationObserver)
 * - Extension context invalidation
 */
import { useCallback, useEffect, useState, useRef } from 'react';
import { isAskCommandEnabled } from '@/utils/settings';
import type { AskPosition, AskModeState } from '@/types';
import { createLogger } from '~logger';

const log = createLogger('AskCommandDetection');

const COMMAND_PATTERN = /\/ask(?:\s|$)/i;
const OVERLAY_OFFSET_Y = 20;
const COMMAND_DEBOUNCE_MS = 200;

/**
 * Check if an element is editable (input, textarea, or contenteditable)
 */
function isEditableElement(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) {
        const textTypes = ['text', 'email', 'search', 'url', 'tel', 'password'];
        return textTypes.includes(el.type);
    }
    if (el instanceof HTMLTextAreaElement) {
        return true;
    }
    return el.isContentEditable;
}

/**
 * Get text content from an element
 */
function getElementText(el: HTMLElement): string {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return el.value;
    }
    return el.textContent || '';
}

/**
 * Remove the /ask command from the element
 */
function removeCommandFromElement(el: HTMLElement, match: RegExpMatchArray): void {
    const text = getElementText(el);
    const commandStart = match.index || 0;
    const commandEnd = commandStart + match[0].length;
    const newText = text.slice(0, commandStart) + text.slice(commandEnd);

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = newText;
        el.setSelectionRange(commandStart, commandStart);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.isContentEditable) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = document.createRange();
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
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
}


/**
 * Calculate overlay position based on element
 * Uses viewport-relative coordinates for position: fixed
 */
function calculateOverlayPosition(el: HTMLElement): AskPosition {
    const rect = el.getBoundingClientRect();

    let x = rect.left;
    let y = rect.bottom + OVERLAY_OFFSET_Y;

    const padding = 16;
    const overlayWidth = 420;
    const overlayHeight = 500; // Approximate max height for ask overlay

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
        if (y < padding) {
            y = padding;
        }
    }

    return { x, y };
}

export function useAskCommandDetection() {
    const [state, setState] = useState<AskModeState>({
        isActive: false,
        targetElement: null,
        position: { x: 0, y: 0 },
    });
    const [isEnabled, setIsEnabled] = useState(true);
    const processingRef = useRef(false);
    const lastCommandTimeRef = useRef(0);

    // Check if feature is enabled on mount and validate extension context
    useEffect(() => {
        if (!chrome.runtime?.id) {
            log.warn('Extension context invalidated, disabling ask command');
            setIsEnabled(false);
            return;
        }

        isAskCommandEnabled().then(setIsEnabled).catch(() => {
            log.warn('Failed to check ask command settings');
            setIsEnabled(false);
        });
    }, []);

    // Set active state
    const setIsActive = useCallback((active: boolean) => {
        if (!active) {
            setState({
                isActive: false,
                targetElement: null,
                position: { x: 0, y: 0 },
            });
        }
    }, []);

    // Handle input events (including Shadow DOM via composed path)
    const handleInput = useCallback((e: Event) => {
        if (!isEnabled || processingRef.current) return;

        const now = Date.now();
        if (now - lastCommandTimeRef.current < COMMAND_DEBOUNCE_MS) {
            return;
        }

        let target = e.target as HTMLElement;

        // Try composed path for Shadow DOM support
        if (e.composedPath && e.composedPath().length > 0) {
            const composedTarget = e.composedPath()[0] as HTMLElement;
            if (composedTarget && isEditableElement(composedTarget)) {
                target = composedTarget;
            }
        }

        if (!isEditableElement(target)) return;

        const text = getElementText(target);
        const match = text.match(COMMAND_PATTERN);

        if (match) {
            processingRef.current = true;
            lastCommandTimeRef.current = now;

            log.debug('Ask command detected', {
                platform: window.location.hostname,
                elementType: target.tagName,
                inShadowDOM: target.getRootNode() !== document,
            });

            removeCommandFromElement(target, match);
            const position = calculateOverlayPosition(target);

            setState({
                isActive: true,
                targetElement: target,
                position,
            });

            setTimeout(() => {
                processingRef.current = false;
            }, COMMAND_DEBOUNCE_MS);
        }
    }, [isEnabled]);

    // Handle keydown for Escape to close
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isEnabled) return;

        if (e.key === 'Escape' && state.isActive) {
            setIsActive(false);
        }
    }, [isEnabled, state.isActive, setIsActive]);

    // Set up event listeners with capture phase
    useEffect(() => {
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
                        log.debug('Target element removed, closing ask overlay');
                        setIsActive(false);
                        return;
                    }
                }
            }
        });

        const root = state.targetElement.getRootNode();
        const observeTarget = root instanceof ShadowRoot ? root : document.body;

        observer.observe(observeTarget, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [state.targetElement, setIsActive]);

    return {
        isAskMode: state.isActive,
        targetElement: state.targetElement,
        overlayPosition: state.position,
        setIsAskMode: setIsActive,
        isEnabled,
    };
}
