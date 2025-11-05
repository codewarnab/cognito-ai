/**
 * Page Context Extractor
 * Extracts comprehensive page information: text, buttons, inputs, links, interactive elements
 * Provides AI with full understanding of page structure
 */

import { createLogger } from '../logger';

const log = createLogger('PageContextExtractor');

export interface PageContext {
    url: string;
    title: string;
    text: string;
    inputs: Array<{
        type: string;
        label?: string;
        placeholder?: string;
        value?: string;
        name?: string;
        id?: string;
    }>;
    buttons: Array<{
        text: string;
        type?: string;
        id?: string;
        ariaLabel?: string;
    }>;
    links: Array<{
        text: string;
        href: string;
        title?: string;
    }>;
    headings: Array<{
        level: number;
        text: string;
    }>;
    metadata: {
        description?: string;
        keywords?: string;
    };
}

/**
 * Extract comprehensive page context from active tab
 */
export async function extractPageContext(): Promise<PageContext | null> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id || !tab.url) return null;

        // Skip chrome:// and extension pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return null;
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // ===== UTILITY FUNCTIONS =====

                /**
                 * Check if element is visible
                 */
                function isVisible(element: HTMLElement): boolean {
                    if (!element) return false;

                    const style = window.getComputedStyle(element);
                    if (style.display === 'none' ||
                        style.visibility === 'hidden' ||
                        style.opacity === '0') {
                        return false;
                    }

                    const rect = element.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                }

                /**
                 * Get element's descriptive label
                 */
                function getInputLabel(input: HTMLElement): string | undefined {
                    // Try aria-label
                    const ariaLabel = input.getAttribute('aria-label');
                    if (ariaLabel) return ariaLabel;

                    // Try associated label
                    if (input.id) {
                        const label = document.querySelector(`label[for="${input.id}"]`);
                        if (label?.textContent) return label.textContent.trim();
                    }

                    // Try parent label
                    const parentLabel = input.closest('label');
                    if (parentLabel?.textContent) {
                        return parentLabel.textContent.trim();
                    }

                    // Try aria-labelledby
                    const ariaLabelledBy = input.getAttribute('aria-labelledby');
                    if (ariaLabelledBy) {
                        const labelEl = document.getElementById(ariaLabelledBy);
                        if (labelEl?.textContent) return labelEl.textContent.trim();
                    }

                    return undefined;
                }

                /**
                 * Get all visible text nodes (clean, deduplicated)
                 */
                function extractVisibleText(): string {
                    const texts: string[] = [];
                    const seen = new Set<string>();

                    // Get main content first (prioritize article, main, content areas)
                    const mainContent = document.querySelector('main, article, [role="main"], #content, .content');
                    const root = mainContent || document.body;

                    const walker = document.createTreeWalker(
                        root,
                        NodeFilter.SHOW_TEXT,
                        {
                            acceptNode: (node: Node) => {
                                const text = node.textContent?.trim() || '';
                                if (text.length < 3) return NodeFilter.FILTER_REJECT;

                                const parent = node.parentElement;
                                if (!parent) return NodeFilter.FILTER_REJECT;

                                // Skip scripts, styles, hidden elements
                                const tagName = parent.tagName?.toLowerCase();
                                if (['script', 'style', 'noscript', 'svg'].includes(tagName)) {
                                    return NodeFilter.FILTER_REJECT;
                                }

                                if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;

                                return NodeFilter.FILTER_ACCEPT;
                            }
                        }
                    );

                    let node: Node | null;
                    while (node = walker.nextNode()) {
                        const text = node.textContent?.trim() || '';
                        if (text && !seen.has(text)) {
                            texts.push(text);
                            seen.add(text);
                        }
                    }

                    return texts.join(' ').substring(0, 5000); // Limit to 5000 chars
                }

                /**
                 * Extract all input fields
                 */
                function extractInputs(): Array<any> {
                    const inputs: Array<any> = [];

                    // Standard inputs
                    const inputElements = Array.from(document.querySelectorAll<HTMLInputElement>(
                        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea'
                    ));

                    for (const input of inputElements) {
                        if (!isVisible(input)) continue;

                        inputs.push({
                            type: input.type || 'text',
                            label: getInputLabel(input),
                            placeholder: input.placeholder || undefined,
                            value: input.value || undefined,
                            name: input.name || undefined,
                            id: input.id || undefined,
                        });
                    }

                    // ContentEditable elements
                    const editableElements = Array.from(document.querySelectorAll('[contenteditable="true"], [contenteditable=""]'));
                    for (const el of editableElements) {
                        if (!isVisible(el as HTMLElement)) continue;

                        inputs.push({
                            type: 'contenteditable',
                            label: getInputLabel(el as HTMLElement),
                            placeholder: el.getAttribute('placeholder') || undefined,
                            id: (el as HTMLElement).id || undefined,
                        });
                    }

                    return inputs.slice(0, 50); // Limit to 50 inputs
                }

                /**
                 * Extract all buttons (real buttons and button-like elements)
                 */
                function extractButtons(): Array<any> {
                    const buttons: Array<any> = [];
                    const seen = new Set<string>();

                    // Real buttons
                    const buttonElements = Array.from(document.querySelectorAll(
                        'button, input[type="submit"], input[type="button"], [role="button"]'
                    ));

                    for (const btn of buttonElements) {
                        if (!isVisible(btn as HTMLElement)) continue;

                        const text = (btn.textContent?.trim() ||
                            (btn as HTMLInputElement).value ||
                            btn.getAttribute('aria-label') || '').substring(0, 100);

                        if (!text || seen.has(text)) continue;
                        seen.add(text);

                        buttons.push({
                            text,
                            type: (btn as HTMLInputElement).type || 'button',
                            id: (btn as HTMLElement).id || undefined,
                            ariaLabel: btn.getAttribute('aria-label') || undefined,
                        });
                    }

                    return buttons.slice(0, 50); // Limit to 50 buttons
                }

                /**
                 * Extract all links
                 */
                function extractLinks(): Array<any> {
                    const links: Array<any> = [];
                    const linkElements = Array.from(document.querySelectorAll('a[href]'));

                    for (const link of linkElements) {
                        if (!isVisible(link as HTMLElement)) continue;

                        const text = link.textContent?.trim() || '';
                        const href = (link as HTMLAnchorElement).href;

                        if (!text || !href || href.startsWith('javascript:')) continue;

                        links.push({
                            text: text.substring(0, 100),
                            href: href.substring(0, 200),
                            title: link.getAttribute('title') || undefined,
                        });
                    }

                    return links.slice(0, 30); // Limit to 30 links
                }

                /**
                 * Extract headings
                 */
                function extractHeadings(): Array<any> {
                    const headings: Array<any> = [];
                    const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));

                    for (const heading of headingElements) {
                        if (!isVisible(heading as HTMLElement)) continue;

                        const text = heading.textContent?.trim() || '';
                        if (!text) continue;

                        headings.push({
                            level: parseInt(heading.tagName[1] || '1', 10),
                            text: text.substring(0, 200),
                        });
                    }

                    return headings.slice(0, 20); // Limit to 20 headings
                }

                /**
                 * Extract metadata
                 */
                function extractMetadata(): any {
                    const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
                    const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');

                    return {
                        description: description?.substring(0, 500) || undefined,
                        keywords: keywords?.substring(0, 200) || undefined,
                    };
                }

                // ===== MAIN EXTRACTION =====

                return {
                    url: window.location.href,
                    title: document.title,
                    text: extractVisibleText(),
                    inputs: extractInputs(),
                    buttons: extractButtons(),
                    links: extractLinks(),
                    headings: extractHeadings(),
                    metadata: extractMetadata(),
                };
            }
        });

        const context = results[0]?.result as PageContext;
        return context || null;

    } catch (error) {
        log.error('Failed to extract page context:', error);
        return null;
    }
}

