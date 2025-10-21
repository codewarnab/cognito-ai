/**
 * Enhanced Smart Click Tool - Click Anything by Text
 * Searches entire page for text (including shadow DOM and iframes), fuzzy matching,
 * visual highlighting, and realistic mouse event simulation
 */

import { useEffect } from "react";
import { z } from "zod";
import { createLogger } from "../../logger";
import { CompactToolCard } from "../../components/ui/CompactToolCard";
import { registerTool } from "../../ai/toolRegistryUtils";
import { useToolUI } from "../../ai/ToolUIContext";
import type { ToolUIState } from "../../ai/ToolUIContext";

const log = createLogger("Actions-Interactions-ClickByText");

export function useClickByTextTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering clickByText tool...');

        registerTool({
            name: "clickByText",
            description: "Click any element on the page by searching for visible text. Can find text in buttons, links, headings, paragraphs, labels - anywhere on the page. Supports fuzzy matching for typos, handles shadow DOM and iframes, scrolls element into view, and highlights it before clicking. Works like a real user clicking with a mouse.",
            parameters: z.object({
                text: z.string().describe('Text to search for and click (e.g., "Sign In", "Submit", "Learn More", "Accept Cookies")'),
                fuzzy: z.boolean().optional().describe('If true, allow partial matches and typos (default: true)').default(true),
                elementType: z.enum(['button', 'link', 'any']).optional().describe('Filter by element type: "button", "link", or "any" (default: "any")').default('any'),
                index: z.number().optional().describe('Which occurrence to click if multiple matches (1-based, default: 1)').default(1),
            }),
            execute: async ({ text, fuzzy = true, elementType = 'any', index = 1 }) => {
                try {
                    log.info("TOOL CALL: clickByText", { text, fuzzy, elementType, index });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: true },
                        args: [text, fuzzy, elementType, index],
                        func: (searchText: string, fuzzyMatch: boolean, elemType: 'button' | 'link' | 'any', occurrence: number) => {
                            // ===== UTILITY FUNCTIONS =====

                            /**
                             * Calculate text similarity (Levenshtein-like simple version)
                             */
                            function textSimilarity(a: string, b: string): number {
                                a = a.toLowerCase();
                                b = b.toLowerCase();

                                // Exact match
                                if (a === b) return 100;

                                // Contains
                                if (a.includes(b) || b.includes(a)) return 80;

                                // Word overlap
                                const wordsA = a.split(/\s+/);
                                const wordsB = b.split(/\s+/);
                                let matchingWords = 0;
                                for (const word of wordsB) {
                                    if (wordsA.some(w => w.includes(word) || word.includes(w))) {
                                        matchingWords++;
                                    }
                                }
                                if (matchingWords > 0) {
                                    return (matchingWords / wordsB.length) * 60;
                                }

                                return 0;
                            }

                            /**
                             * Check if element is clickable
                             */
                            function isClickable(element: Element): boolean {
                                const tagName = element.tagName.toLowerCase();
                                const role = element.getAttribute('role');

                                // Explicitly clickable elements
                                if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) {
                                    return true;
                                }

                                // Elements with click roles
                                if (role && ['button', 'link', 'menuitem', 'tab', 'option'].includes(role)) {
                                    return true;
                                }

                                // Elements with click handlers
                                const hasClickHandler = element.hasAttribute('onclick') ||
                                    element.hasAttribute('ng-click') ||
                                    element.hasAttribute('@click');
                                if (hasClickHandler) return true;

                                // Check for cursor pointer style
                                const style = window.getComputedStyle(element as HTMLElement);
                                if (style.cursor === 'pointer') return true;

                                return false;
                            }

                            /**
                             * Find clickable parent of an element
                             */
                            function findClickableParent(element: Element): Element | null {
                                let current: Element | null = element;
                                let depth = 0;

                                while (current && depth < 10) {
                                    if (isClickable(current)) {
                                        return current;
                                    }
                                    current = current.parentElement;
                                    depth++;
                                }

                                return element; // Fallback to original element
                            }

                            /**
                             * Get all text nodes and their parent elements
                             */
                            function findTextNodesWithParents(root: Document | ShadowRoot = document): Array<{ text: string; element: Element; node: Node }> {
                                const results: Array<{ text: string; element: Element; node: Node }> = [];

                                const walker = document.createTreeWalker(
                                    root,
                                    NodeFilter.SHOW_TEXT,
                                    {
                                        acceptNode: (node: Node) => {
                                            const text = node.textContent?.trim() || '';
                                            if (text.length === 0) return NodeFilter.FILTER_REJECT;

                                            // Skip script and style nodes
                                            const parent = node.parentElement;
                                            if (!parent) return NodeFilter.FILTER_REJECT;
                                            const tagName = parent.tagName.toLowerCase();
                                            if (['script', 'style', 'noscript'].includes(tagName)) {
                                                return NodeFilter.FILTER_REJECT;
                                            }

                                            // Skip hidden elements
                                            const style = window.getComputedStyle(parent);
                                            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                                                return NodeFilter.FILTER_REJECT;
                                            }

                                            return NodeFilter.FILTER_ACCEPT;
                                        }
                                    }
                                );

                                let node: Node | null;
                                while (node = walker.nextNode()) {
                                    const text = node.textContent?.trim() || '';
                                    const element = node.parentElement;
                                    if (element) {
                                        results.push({ text, element, node });
                                    }
                                }

                                // Search shadow DOMs recursively
                                const allElements = Array.from(root.querySelectorAll('*'));
                                for (const el of allElements) {
                                    if (el.shadowRoot) {
                                        results.push(...findTextNodesWithParents(el.shadowRoot));
                                    }
                                }

                                return results;
                            }

                            /**
                             * Find all matching elements by text
                             */
                            function findElementsByText(searchText: string, fuzzy: boolean, type: 'button' | 'link' | 'any'): Array<{ element: Element; score: number; text: string }> {
                                const textNodes = findTextNodesWithParents();
                                const matches: Array<{ element: Element; score: number; text: string }> = [];

                                for (const { text, element } of textNodes) {
                                    // Calculate similarity
                                    let score = textSimilarity(text, searchText);

                                    if (!fuzzy && score < 100) {
                                        continue; // Only exact matches
                                    }

                                    if (score < 30) {
                                        continue; // Too low similarity
                                    }

                                    // Find clickable parent
                                    const clickableElement = findClickableParent(element);
                                    if (!clickableElement) continue;

                                    // Filter by element type
                                    const tagName = clickableElement.tagName.toLowerCase();
                                    const role = clickableElement.getAttribute('role');

                                    if (type === 'button') {
                                        if (tagName !== 'button' && role !== 'button' && !clickableElement.getAttribute('type')?.includes('button')) {
                                            score -= 30; // Penalty but don't exclude
                                        }
                                    } else if (type === 'link') {
                                        if (tagName !== 'a' && role !== 'link') {
                                            score -= 30;
                                        }
                                    }

                                    // Bonus for exact tag matches
                                    if (tagName === 'button' || tagName === 'a') {
                                        score += 20;
                                    }

                                    // Bonus for visible and large elements
                                    const rect = clickableElement.getBoundingClientRect();
                                    if (rect.width > 50 && rect.height > 20) {
                                        score += 10;
                                    }

                                    matches.push({
                                        element: clickableElement,
                                        score,
                                        text: text.substring(0, 100)
                                    });
                                }

                                // Sort by score descending
                                matches.sort((a, b) => b.score - a.score);

                                // Remove duplicates (same element)
                                const seen = new Set<Element>();
                                const unique = matches.filter(m => {
                                    if (seen.has(m.element)) return false;
                                    seen.add(m.element);
                                    return true;
                                });

                                return unique;
                            }

                            /**
                             * Scroll element into view
                             */
                            function scrollIntoView(element: Element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }

                            /**
                             * Highlight element with yellow flash
                             */
                            function highlightElement(element: Element): Promise<void> {
                                return new Promise((resolve) => {
                                    const htmlElement = element as HTMLElement;
                                    const originalOutline = htmlElement.style.outline;
                                    const originalBackground = htmlElement.style.backgroundColor;
                                    const originalTransition = htmlElement.style.transition;

                                    htmlElement.style.transition = 'all 0.3s ease';
                                    htmlElement.style.outline = '3px solid #FFD700';
                                    htmlElement.style.backgroundColor = 'rgba(255, 215, 0, 0.3)';

                                    setTimeout(() => {
                                        htmlElement.style.outline = originalOutline;
                                        htmlElement.style.backgroundColor = originalBackground;
                                        htmlElement.style.transition = originalTransition;
                                        resolve();
                                    }, 600);
                                });
                            }

                            /**
                             * Simulate realistic mouse events
                             */
                            function simulateMouseClick(element: Element) {
                                const rect = element.getBoundingClientRect();
                                const x = rect.left + rect.width / 2;
                                const y = rect.top + rect.height / 2;

                                const mouseEventInit: MouseEventInit = {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window,
                                    clientX: x,
                                    clientY: y,
                                };

                                // Simulate complete mouse interaction sequence
                                element.dispatchEvent(new MouseEvent('mouseover', mouseEventInit));
                                element.dispatchEvent(new MouseEvent('mouseenter', mouseEventInit));
                                element.dispatchEvent(new MouseEvent('mousemove', mouseEventInit));
                                element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
                                element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
                                element.dispatchEvent(new MouseEvent('click', mouseEventInit));

                                // Also try native click as fallback
                                (element as HTMLElement).click();
                            }

                            // ===== MAIN EXECUTION =====

                            return (async () => {
                                try {
                                    // Find all matching elements
                                    const matches = findElementsByText(searchText, fuzzyMatch, elemType);

                                    if (matches.length === 0) {
                                        return {
                                            success: false,
                                            error: `Could not find any element with text: "${searchText}"`,
                                            suggestion: fuzzyMatch
                                                ? "Try a different search term or check if the text is visible on the page"
                                                : "Try enabling fuzzy matching or use a different search term"
                                        };
                                    }

                                    // Get the requested occurrence (1-based index)
                                    const targetIndex = Math.max(0, Math.min(occurrence - 1, matches.length - 1));
                                    const match = matches[targetIndex];

                                    // Scroll into view
                                    scrollIntoView(match.element);

                                    // Wait a bit for scroll
                                    await new Promise(resolve => setTimeout(resolve, 200));

                                    // Highlight element
                                    await highlightElement(match.element);

                                    // Wait a bit before clicking
                                    await new Promise(resolve => setTimeout(resolve, 100));

                                    // Click element
                                    simulateMouseClick(match.element);

                                    const elementInfo = {
                                        tagName: match.element.tagName,
                                        text: match.text,
                                        id: (match.element as HTMLElement).id,
                                        className: (match.element as HTMLElement).className,
                                        href: (match.element as HTMLAnchorElement).href,
                                        score: match.score,
                                    };

                                    return {
                                        success: true,
                                        clicked: elementInfo,
                                        totalMatches: matches.length,
                                        clickedIndex: targetIndex + 1,
                                        message: `Successfully clicked ${match.element.tagName}${matches.length > 1 ? ` (match ${targetIndex + 1} of ${matches.length})` : ''
                                            }`
                                    };

                                } catch (error) {
                                    return {
                                        success: false,
                                        error: `Click failed: ${(error as Error).message}`
                                    };
                                }
                            })();
                        }
                    });

                    const result = results[0]?.result;

                    // Handle async result
                    if (result && typeof result === 'object' && 'then' in result) {
                        const finalResult = await result;
                        if (finalResult?.success) {
                            log.info("✅ Click successful", finalResult);
                        } else {
                            log.warn("❌ Click failed", finalResult);
                        }
                        return finalResult;
                    }

                    if (result?.success) {
                        log.info("✅ Click successful", result);
                    } else {
                        log.warn("❌ Click failed", result);
                    }
                    return result || { error: "Failed to execute click" };
                } catch (error) {
                    const errorMsg = (error as Error)?.message || String(error);

                    // Don't retry if frame was removed (page is navigating)
                    if (errorMsg.includes('Frame with ID') || errorMsg.includes('was removed')) {
                        log.warn('[Tool] Frame removed during click - page may be navigating', { text });
                        return { error: "Page is navigating - action cancelled to prevent loops", frameRemoved: true };
                    }

                    log.error('[Tool] Error clicking element:', error);
                    return { error: "Failed to click element. Make sure you have permission to access this page." };
                }
            },
        });

        registerToolUI('clickByText', (state: ToolUIState) => {
            const { state: toolState, input, output, errorText } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <CompactToolCard
                        toolName="clickByText"
                        state="loading"
                        input={input}
                    />
                );
            }
            if (toolState === 'output-available' && output) {
                const cardState = output.error ? 'error' : 'success';
                return (
                    <CompactToolCard
                        toolName="clickByText"
                        state={cardState}
                        input={input}
                        output={output}
                        errorText={output.error}
                    />
                );
            }
            if (toolState === 'output-error') {
                return (
                    <CompactToolCard
                        toolName="clickByText"
                        state="error"
                        input={input}
                        errorText={errorText || 'Unknown error'}
                    />
                );
            }
            return null;
        });

        log.info('✅ clickByText tool registration complete');

        return () => {
            log.info('🧹 Cleaning up clickByText tool');
            unregisterToolUI('clickByText');
        };
    }, [registerToolUI, unregisterToolUI]);
}
