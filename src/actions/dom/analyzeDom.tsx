/**
 * Deep DOM Analyzer Tool
 * Provides comprehensive DOM structure analysis with classes, IDs, data attributes,
 * interactive element detection, event listeners, and shadow DOM analysis
 */

import { useEffect } from "react";
import { z } from "zod";
import { createLogger } from '~logger';
import { registerTool } from "../../ai/tools";
import { useToolUI } from "../../ai/tools/components";
import { CompactToolRenderer } from "../../ai/tools/components";
import type { ToolUIState } from "../../ai/tools/components";

const log = createLogger("Actions-Dom-AnalyzeDom");

export function useAnalyzeDomTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering analyzeDom tool...');

        registerTool({
            name: "analyzeDom",
            description: `Deep analysis of page DOM structure with classes, IDs, attributes, and interactive elements. Use when no specific tool exists for a task.

WHEN TO USE:
- Finding specific elements by class/id/attribute for interaction
- Understanding page structure for complex tasks (canvas, custom widgets, forms)
- Before executing custom scripts or interactions
- Identifying interactive elements (canvas, video, audio, custom components)
- When clickByText or other tools fail to find elements

PRECONDITIONS:
- Page must be loaded and have DOM content
- For selector-based analysis, element must exist

WORKFLOW:
1. Analyze DOM tree structure with specified depth
2. Collect element info: tagName, id, classes, attributes, text content
3. Detect interactive elements: canvas, video, audio, forms, buttons
4. Identify event listeners and ARIA attributes
5. Analyze shadow DOM if present
6. Return structured element tree with selectors

RETURNS:
- Element tree with hierarchy and metadata
- CSS selectors for each element
- Interactive element counts
- Shadow DOM info
- Event listener detection

LIMITATIONS:
- Max depth of 10 to prevent overwhelming data
- Event listener detection may not capture all listeners
- Cannot detect listeners added via addEventListener in external scripts
- Large DOMs may take 1-2 seconds to analyze

EXAMPLE: analyzeDom(selector='canvas', depth=3, includeHidden=false, includeEventListeners=true)`,
            parameters: z.object({
                selector: z.string().optional().describe('Optional CSS selector to focus analysis on specific element. If omitted, analyzes from document.body. Examples: "canvas", "#main", ".content"'),
                depth: z.number().optional().describe('How deep to traverse the DOM tree. Default: 5, Min: 1, Max: 10. Higher depth = more elements but slower. Use 2-3 for quick overview, 5-7 for detailed analysis.').default(5),
                includeHidden: z.boolean().optional().describe('Include elements with display:none or visibility:hidden. Default: false. Set true for analyzing hidden modals, dropdowns, or collapsed content.').default(false),
                includeEventListeners: z.boolean().optional().describe('Detect inline event listeners (onclick, onchange, etc.). Default: true. Set false for faster analysis if event info not needed.').default(true),
                includeAttributes: z.boolean().optional().describe('Include all data-* and custom attributes. Default: true. Set false for cleaner output if attributes not needed.').default(true),
            }),
            execute: async ({ selector, depth = 5, includeHidden = false, includeEventListeners = true, includeAttributes = true }) => {
                try {
                    const maxDepth = Math.min(Math.max(depth, 1), 10); // Clamp between 1-10
                    log.info("TOOL CALL: analyzeDom", { selector, depth: maxDepth, includeHidden, includeEventListeners, includeAttributes });

                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) return { error: "No active tab" };

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector || null, maxDepth, Boolean(includeHidden), Boolean(includeEventListeners), Boolean(includeAttributes)],
                        func: (sel: string | null, maxD: number, showHidden: boolean, checkEvents: boolean, checkAttrs: boolean) => {
                            interface ElementNode {
                                tagName: string;
                                id?: string;
                                classes: string[];
                                attributes?: Record<string, string>;
                                text?: string;
                                selector: string;
                                isInteractive: boolean;
                                interactiveType?: string;
                                eventListeners?: string[];
                                ariaRole?: string;
                                ariaLabel?: string;
                                isVisible: boolean;
                                bounds?: { width: number; height: number; top: number; left: number };
                                hasShadowRoot: boolean;
                                children: ElementNode[];
                            }



                            // Helper: Generate unique CSS selector for element
                            function getElementSelector(element: Element): string {
                                if (element.id) {
                                    return `#${element.id}`;
                                }

                                const classes = Array.from(element.classList).filter(c => c && !c.startsWith('ai-'));
                                if (classes.length > 0) {
                                    const classSelector = `.${classes.join('.')}`;
                                    // Check if unique
                                    if (document.querySelectorAll(classSelector).length === 1) {
                                        return classSelector;
                                    }
                                    return `${element.tagName.toLowerCase()}${classSelector}`;
                                }

                                // Fallback to nth-child
                                const parent = element.parentElement;
                                if (parent) {
                                    const siblings = Array.from(parent.children);
                                    const index = siblings.indexOf(element) + 1;
                                    const parentSelector = parent.tagName.toLowerCase();
                                    return `${parentSelector} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
                                }

                                return element.tagName.toLowerCase();
                            }

                            // Helper: Check if element is interactive
                            function getInteractiveInfo(element: Element): { isInteractive: boolean; type?: string } {
                                const tagName = element.tagName.toLowerCase();

                                // Canvas, video, audio
                                if (tagName === 'canvas') return { isInteractive: true, type: 'canvas' };
                                if (tagName === 'video') return { isInteractive: true, type: 'video' };
                                if (tagName === 'audio') return { isInteractive: true, type: 'audio' };

                                // Forms and inputs
                                if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
                                    return { isInteractive: true, type: 'input' };
                                }
                                if (tagName === 'button') return { isInteractive: true, type: 'button' };
                                if (tagName === 'a') return { isInteractive: true, type: 'link' };
                                if (tagName === 'form') return { isInteractive: true, type: 'form' };

                                // Custom elements (contain hyphen)
                                if (tagName.includes('-')) return { isInteractive: true, type: 'custom-element' };

                                // Elements with role
                                const role = element.getAttribute('role');
                                if (role && ['button', 'link', 'textbox', 'slider', 'switch', 'checkbox', 'radio'].includes(role)) {
                                    return { isInteractive: true, type: `role-${role}` };
                                }

                                // Contenteditable
                                if ((element as HTMLElement).contentEditable === 'true') {
                                    return { isInteractive: true, type: 'contenteditable' };
                                }

                                return { isInteractive: false };
                            }

                            // Helper: Get inline event listeners
                            function getEventListeners(element: Element): string[] {
                                const events: string[] = [];
                                const htmlElement = element as any;

                                // Check common inline events
                                const eventAttributes = [
                                    'onclick', 'onchange', 'onsubmit', 'oninput', 'onkeydown',
                                    'onkeyup', 'onkeypress', 'onmousedown', 'onmouseup', 'onmouseover',
                                    'onmouseout', 'onfocus', 'onblur', 'onload', 'onerror'
                                ];

                                for (const attr of eventAttributes) {
                                    if (htmlElement[attr] || element.hasAttribute(attr)) {
                                        events.push(attr.substring(2)); // Remove 'on' prefix
                                    }
                                }

                                return events;
                            }

                            // Helper: Check if element is visible
                            function isElementVisible(element: Element): boolean {
                                const style = window.getComputedStyle(element);
                                const rect = element.getBoundingClientRect();

                                return style.display !== 'none' &&
                                    style.visibility !== 'hidden' &&
                                    style.opacity !== '0' &&
                                    rect.width > 0 &&
                                    rect.height > 0;
                            }

                            // Main traversal function
                            function traverseDOM(element: Element, currentDepth: number, counts: any): ElementNode | null {
                                if (currentDepth > maxD) return null;

                                const isVisible = isElementVisible(element);
                                if (!showHidden && !isVisible) return null;

                                const interactiveInfo = getInteractiveInfo(element);
                                const rect = element.getBoundingClientRect();

                                // Update counts
                                counts.total++;
                                if (interactiveInfo.isInteractive) {
                                    const type = interactiveInfo.type || 'unknown';
                                    if (type === 'canvas') counts.canvas++;
                                    else if (type === 'video') counts.video++;
                                    else if (type === 'audio') counts.audio++;
                                    else if (type === 'form') counts.forms++;
                                    else if (type === 'button') counts.buttons++;
                                    else if (type === 'input') counts.inputs++;
                                    else if (type === 'link') counts.links++;
                                    else if (type === 'custom-element') counts.customElements++;
                                }

                                const hasShadowRoot = !!(element as any).shadowRoot;
                                if (hasShadowRoot) counts.shadowDom++;

                                const node: ElementNode = {
                                    tagName: element.tagName.toLowerCase(),
                                    id: element.id || undefined,
                                    classes: Array.from(element.classList).filter(c => !c.startsWith('ai-')),
                                    selector: getElementSelector(element),
                                    isInteractive: interactiveInfo.isInteractive,
                                    interactiveType: interactiveInfo.type,
                                    isVisible,
                                    bounds: {
                                        width: Math.round(rect.width),
                                        height: Math.round(rect.height),
                                        top: Math.round(rect.top),
                                        left: Math.round(rect.left)
                                    },
                                    hasShadowRoot,
                                    children: []
                                };

                                // Add attributes if requested
                                if (checkAttrs) {
                                    const attrs: Record<string, string> = {};
                                    for (const attr of element.attributes) {
                                        // Skip style and class (already captured)
                                        if (attr.name !== 'style' && attr.name !== 'class') {
                                            attrs[attr.name] = attr.value;
                                        }
                                    }
                                    if (Object.keys(attrs).length > 0) {
                                        node.attributes = attrs;
                                    }
                                }

                                // Add text content (first 100 chars)
                                const textContent = element.textContent?.trim();
                                if (textContent && textContent.length > 0) {
                                    // Only include text if element has direct text (not just from children)
                                    const childText = Array.from(element.children)
                                        .map(c => c.textContent?.trim() || '')
                                        .join('');
                                    const directText = textContent.replace(childText, '').trim();
                                    if (directText.length > 0) {
                                        node.text = directText.slice(0, 100);
                                    }
                                }

                                // Add event listeners if requested
                                if (checkEvents) {
                                    const listeners = getEventListeners(element);
                                    if (listeners.length > 0) {
                                        node.eventListeners = listeners;
                                    }
                                }

                                // Add ARIA attributes
                                const ariaRole = element.getAttribute('role');
                                const ariaLabel = element.getAttribute('aria-label');
                                if (ariaRole) node.ariaRole = ariaRole;
                                if (ariaLabel) node.ariaLabel = ariaLabel;

                                // Traverse children
                                if (currentDepth < maxD) {
                                    for (const child of element.children) {
                                        const childNode = traverseDOM(child, currentDepth + 1, counts);
                                        if (childNode) {
                                            node.children.push(childNode);
                                        }
                                    }

                                    // Traverse shadow DOM if present
                                    if (hasShadowRoot) {
                                        const shadowRoot = (element as any).shadowRoot;
                                        for (const child of shadowRoot.children) {
                                            const shadowChild = traverseDOM(child, currentDepth + 1, counts);
                                            if (shadowChild) {
                                                node.children.push(shadowChild);
                                            }
                                        }
                                    }
                                }

                                return node;
                            }

                            try {
                                // Find root element
                                let rootElement: Element;
                                if (sel) {
                                    const element = document.querySelector(sel);
                                    if (!element) {
                                        return {
                                            success: false,
                                            error: `Element not found: ${sel}`
                                        };
                                    }
                                    rootElement = element;
                                } else {
                                    rootElement = document.body;
                                }

                                // Initialize counts
                                const counts = {
                                    total: 0,
                                    canvas: 0,
                                    video: 0,
                                    audio: 0,
                                    forms: 0,
                                    buttons: 0,
                                    inputs: 0,
                                    links: 0,
                                    customElements: 0,
                                    shadowDom: 0
                                };

                                // Traverse DOM
                                const tree = traverseDOM(rootElement, 0, counts);

                                if (!tree) {
                                    return {
                                        success: false,
                                        error: "No visible elements found (try includeHidden=true)"
                                    };
                                }

                                return {
                                    success: true,
                                    elementTree: tree,
                                    interactiveCounts: {
                                        canvas: counts.canvas,
                                        video: counts.video,
                                        audio: counts.audio,
                                        forms: counts.forms,
                                        buttons: counts.buttons,
                                        inputs: counts.inputs,
                                        links: counts.links,
                                        customElements: counts.customElements
                                    },
                                    shadowDomCount: counts.shadowDom,
                                    totalElements: counts.total,
                                    maxDepthReached: maxD
                                };
                            } catch (error) {
                                return {
                                    success: false,
                                    error: `DOM analysis failed: ${(error as Error).message}`
                                };
                            }
                        }
                    });

                    const result = results[0]?.result;
                    if (result?.success) {
                        log.info("✅ DOM analyzed successfully", {
                            totalElements: result.totalElements,
                            interactive: result.interactiveCounts,
                            shadowDom: result.shadowDomCount
                        });
                    } else {
                        log.warn("analyzeDom failed", result);
                    }
                    return result || { error: "Failed to analyze DOM" };
                } catch (error) {
                    log.error('[Tool] Error analyzing DOM:', error);
                    return { error: "Failed to analyze DOM. Make sure you have permission to access this page." };
                }
            },
        });

        // Register UI for analyzeDom - uses CompactToolRenderer
        registerToolUI('analyzeDom', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ analyzeDom tool registration complete');

        return () => {
            log.info('🧹 Cleaning up analyzeDom tool');
            unregisterToolUI('analyzeDom');
        };
    }, [registerToolUI, unregisterToolUI]);
}
