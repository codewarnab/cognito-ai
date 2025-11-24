/**
 * Enhanced Smart Click Tool - Click Anything by Text
 * Searches entire page for text (including shadow DOM and iframes), fuzzy matching,
 * visual highlighting with ClickSpark animation, and realistic mouse event simulation
 */

import { useEffect } from "react";
import { z } from "zod";
import { createLogger } from '~logger';
import { CompactToolCard } from "@components/ui/tools/cards";
import { registerTool } from "@ai/tools";
import { useToolUI } from "@ai/tools/components";
import type { ToolUIState } from "@ai/tools/components";

const log = createLogger("Actions-Interactions-ClickByText");

export function useClickByTextTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering clickByText tool...');

        registerTool({
            name: "clickByText",
            description: `Click elements by visible text. Searches entire page including shadow DOM and iframes with fuzzy matching support.

USE FOR: Clicking buttons, links, forms, navigation, menus, cookie banners, or any clickable UI element.

REQUIREMENTS: Text must be visible in DOM (not images/canvas). Element must be clickable or have clickable parent.

PROCESS: Searches page → finds clickable element → scrolls into view → highlights → simulates realistic mouse events → returns element info.

LIMITATIONS: Cannot click hidden elements. May match wrong element if multiple similar texts exist (use index param). Won't work with some custom click handlers that validate event origin.

EXAMPLE: clickByText(text="Sign In", fuzzy=true, elementType="button")`,
            parameters: z.object({
                text: z.string().describe('Visible text to search for (case-insensitive). Examples: "Sign In", "Submit", "Accept Cookies". Searches buttons, links, labels, headings across entire page.'),
                fuzzy: z.boolean().optional().describe('Allow partial matches and typos (default: true). "Sign" matches "Sign In". Set false for exact match only.').default(true),
                elementType: z.enum(['button', 'link', 'any']).optional().describe('Filter by type: "button" (buttons only), "link" (<a> tags only), "any" (default: all clickable). Use to disambiguate duplicate text.').default('any'),
                index: z.number().optional().describe('Which match to click if multiple found (1-based, default: 1). Example: index=2 clicks second "Submit" button.').default(1),
            }),
            execute: async ({ text, fuzzy = true, elementType = 'any', index = 1 }) => {
                try {
                    log.info("TOOL CALL: clickByText", { text, fuzzy, elementType, index });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) return { error: "No active tab" };

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
                             * Highlight element with ClickSpark Animation + Fallback
                             */
                            function highlightElement(element: Element): Promise<void> {
                                return new Promise((resolve) => {
                                    try {
                                        const rect = element.getBoundingClientRect();
                                        const x = rect.left + rect.width / 2;
                                        const y = rect.top + rect.height / 2;

                                        // Track animations
                                        (window as any).__aiClickAnimations = (window as any).__aiClickAnimations || 0;
                                        (window as any).__aiClickResizeHandler = (window as any).__aiClickResizeHandler || null;
                                        (window as any).__aiClickAnimations++;

                                        // Try ClickSpark animation
                                        try {
                                            let canvas = document.getElementById('ai-click-spark-canvas') as HTMLCanvasElement | null;

                                            if (!canvas) {
                                                canvas = document.createElement('canvas');
                                                canvas.id = 'ai-click-spark-canvas';
                                                canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;';
                                                canvas.width = window.innerWidth;
                                                canvas.height = window.innerHeight;
                                                document.body.appendChild(canvas);

                                                if (!(window as any).__aiClickResizeHandler) {
                                                    (window as any).__aiClickResizeHandler = () => {
                                                        const c = document.getElementById('ai-click-spark-canvas') as HTMLCanvasElement;
                                                        if (c) {
                                                            c.width = window.innerWidth;
                                                            c.height = window.innerHeight;
                                                        }
                                                    };
                                                    window.addEventListener('resize', (window as any).__aiClickResizeHandler);
                                                }
                                            }

                                            const ctx = canvas.getContext('2d');
                                            if (!ctx) throw new Error('No canvas context');

                                            const config = {
                                                sparkColor: '#FFD700',
                                                sparkSize: 10,
                                                sparkRadius: 15,
                                                sparkCount: 8,
                                                duration: 400
                                            };

                                            const ease = (t: number) => t * (2 - t); // ease-out

                                            const now = performance.now();
                                            const sparks = Array.from({ length: config.sparkCount }, (_, i) => ({
                                                x: x,
                                                y: y,
                                                angle: (2 * Math.PI * i) / config.sparkCount,
                                                startTime: now
                                            }));

                                            function animate(timestamp: number): void {
                                                if (!ctx || !canvas) {
                                                    resolve();
                                                    return;
                                                }

                                                ctx.clearRect(0, 0, canvas.width, canvas.height);

                                                let activeSparks = 0;

                                                for (const spark of sparks) {
                                                    const elapsed = timestamp - spark.startTime;
                                                    if (elapsed >= config.duration) continue;

                                                    activeSparks++;

                                                    const progress = elapsed / config.duration;
                                                    const eased = ease(progress);

                                                    const distance = eased * config.sparkRadius;
                                                    const lineLength = config.sparkSize * (1 - eased);

                                                    const x1 = spark.x + distance * Math.cos(spark.angle);
                                                    const y1 = spark.y + distance * Math.sin(spark.angle);
                                                    const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
                                                    const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

                                                    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                                                    gradient.addColorStop(0, config.sparkColor);
                                                    gradient.addColorStop(1, config.sparkColor + '00');

                                                    ctx.strokeStyle = gradient;
                                                    ctx.lineWidth = 2;
                                                    ctx.lineCap = 'round';
                                                    ctx.beginPath();
                                                    ctx.moveTo(x1, y1);
                                                    ctx.lineTo(x2, y2);
                                                    ctx.stroke();
                                                }

                                                if (activeSparks > 0) {
                                                    requestAnimationFrame(animate);
                                                } else {
                                                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                                                    (window as any).__aiClickAnimations--;
                                                    resolve();
                                                }
                                            }

                                            requestAnimationFrame(animate);
                                        } catch (error) {
                                            console.warn('[ClickAnimation] ClickSpark failed, using zoom focus fallback:', error);

                                            // Fallback: Zoom Focus animation
                                            const css = `
                                                @keyframes ai-zoom-focus {
                                                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
                                                    50% { transform: scale(1.05); box-shadow: 0 0 20px 10px rgba(255, 215, 0, 0.7); }
                                                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
                                                }
                                                .ai-zoom-focus { animation: ai-zoom-focus 300ms ease-in-out !important; position: relative !important; z-index: 999998 !important; }
                                                body.ai-page-dim::before {
                                                    content: ''; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                                                    background: rgba(0, 0, 0, 0.5); z-index: 999997; pointer-events: none;
                                                    animation: ai-dim-fade 300ms ease-in-out;
                                                }
                                                @keyframes ai-dim-fade { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
                                            `;
                                            const style = document.createElement('style');
                                            style.id = 'ai-zoom-focus-style';
                                            style.textContent = css;
                                            document.head.appendChild(style);

                                            document.body.classList.add('ai-page-dim');
                                            (element as HTMLElement).classList.add('ai-zoom-focus');

                                            setTimeout(() => {
                                                try {
                                                    document.body.classList.remove('ai-page-dim');
                                                    (element as HTMLElement).classList.remove('ai-zoom-focus');
                                                    document.getElementById('ai-zoom-focus-style')?.remove();
                                                } catch (e) { }
                                                resolve();
                                            }, 300);
                                        }
                                    } catch (e) {
                                        resolve();
                                    }
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

                                    if (!match) {
                                        return {
                                            success: false,
                                            error: `Could not access match at index ${targetIndex + 1} (requested ${occurrence})`
                                        };
                                    }

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


