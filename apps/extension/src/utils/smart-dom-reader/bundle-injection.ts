/**
 * Smart DOM Reader Bundle Injection
 * Injects the smart-dom-reader bundle into pages for content script execution
 */

import { createLogger } from '~logger';

const log = createLogger('SmartDOMReader-Bundle');

const BUNDLE_INJECTED_KEY = '__smart_dom_reader_injected__';

/**
 * Check if bundle is already injected in the page
 */
async function isBundleInjected(tabId: number): Promise<boolean> {
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (key: string) => {
                return !!(window as any)[key];
            },
            args: [BUNDLE_INJECTED_KEY]
        });
        return result?.result ?? false;
    } catch (error) {
        log.warn('Failed to check bundle injection status:', error);
        return false;
    }
}

/**
 * Inject smart-dom-reader bundle into a page
 */
export async function injectSmartDOMReaderBundle(tabId: number): Promise<boolean> {
    try {
        // Check if already injected
        if (await isBundleInjected(tabId)) {
            log.debug('Bundle already injected');
            return true;
        }

        // Inject the bundle by importing it dynamically in page context
        await chrome.scripting.executeScript({
            target: { tabId },
            func: async (key: string) => {
                // Mark as injected
                (window as any)[key] = true;

                // The bundle will be available via the extension's bundled code
                // We create the SmartDOMReaderBundle namespace on window
                (window as any).SmartDOMReaderBundle = {
                    // SmartDOMReader class
                    SmartDOMReader: {
                        extractInteractive: (doc: Document, options?: any) => {
                            return extractInteractiveFromDocument(doc, options);
                        },
                        extractFull: (doc: Document, options?: any) => {
                            return extractFullFromDocument(doc, options);
                        },
                        extractFromElement: (el: Element, mode: string, options?: any) => {
                            return extractFromElement(el, mode, options);
                        }
                    },
                    // ProgressiveExtractor class
                    ProgressiveExtractor: {
                        extractStructure: (root: Element) => {
                            return extractStructure(root);
                        },
                        extractContent: (root: Element, options?: any) => {
                            return extractContent(root, options);
                        }
                    }
                };

                // Helper functions implemented inline for page context
                function generateSelector(element: Element): string {
                    if (element.id) {
                        return `#${CSS.escape(element.id)}`;
                    }

                    // Check for data-testid
                    const testId = element.getAttribute('data-testid');
                    if (testId) {
                        return `[data-testid="${CSS.escape(testId)}"]`;
                    }

                    // Check for aria-label
                    const ariaLabel = element.getAttribute('aria-label');
                    if (ariaLabel) {
                        return `[aria-label="${CSS.escape(ariaLabel)}"]`;
                    }

                    // Use classes if unique
                    const classes = Array.from(element.classList).filter(c => !c.startsWith('ai-'));
                    if (classes.length > 0) {
                        const classSelector = `.${classes.map(c => CSS.escape(c)).join('.')}`;
                        try {
                            if (document.querySelectorAll(classSelector).length === 1) {
                                return classSelector;
                            }
                        } catch { /* ignore */ }
                    }

                    // Fallback to nth-child
                    const parent = element.parentElement;
                    if (parent) {
                        const siblings = Array.from(parent.children);
                        const index = siblings.indexOf(element) + 1;
                        const tag = element.tagName.toLowerCase();
                        return `${tag}:nth-child(${index})`;
                    }

                    return element.tagName.toLowerCase();
                }

                function isVisible(element: Element): boolean {
                    const style = window.getComputedStyle(element);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return false;
                    }
                    const rect = element.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                }

                function extractInteractiveFromDocument(doc: Document, options: any = {}) {
                    const root = options.mainContentOnly
                        ? (doc.querySelector('main, article, [role="main"]') || doc.body)
                        : doc.body;

                    return extractInteractiveElements(root, options);
                }

                function extractFullFromDocument(doc: Document, options: any = {}) {
                    const root = options.mainContentOnly
                        ? (doc.querySelector('main, article, [role="main"]') || doc.body)
                        : doc.body;

                    const interactive = extractInteractiveElements(root, options);
                    const semantic = extractSemanticElements(root, options);

                    return {
                        ...interactive,
                        semantic,
                        page: {
                            url: window.location.href,
                            title: document.title
                        }
                    };
                }

                function extractFromElement(el: Element, mode: string, options: any = {}) {
                    if (mode === 'full') {
                        const interactive = extractInteractiveElements(el, options);
                        const semantic = extractSemanticElements(el, options);
                        return { ...interactive, semantic };
                    }
                    return extractInteractiveElements(el, options);
                }

                function extractInteractiveElements(root: Element, options: any = {}) {
                    const buttons: any[] = [];
                    const links: any[] = [];
                    const inputs: any[] = [];
                    const forms: any[] = [];
                    const searchBars: any[] = [];

                    // Extract buttons
                    root.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').forEach((el) => {
                        if (!options.includeHidden && !isVisible(el)) return;
                        buttons.push({
                            text: el.textContent?.trim() || '',
                            selector: generateSelector(el),
                            type: el.tagName.toLowerCase(),
                            disabled: (el as HTMLButtonElement).disabled || false
                        });
                    });

                    // Extract links
                    root.querySelectorAll('a[href]').forEach((el) => {
                        if (!options.includeHidden && !isVisible(el)) return;
                        const anchor = el as HTMLAnchorElement;
                        links.push({
                            text: anchor.textContent?.trim() || '',
                            href: anchor.href,
                            selector: generateSelector(el)
                        });
                    });

                    // Extract inputs
                    root.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach((el) => {
                        if (!options.includeHidden && !isVisible(el)) return;
                        const input = el as HTMLInputElement;
                        const inputInfo: any = {
                            selector: generateSelector(el),
                            type: input.type || el.tagName.toLowerCase(),
                            name: input.name || undefined,
                            placeholder: input.placeholder || undefined,
                            value: input.value || undefined
                        };

                        // Check if it's a search bar
                        const isSearch =
                            input.type === 'search' ||
                            input.name?.toLowerCase().includes('search') ||
                            input.placeholder?.toLowerCase().includes('search') ||
                            input.getAttribute('aria-label')?.toLowerCase().includes('search') ||
                            el.closest('[role="search"]') !== null;

                        if (isSearch) {
                            searchBars.push({
                                ...inputInfo,
                                isSearchBar: true
                            });
                        }

                        inputs.push(inputInfo);
                    });

                    // Extract forms
                    root.querySelectorAll('form').forEach((el) => {
                        if (!options.includeHidden && !isVisible(el)) return;
                        const form = el as HTMLFormElement;
                        const formInputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), textarea, select'));
                        forms.push({
                            selector: generateSelector(el),
                            action: form.action || undefined,
                            method: form.method || 'get',
                            fields: formInputs.map(input => ({
                                selector: generateSelector(input),
                                name: (input as HTMLInputElement).name,
                                type: (input as HTMLInputElement).type || input.tagName.toLowerCase()
                            }))
                        });
                    });

                    return {
                        interactive: {
                            buttons,
                            links,
                            inputs,
                            forms
                        },
                        searchBars: searchBars.length > 0 ? searchBars : undefined
                    };
                }

                function extractSemanticElements(root: Element, options: any = {}) {
                    const headings: any[] = [];
                    const images: any[] = [];
                    const tables: any[] = [];
                    const lists: any[] = [];

                    // Extract headings
                    root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
                        if (!options.includeHidden && !isVisible(el)) return;
                        headings.push({
                            level: parseInt(el.tagName[1] || '0'),
                            text: el.textContent?.trim() || '',
                            selector: generateSelector(el)
                        });
                    });

                    // Extract images with alt text
                    root.querySelectorAll('img[alt]').forEach((el) => {
                        if (!options.includeHidden && !isVisible(el)) return;
                        const img = el as HTMLImageElement;
                        if (img.alt) {
                            images.push({
                                alt: img.alt,
                                src: img.src,
                                selector: generateSelector(el)
                            });
                        }
                    });

                    // Extract tables
                    root.querySelectorAll('table').forEach((el) => {
                        if (!options.includeHidden && !isVisible(el)) return;
                        const table = el as HTMLTableElement;
                        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim() || '');
                        tables.push({
                            selector: generateSelector(el),
                            headers,
                            rowCount: table.rows.length
                        });
                    });

                    // Extract lists
                    root.querySelectorAll('ul, ol').forEach((el) => {
                        if (!options.includeHidden && !isVisible(el)) return;
                        const list = el as HTMLUListElement | HTMLOListElement;
                        const items = Array.from(list.querySelectorAll(':scope > li')).slice(0, 10);
                        if (items.length > 0) {
                            lists.push({
                                type: el.tagName.toLowerCase(),
                                selector: generateSelector(el),
                                itemCount: list.querySelectorAll(':scope > li').length,
                                sampleItems: items.map(li => li.textContent?.trim().slice(0, 100) || '')
                            });
                        }
                    });

                    return { headings, images, tables, lists };
                }

                function extractStructure(root: Element) {
                    const regions: any[] = [];
                    const forms: any[] = [];

                    // Detect regions
                    const landmarks = ['header', 'nav', 'main', 'aside', 'footer', 'article', 'section'];
                    landmarks.forEach(landmark => {
                        root.querySelectorAll(landmark).forEach((el) => {
                            regions.push({
                                type: landmark,
                                selector: generateSelector(el),
                                hasContent: (el.textContent?.trim().length || 0) > 50
                            });
                        });
                    });

                    // Also check ARIA landmarks
                    const ariaLandmarks: Record<string, string> = {
                        banner: 'header',
                        navigation: 'nav',
                        main: 'main',
                        complementary: 'aside',
                        contentinfo: 'footer'
                    };
                    Object.entries(ariaLandmarks).forEach(([role, type]) => {
                        root.querySelectorAll(`[role="${role}"]`).forEach((el) => {
                            regions.push({
                                type,
                                selector: generateSelector(el),
                                hasContent: (el.textContent?.trim().length || 0) > 50,
                                ariaRole: role
                            });
                        });
                    });

                    // Detect forms
                    root.querySelectorAll('form').forEach((el) => {
                        const form = el as HTMLFormElement;
                        const inputCount = form.querySelectorAll('input:not([type="hidden"]), textarea, select').length;
                        if (inputCount > 0) {
                            forms.push({
                                selector: generateSelector(el),
                                inputCount,
                                hasSubmit: !!form.querySelector('[type="submit"], button:not([type="button"])')
                            });
                        }
                    });

                    const summary = {
                        totalRegions: regions.length,
                        hasNav: regions.some(r => r.type === 'nav'),
                        hasMain: regions.some(r => r.type === 'main'),
                        hasArticle: regions.some(r => r.type === 'article'),
                        formCount: forms.length
                    };

                    const suggestions = [];
                    if (regions.some(r => r.type === 'main')) {
                        suggestions.push({ selector: 'main', reason: 'Main content area detected' });
                    }
                    if (regions.some(r => r.type === 'article')) {
                        suggestions.push({ selector: 'article', reason: 'Article content detected' });
                    }

                    return { summary, regions, forms, suggestions };
                }

                function extractContent(root: Element, _options: any = {}) {
                    const textContent = root.textContent || '';

                    return {
                        text: {
                            content: textContent.trim()
                        }
                    };
                }
            },
            args: [BUNDLE_INJECTED_KEY]
        });

        log.info('Smart DOM Reader bundle injected successfully');
        return true;
    } catch (error) {
        log.error('Failed to inject Smart DOM Reader bundle:', error);
        return false;
    }
}

/**
 * Ensure bundle is available in page context
 */
export async function ensureBundleInjected(tabId: number): Promise<boolean> {
    return await injectSmartDOMReaderBundle(tabId);
}
