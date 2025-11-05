/**
 * Text Extraction Tool for AI SDK v5
 * Handles text extraction from the page and scrolling elements into view
 * Enhanced with semantic structure information and page type detection
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '../../logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import type { ToolUIState } from '../../ai/tools/components';

const log = createLogger("Actions-Interactions-Text");

export function registerTextExtractionInteractions() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering extractText tool with semantic structure...');

        // Register extractText tool with enhanced structure detection
        registerTool({
            name: "extractText",
            description: "Extract text content with semantic structure from the page or specific elements. Returns text with headings hierarchy, page type detection, element counts, and search bar detection.",
            parameters: z.object({
                selector: z.string().optional().describe('Optional CSS selector; if omitted analyzes entire page'),
                all: z.boolean().optional().describe('If true and selector is provided, return all matches (default: false)').default(false),
                limit: z.number().optional().describe('Max characters to extract (default: 5000)').default(5000),
                includeStructure: z.boolean().optional().describe('Include semantic structure analysis (default: true)').default(true),
                detectSearchBar: z.boolean().optional().describe('Detect and extract search bar details (default: true)').default(true),
            }),
            execute: async ({ selector, all = false, limit = 5000, includeStructure = true, detectSearchBar = true }) => {
                try {
                    const max = typeof limit === 'number' && limit > 0 ? limit : 5000;
                    log.info("TOOL CALL: extractText", { selector, all, max, includeStructure, detectSearchBar });

                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector || null, Boolean(all), max, Boolean(includeStructure), Boolean(detectSearchBar)],
                        func: (sel: string | null, returnAll: boolean, maxLen: number, withStructure: boolean, findSearchBar: boolean) => {
                            // Helper: Detect page type based on DOM structure
                            function detectPageType(): 'article' | 'search' | 'form' | 'dashboard' | 'product' | 'unknown' {
                                // Article indicators
                                const articleTags = document.querySelectorAll('article, [role="article"]').length;
                                const hasBlogPost = !!document.querySelector('[class*="blog"], [class*="post"], [class*="article"]');

                                // Search indicators
                                const searchResults = document.querySelectorAll('[class*="search-result"], [class*="result-item"], .g').length;
                                const hasSearchBox = !!document.querySelector('[type="search"], [role="search"]');

                                // Form indicators
                                const forms = document.querySelectorAll('form').length;
                                const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea').length;

                                // Dashboard indicators
                                const widgets = document.querySelectorAll('[class*="widget"], [class*="panel"], [class*="card"]').length;
                                const hasNav = !!document.querySelector('[class*="sidebar"], [class*="dashboard"]');

                                // Product indicators
                                const hasPrice = !!document.querySelector('[class*="price"], [itemprop="price"]');
                                const hasCart = !!document.querySelector('[class*="cart"], [class*="buy"], [class*="purchase"]');

                                if (searchResults > 5 || (hasSearchBox && searchResults > 0)) return 'search';
                                if (hasPrice && hasCart) return 'product';
                                if (articleTags > 0 || hasBlogPost) return 'article';
                                if (forms > 2 || inputs > 10) return 'form';
                                if (widgets > 5 && hasNav) return 'dashboard';

                                return 'unknown';
                            }

                            // Helper: Get all headings hierarchy
                            function getHeadingsHierarchy() {
                                const h1 = Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim() || '').filter(Boolean);
                                const h2 = Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim() || '').filter(Boolean);
                                const h3 = Array.from(document.querySelectorAll('h3')).map(h => h.textContent?.trim() || '').filter(Boolean);

                                return { h1, h2, h3 };
                            }

                            // Helper: Get landmark regions
                            function getLandmarks(): string[] {
                                const landmarks: string[] = [];
                                if (document.querySelector('header, [role="banner"]')) landmarks.push('header');
                                if (document.querySelector('nav, [role="navigation"]')) landmarks.push('nav');
                                if (document.querySelector('main, [role="main"]')) landmarks.push('main');
                                if (document.querySelector('aside, [role="complementary"]')) landmarks.push('aside');
                                if (document.querySelector('footer, [role="contentinfo"]')) landmarks.push('footer');
                                return landmarks;
                            }

                            // Helper: Count interactive elements
                            function countInteractiveElements() {
                                return {
                                    formFields: document.querySelectorAll('input:not([type="hidden"]), textarea, select').length,
                                    buttons: document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').length,
                                    links: document.querySelectorAll('a[href]').length,
                                };
                            }

                            // Helper: Get visible vs hidden ratio
                            function getVisibilityStats() {
                                const allElements = document.querySelectorAll('*');
                                let visible = 0;
                                let hidden = 0;

                                allElements.forEach(el => {
                                    const style = window.getComputedStyle(el);
                                    if (style.display === 'none' || style.visibility === 'hidden') {
                                        hidden++;
                                    } else {
                                        visible++;
                                    }
                                });

                                return { visible, hidden };
                            }

                            // Helper: Detect and extract search bar information
                            function detectSearchBars() {
                                const searchBars: Array<{
                                    selector: string;
                                    type: string;
                                    placeholder?: string;
                                    ariaLabel?: string;
                                    id?: string;
                                    name?: string;
                                    value?: string;
                                    isVisible: boolean;
                                    position: { top: number; left: number; width: number; height: number };
                                }> = [];

                                // Search for input fields with type="search"
                                const searchInputs = document.querySelectorAll('input[type="search"]');

                                // Search for inputs with search-related attributes
                                const searchLikeInputs = document.querySelectorAll(
                                    'input[placeholder*="search" i], input[placeholder*="find" i], ' +
                                    'input[aria-label*="search" i], input[name*="search" i], ' +
                                    'input[id*="search" i], input[class*="search" i], ' +
                                    '[role="searchbox"], [role="search"] input'
                                );

                                // Search for elements with role="search"
                                const searchRoles = document.querySelectorAll('[role="search"]');
                                const searchRoleInputs: Element[] = [];
                                searchRoles.forEach(role => {
                                    const inputs = role.querySelectorAll('input[type="text"], input:not([type])');
                                    inputs.forEach(input => searchRoleInputs.push(input));
                                });

                                // Combine all candidates and deduplicate
                                const allCandidates = new Set([
                                    ...Array.from(searchInputs),
                                    ...Array.from(searchLikeInputs),
                                    ...searchRoleInputs
                                ]);

                                allCandidates.forEach((input) => {
                                    const el = input as HTMLInputElement;
                                    const rect = el.getBoundingClientRect();
                                    const style = window.getComputedStyle(el);
                                    const isVisible = style.display !== 'none' &&
                                        style.visibility !== 'hidden' &&
                                        rect.width > 0 &&
                                        rect.height > 0;

                                    // Generate a reliable selector
                                    let selector = '';
                                    if (el.id) {
                                        selector = `#${el.id}`;
                                    } else if (el.name) {
                                        selector = `input[name="${el.name}"]`;
                                    } else if (el.getAttribute('aria-label')) {
                                        selector = `input[aria-label="${el.getAttribute('aria-label')}"]`;
                                    } else {
                                        // Fallback to a more complex selector
                                        const classList = Array.from(el.classList).join('.');
                                        if (classList) {
                                            selector = `input.${classList}`;
                                        } else {
                                            selector = 'input[type="search"]';
                                        }
                                    }

                                    searchBars.push({
                                        selector,
                                        type: el.type || 'text',
                                        placeholder: el.placeholder || undefined,
                                        ariaLabel: el.getAttribute('aria-label') || undefined,
                                        id: el.id || undefined,
                                        name: el.name || undefined,
                                        value: el.value || undefined,
                                        isVisible,
                                        position: {
                                            top: Math.round(rect.top),
                                            left: Math.round(rect.left),
                                            width: Math.round(rect.width),
                                            height: Math.round(rect.height)
                                        }
                                    });
                                });

                                // Sort by visibility and position (top-left first)
                                searchBars.sort((a, b) => {
                                    if (a.isVisible !== b.isVisible) return a.isVisible ? -1 : 1;
                                    if (a.position.top !== b.position.top) return a.position.top - b.position.top;
                                    return a.position.left - b.position.left;
                                });

                                return searchBars;
                            }

                            // Extract text based on selector
                            if (!sel) {
                                // Full page extraction
                                const cloned = document.body.cloneNode(true) as HTMLElement;
                                cloned.querySelectorAll('script, style, noscript').forEach((e) => e.remove());
                                const text = (cloned.innerText || cloned.textContent || '').trim();

                                const result: any = {
                                    success: true,
                                    text: text.slice(0, maxLen),
                                    truncated: text.length > maxLen
                                };

                                if (withStructure) {
                                    result.structure = {
                                        headings: getHeadingsHierarchy(),
                                        pageType: detectPageType(),
                                        landmarks: getLandmarks(),
                                        ...countInteractiveElements(),
                                        visibility: getVisibilityStats(),
                                    };
                                }

                                if (findSearchBar) {
                                    const searchBars = detectSearchBars();
                                    if (searchBars.length > 0) {
                                        result.searchBars = searchBars;
                                        // Add primary search bar (most likely the main one)
                                        result.primarySearchBar = searchBars[0];
                                    }
                                }

                                return result;
                            }

                            // Selector-based extraction
                            const nodes = Array.from(document.querySelectorAll(sel));
                            if (!nodes.length) return { success: false, error: `No elements match selector: ${sel}` };

                            if (returnAll) {
                                const texts = nodes.map((n) => (n.textContent || '').trim());
                                const joined = texts.join('\n').slice(0, maxLen);
                                return {
                                    success: true,
                                    text: joined,
                                    count: texts.length,
                                    truncated: texts.join('\n').length > maxLen
                                };
                            }

                            const first = nodes[0];
                            const t = (first.textContent || '').trim();
                            return { success: true, text: t.slice(0, maxLen), truncated: t.length > maxLen };
                        }
                    });

                    const result = results[0]?.result;
                    if (result?.success) {
                        log.info("✅ Text extracted successfully", {
                            length: result.text?.length,
                            pageType: result.structure?.pageType,
                            headings: result.structure?.headings
                        });
                    } else {
                        log.warn("extractText failed", result);
                    }
                    return result || { error: "No result" };
                } catch (error) {
                    log.error('[Tool] Error extracting text:', error);
                    return { error: "Failed to extract text" };
                }
            },
        });

        // Register UI for extractText - uses CompactToolRenderer
        registerToolUI('extractText', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ extractText tool registration complete');

        // Register scrollIntoView tool
        log.info('🔧 Registering scrollIntoView tool...');

        registerTool({
            name: "scrollIntoView",
            description: "Scroll an element into view on the page with smooth behavior.",
            parameters: z.object({
                selector: z.string().describe('CSS selector of the element to scroll to'),
                block: z.enum(['start', 'center', 'end', 'nearest']).optional().describe('Vertical alignment (default: nearest)').default('nearest'),
            }),
            execute: async ({ selector, block = 'nearest' }) => {
                try {
                    log.info("TOOL CALL: scrollIntoView", { selector, block });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector, block],
                        func: (sel: string, blk: ScrollLogicalPosition) => {
                            const element = document.querySelector(sel);
                            if (!element) {
                                return { success: false, error: `Element not found: ${sel}` };
                            }

                            element.scrollIntoView({ behavior: 'smooth', block: blk });
                            return { success: true };
                        }
                    });

                    const result = results[0]?.result;
                    if (result?.success) {
                        log.info("✅ Scrolled to element successfully", { selector });
                    } else {
                        log.warn("scrollIntoView failed", result);
                    }
                    return result || { error: "Failed to scroll" };
                } catch (error) {
                    log.error('[Tool] Error scrolling:', error);
                    return { error: "Failed to scroll element into view" };
                }
            },
        });

        // Register UI for scrollIntoView - uses CompactToolRenderer
        registerToolUI('scrollIntoView', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ scrollIntoView tool registration complete');

        // Register findSearchBar tool - dedicated tool for locating search inputs
        log.info('🔧 Registering findSearchBar tool...');

        registerTool({
            name: "findSearchBar",
            description: "Locate and return details about search bars/inputs on the page. Returns selectors, placeholders, and visibility info to help interact with search functionality.",
            parameters: z.object({
                onlyVisible: z.boolean().optional().describe('Only return visible search bars (default: true)').default(true),
            }),
            execute: async ({ onlyVisible = true }) => {
                try {
                    log.info("TOOL CALL: findSearchBar", { onlyVisible });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [Boolean(onlyVisible)],
                        func: (visibleOnly: boolean) => {
                            // Animation: Search Detection (Option A)
                            function showSearchDetection(elements: Element[]) {
                                try {
                                    const css = `
                                        @keyframes ai-search-pulse {
                                            0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                                            50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
                                        }
                                        .ai-search-detected {
                                            animation: ai-search-pulse 300ms ease-out !important;
                                            border: 2px solid rgba(59, 130, 246, 0.8) !important;
                                        }
                                    `;
                                    const style = document.createElement('style');
                                    style.id = 'ai-search-detection-style';
                                    style.textContent = css;
                                    document.head.appendChild(style);

                                    for (let i = 0; i < elements.length; i++) {
                                        setTimeout(() => {
                                            (elements[i] as HTMLElement).classList.add('ai-search-detected');
                                            setTimeout(() => {
                                                (elements[i] as HTMLElement).classList.remove('ai-search-detected');
                                            }, 300);
                                        }, i * 100);
                                    }

                                    setTimeout(() => {
                                        try {
                                            document.getElementById('ai-search-detection-style')?.remove();
                                        } catch (e) { }
                                    }, 300 + elements.length * 100);
                                } catch (e) { }
                            }

                            const searchBars: Array<{
                                selector: string;
                                type: string;
                                placeholder?: string;
                                ariaLabel?: string;
                                id?: string;
                                name?: string;
                                value?: string;
                                isVisible: boolean;
                                position: { top: number; left: number; width: number; height: number };
                            }> = [];

                            // Search for input fields with type="search"
                            const searchInputs = document.querySelectorAll('input[type="search"]');

                            // Search for inputs with search-related attributes
                            const searchLikeInputs = document.querySelectorAll(
                                'input[placeholder*="search" i], input[placeholder*="find" i], ' +
                                'input[aria-label*="search" i], input[name*="search" i], ' +
                                'input[id*="search" i], input[class*="search" i], ' +
                                '[role="searchbox"], [role="search"] input'
                            );

                            // Search for elements with role="search"
                            const searchRoles = document.querySelectorAll('[role="search"]');
                            const searchRoleInputs: Element[] = [];
                            searchRoles.forEach(role => {
                                const inputs = role.querySelectorAll('input[type="text"], input:not([type])');
                                inputs.forEach(input => searchRoleInputs.push(input));
                            });

                            // Combine all candidates and deduplicate
                            const allCandidates = new Set([
                                ...Array.from(searchInputs),
                                ...Array.from(searchLikeInputs),
                                ...searchRoleInputs
                            ]);

                            allCandidates.forEach((input) => {
                                const el = input as HTMLInputElement;
                                const rect = el.getBoundingClientRect();
                                const style = window.getComputedStyle(el);
                                const isVisible = style.display !== 'none' &&
                                    style.visibility !== 'hidden' &&
                                    rect.width > 0 &&
                                    rect.height > 0;

                                // Skip if filtering for visible only
                                if (visibleOnly && !isVisible) return;

                                // Generate a reliable selector
                                let selector = '';
                                if (el.id) {
                                    selector = `#${el.id}`;
                                } else if (el.name) {
                                    selector = `input[name="${el.name}"]`;
                                } else if (el.getAttribute('aria-label')) {
                                    selector = `input[aria-label="${el.getAttribute('aria-label')}"]`;
                                } else if (el.placeholder) {
                                    selector = `input[placeholder="${el.placeholder}"]`;
                                } else {
                                    // Fallback to a more complex selector
                                    const classList = Array.from(el.classList).join('.');
                                    if (classList) {
                                        selector = `input.${classList}`;
                                    } else if (el.type === 'search') {
                                        selector = 'input[type="search"]';
                                    } else {
                                        // Generate nth-of-type selector as last resort
                                        const inputs = Array.from(document.querySelectorAll('input'));
                                        const index = inputs.indexOf(el) + 1;
                                        selector = `input:nth-of-type(${index})`;
                                    }
                                }

                                searchBars.push({
                                    selector,
                                    type: el.type || 'text',
                                    placeholder: el.placeholder || undefined,
                                    ariaLabel: el.getAttribute('aria-label') || undefined,
                                    id: el.id || undefined,
                                    name: el.name || undefined,
                                    value: el.value || undefined,
                                    isVisible,
                                    position: {
                                        top: Math.round(rect.top),
                                        left: Math.round(rect.left),
                                        width: Math.round(rect.width),
                                        height: Math.round(rect.height)
                                    }
                                });
                            });

                            // Sort by visibility and position (top-left first)
                            searchBars.sort((a, b) => {
                                if (a.isVisible !== b.isVisible) return a.isVisible ? -1 : 1;
                                if (a.position.top !== b.position.top) return a.position.top - b.position.top;
                                return a.position.left - b.position.left;
                            });

                            if (searchBars.length === 0) {
                                return {
                                    success: false,
                                    error: "No search bars found on page",
                                    suggestion: "Try looking for other input fields or navigation elements"
                                };
                            }

                            // Show animation for detected search bars
                            const detectedElements = Array.from(allCandidates).filter((input) => {
                                const el = input as HTMLInputElement;
                                const rect = el.getBoundingClientRect();
                                const style = window.getComputedStyle(el);
                                const isVisible = style.display !== 'none' &&
                                    style.visibility !== 'hidden' &&
                                    rect.width > 0 &&
                                    rect.height > 0;
                                return !visibleOnly || isVisible;
                            });
                            showSearchDetection(detectedElements);

                            return {
                                success: true,
                                count: searchBars.length,
                                searchBars,
                                primarySearchBar: searchBars[0], // Most likely the main search bar
                                message: `Found ${searchBars.length} search bar${searchBars.length > 1 ? 's' : ''}`
                            };
                        }
                    });

                    const result = results[0]?.result;
                    if (result?.success) {
                        log.info("✅ Search bars found", {
                            count: result.count,
                            primary: result.primarySearchBar
                        });
                    } else {
                        log.warn("findSearchBar failed", result);
                    }
                    return result || { error: "Failed to find search bars" };
                } catch (error) {
                    log.error('[Tool] Error finding search bars:', error);
                    return { error: "Failed to find search bars" };
                }
            },
        });

        // Register UI for findSearchBar - uses CompactToolRenderer
        registerToolUI('findSearchBar', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ findSearchBar tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up text extraction tools');
            unregisterToolUI('extractText');
            unregisterToolUI('scrollIntoView');
            unregisterToolUI('findSearchBar');
        };
    }, []);
}