/**
 * Format page context for AI consumption (concise, readable)
 */
export function formatPageContextForAI(context: PageContext): string {
    const parts: string[] = [];

    parts.push(`📄 Current Page: ${context.title}`);
    parts.push(`🔗 URL: ${context.url}`);

    if (context.metadata.description) {
        parts.push(`📝 Description: ${context.metadata.description}`);
    }

    if (context.headings.length > 0) {
        parts.push(`\n📑 Headings:`);
        context.headings.slice(0, 10).forEach(h => {
            parts.push(`  ${'#'.repeat(h.level)} ${h.text}`);
        });
    }

    if (context.inputs.length > 0) {
        parts.push(`\n📝 Input Fields (${context.inputs.length}):`);
        context.inputs.slice(0, 15).forEach((input, i) => {
            const label = input.label || input.placeholder || input.name || `Input ${i + 1}`;
            parts.push(`  • ${input.type}: "${label}"${input.value ? ` (value: "${input.value.substring(0, 30)}")` : ''}`);
        });
    }

    if (context.buttons.length > 0) {
        parts.push(`\n🔘 Buttons (${context.buttons.length}):`);
        context.buttons.slice(0, 15).forEach(btn => {
            parts.push(`  • "${btn.text}"`);
        });
    }

    if (context.links.length > 0) {
        parts.push(`\n🔗 Key Links (${context.links.length} total):`);
        context.links.slice(0, 10).forEach(link => {
            parts.push(`  • "${link.text}" → ${link.href}`);
        });
    }

    if (context.text) {
        const preview = context.text.substring(0, 800);
        parts.push(`\n📄 Page Content Preview:`);
        parts.push(preview + (context.text.length > 800 ? '...' : ''));
    }

    return parts.join('\n');
}
