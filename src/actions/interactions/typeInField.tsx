/**
 * Enhanced Global Keyboard Tool - Type Anywhere on the Page
 * Finds input fields by description, handles shadow DOM, iframes, and simulates human-like typing
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { createLogger } from '~logger';

const log = createLogger("Actions-Interactions-TypeInField");

/**
 * Hook to register enhanced keyboard interaction tool
 */
export function useTypeInFieldTool() {
    useEffect(() => {
        log.info('🔧 Registering typeInField tool...');

        registerTool({
            name: "typeInField",
            description: `Type text into input fields using natural language descriptions. Handles shadow DOM, iframes, and all input types.

USE FOR: Forms, search boxes, text areas, any text input (email, password, comments, etc.)

PRECONDITIONS: Page has input/textarea/contentEditable elements. If target specified, field must be findable. If omitted, an input must be focused.

PROCESS: Finds input by description (placeholder/label/aria-label/nearby text/position) → scrolls into view → highlights → focuses → clears if requested → types instantly → presses Enter if requested → triggers input/change events (React/Vue compatible)

LIMITATIONS: Cannot type into disabled/readonly fields. May fail on custom widgets (fallback: clickByText + pressKey). Types instantly (may trigger anti-bot). Cannot type special key combinations (use pressKey).

EXAMPLE: typeInField(text="React hooks tutorial", target="search box", pressEnter=true)`,
            parameters: z.object({
                text: z.string().describe('Text to type into the field. Can be any string (letters, numbers, symbols). Will be inserted instantly. Examples: "john@example.com", "React hooks tutorial", "Hello world!"'),
                target: z.string().optional().describe('Natural language description of the input field to find. Examples: "search box", "email field", "password input", "comment box", "first input", "username field". Searches by placeholder, label, aria-label, nearby text, name, id. If omitted, types into currently focused element.'),
                clearFirst: z.boolean().optional().describe('If true, clears existing field content before typing. Default: false. Use true when replacing content, false when appending.').default(false),
                pressEnter: z.boolean().optional().describe('If true, presses Enter key after typing to submit form or trigger search. Default: false. Use true for search boxes and single-field forms.').default(false),
            }),
            execute: async ({ text, target, clearFirst = false, pressEnter = false }) => {
                try {
                    log.info("TOOL CALL: typeInField", { textLength: text.length, target, clearFirst, pressEnter });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) return { error: "No active tab" };

                    // Ensure arguments are serializable (undefined -> null) when sent to executeScript
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: true },
                        args: [text, target ?? null, clearFirst, pressEnter],
                        func: (txt: string, targetDesc: string | null, clear: boolean, enter: boolean) => {
                            // ===== UTILITY FUNCTIONS =====

                            /**
                             * Find all input-like elements in the page (including shadow DOM)
                             */
                            function findAllInputs(root: Document | ShadowRoot = document): HTMLElement[] {
                                const inputs: HTMLElement[] = [];

                                // Standard input elements
                                const standardInputs = Array.from(root.querySelectorAll<HTMLElement>(
                                    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, [contenteditable="true"], [contenteditable=""]'
                                ));
                                inputs.push(...standardInputs);

                                // Search shadow DOMs recursively
                                const allElements = Array.from(root.querySelectorAll('*'));
                                for (const el of allElements) {
                                    if (el.shadowRoot) {
                                        inputs.push(...findAllInputs(el.shadowRoot));
                                    }
                                }

                                return inputs;
                            }

                            /**
                             * Get descriptive text for an input element
                             */
                            function getInputDescription(input: HTMLElement): string {
                                const descriptions: string[] = [];

                                // Placeholder
                                if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
                                    if (input.placeholder) descriptions.push(input.placeholder.toLowerCase());
                                }

                                // aria-label
                                const ariaLabel = input.getAttribute('aria-label');
                                if (ariaLabel) descriptions.push(ariaLabel.toLowerCase());

                                // aria-labelledby
                                const ariaLabelledBy = input.getAttribute('aria-labelledby');
                                if (ariaLabelledBy) {
                                    const labelEl = document.getElementById(ariaLabelledBy);
                                    if (labelEl) descriptions.push(labelEl.textContent?.toLowerCase() || '');
                                }

                                // Associated label
                                if (input.id) {
                                    const label = document.querySelector(`label[for="${input.id}"]`);
                                    if (label) descriptions.push(label.textContent?.toLowerCase() || '');
                                }

                                // Parent label
                                const parentLabel = input.closest('label');
                                if (parentLabel) {
                                    descriptions.push(parentLabel.textContent?.toLowerCase() || '');
                                }

                                // Nearby text (previous sibling or parent text)
                                const parent = input.parentElement;
                                if (parent) {
                                    const nearbyText = parent.textContent?.toLowerCase() || '';
                                    descriptions.push(nearbyText.substring(0, 100));
                                }

                                // Name and id attributes
                                if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
                                    if (input.name) descriptions.push(input.name.toLowerCase());
                                }
                                if (input.id) descriptions.push(input.id.toLowerCase());

                                return descriptions.join(' ');
                            }

                            /**
                             * Find best matching input element
                             */
                            function findInputByDescription(desc: string): HTMLElement | null {
                                const allInputs = findAllInputs();
                                if (allInputs.length === 0) return null;

                                const searchTerm = desc.toLowerCase();

                                // Check for position-based queries
                                if (searchTerm.includes('first')) return allInputs[0] || null;
                                if (searchTerm.includes('last')) return allInputs[allInputs.length - 1] || null;
                                if (searchTerm.match(/\d+/)) {
                                    const index = parseInt(searchTerm.match(/\d+/)![0]) - 1;
                                    if (index >= 0 && index < allInputs.length) return allInputs[index] || null;
                                }

                                // Find best match by description
                                let bestMatch: { element: HTMLElement; score: number } | null = null;

                                for (const input of allInputs) {
                                    const inputDesc = getInputDescription(input);
                                    let score = 0;

                                    // Exact phrase match
                                    if (inputDesc.includes(searchTerm)) {
                                        score += 100;
                                    }

                                    // Word matches
                                    const searchWords = searchTerm.split(/\s+/);
                                    for (const word of searchWords) {
                                        if (word.length > 2 && inputDesc.includes(word)) {
                                            score += 10;
                                        }
                                    }

                                    // Type-specific bonuses
                                    if (input instanceof HTMLInputElement) {
                                        const type = input.type.toLowerCase();
                                        if (searchTerm.includes('email') && type === 'email') score += 50;
                                        if (searchTerm.includes('password') && type === 'password') score += 50;
                                        if (searchTerm.includes('search') && type === 'search') score += 50;
                                        if (searchTerm.includes('text') && type === 'text') score += 20;
                                    }
                                    if (input instanceof HTMLTextAreaElement && searchTerm.includes('comment')) {
                                        score += 30;
                                    }

                                    // Visibility check (bonus for visible elements)
                                    const rect = input.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0) {
                                        score += 5;
                                    }

                                    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
                                        bestMatch = { element: input, score };
                                    }
                                }

                                return bestMatch?.element || allInputs[0] || null; // Fallback to first input
                            }

                            /**
                             * Scroll element into view with smooth animation
                             */
                            function scrollIntoView(element: HTMLElement) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }

                            /**
                             * Add visual highlight to element with Field Focus (Option C)
                             */
                            function highlightElement(element: HTMLElement, duration: number) {
                                try {
                                    const css = `
                                        @keyframes ai-field-focus {
                                            0%, 100% { box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.5); }
                                            50% { box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.8), 0 0 20px rgba(6, 182, 212, 0.4); }
                                        }
                                        .ai-field-focus {
                                            animation: ai-field-focus 1s ease-in-out infinite !important;
                                            border: 2px solid rgba(6, 182, 212, 0.8) !important;
                                        }
                                    `;
                                    const style = document.createElement('style');
                                    style.id = 'ai-field-focus-style';
                                    style.textContent = css;
                                    document.head.appendChild(style);

                                    element.classList.add('ai-field-focus');

                                    setTimeout(() => {
                                        try {
                                            element.classList.remove('ai-field-focus');
                                            document.getElementById('ai-field-focus-style')?.remove();
                                        } catch (e) { }
                                    }, duration);
                                } catch (e) { }
                            }

                            /**
                             * Focus element with proper event simulation
                             */
                            function focusElement(element: HTMLElement) {
                                if (typeof element.focus === 'function') {
                                    element.focus();
                                    element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
                                    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
                                }
                            }

                            /**
                             * Type text instantly (insert full text at once)
                             */
                            function typeText(element: HTMLElement, text: string): void {
                                // Update value based on element type
                                if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                                    // Get the current value
                                    const currentValue = element.value;

                                    // Set new value
                                    element.value = currentValue + text;

                                    // Trigger React/Vue change detection by calling native setter
                                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                                        element instanceof HTMLTextAreaElement
                                            ? window.HTMLTextAreaElement.prototype
                                            : window.HTMLInputElement.prototype,
                                        'value'
                                    )?.set;

                                    if (nativeInputValueSetter) {
                                        nativeInputValueSetter.call(element, element.value);
                                    }

                                    // Dispatch events to trigger framework listeners
                                    element.dispatchEvent(new Event('input', { bubbles: true }));
                                    element.dispatchEvent(new Event('change', { bubbles: true }));
                                } else if (element.isContentEditable) {
                                    // For contentEditable, just set the text content
                                    const currentText = element.textContent || '';
                                    element.textContent = currentText + text;

                                    // Dispatch events
                                    element.dispatchEvent(new Event('input', { bubbles: true }));
                                    element.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }

                            /**
                             * Press Enter key
                             */
                            function pressEnterKey(element: Element) {
                                const enterInit: KeyboardEventInit = {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true,
                                    cancelable: true,
                                };

                                element.dispatchEvent(new KeyboardEvent('keydown', enterInit));
                                element.dispatchEvent(new KeyboardEvent('keypress', enterInit));
                                element.dispatchEvent(new KeyboardEvent('keyup', enterInit));
                            }

                            // ===== MAIN EXECUTION =====

                            try {
                                // Find target element
                                let targetElement: HTMLElement | null = null;

                                if (targetDesc) {
                                    targetElement = findInputByDescription(targetDesc);
                                    if (!targetElement) {
                                        return {
                                            success: false,
                                            error: `Could not find input field matching: "${targetDesc}"`,
                                            suggestion: "Try describing the field differently (e.g., 'search box', 'email input', 'first input')"
                                        };
                                    }
                                } else {
                                    // Use currently focused element
                                    targetElement = document.activeElement as HTMLElement;
                                    if (!targetElement ||
                                        !(targetElement instanceof HTMLInputElement ||
                                            targetElement instanceof HTMLTextAreaElement ||
                                            targetElement.isContentEditable)) {
                                        return {
                                            success: false,
                                            error: "No input field is currently focused",
                                            suggestion: "Please specify which input field to type in (e.g., target: 'search box')"
                                        };
                                    }
                                }

                                // Scroll into view and highlight
                                scrollIntoView(targetElement);
                                highlightElement(targetElement, 800);

                                // Focus element
                                focusElement(targetElement);

                                // Clear if requested
                                if (clear) {
                                    if (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement) {
                                        targetElement.value = '';
                                    } else if (targetElement.isContentEditable) {
                                        targetElement.textContent = '';
                                    }
                                    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
                                    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                                }

                                // Type text instantly
                                typeText(targetElement, txt);

                                // Press Enter if requested
                                if (enter) {
                                    pressEnterKey(targetElement);
                                }

                                const elementInfo = {
                                    tagName: targetElement.tagName,
                                    type: (targetElement as HTMLInputElement).type || 'contenteditable',
                                    placeholder: (targetElement as HTMLInputElement).placeholder,
                                    id: targetElement.id,
                                    className: targetElement.className,
                                };

                                return {
                                    success: true,
                                    typed: txt.length,
                                    target: elementInfo,
                                    message: `Successfully typed ${txt.length} characters${enter ? ' and pressed Enter' : ''}`
                                };

                            } catch (error) {
                                return {
                                    success: false,
                                    error: `Typing failed: ${(error as Error).message}`
                                };
                            }
                        }
                    });

                    const result = results[0]?.result;
                    if (result?.success) {
                        log.info("✅ Text typed successfully", result);
                    } else {
                        log.warn("❌ Typing failed", result);
                    }
                    return result || { error: "Failed to type text" };
                } catch (error) {
                    log.error('[Tool] Error typing text:', error);
                    return { error: "Failed to type text. Make sure you have permission to access this page." };
                }
            },
        });

        log.info('✅ typeInField tool registration complete');
    }, []);
}


