/**
 * Page Context Extractor
 * Extracts comprehensive page information: text, buttons, inputs, links, interactive elements
 * Provides AI with full understanding of page structure
 */

import { createLogger } from '~logger';

const log = createLogger('PageContextExtractor', 'UTILS');

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
                 * SECURITY: 3-Layer sensitive input detection
                 * 
                 * LAYER 1: Type, autocomplete, name, id, placeholder pattern matching
                 * LAYER 2: Password toggle sibling detection (handles "show password" cases)
                 * LAYER 3: Value-based heuristics (catches edge cases)
                 * 
                 * Detects password fields, credit card inputs, SSN, and other PII fields
                 */
                function isSensitiveInput(input: HTMLInputElement | HTMLTextAreaElement): boolean {
                    const type = (input.type || '').toLowerCase();
                    const name = (input.name || '').toLowerCase();
                    const id = (input.id || '').toLowerCase();
                    const autocomplete = (input.autocomplete || '').toLowerCase();
                    const placeholder = (input.placeholder || '').toLowerCase();

                    // ================================================================
                    // LAYER 1: Pattern-based detection
                    // ================================================================

                    // SECURITY: Input types that are inherently sensitive
                    const sensitiveTypes = ['password'];
                    if (sensitiveTypes.includes(type)) {
                        return true;
                    }

                    // SECURITY: Autocomplete values indicating sensitive data
                    const sensitiveAutocomplete = [
                        'cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type',
                        'current-password', 'new-password', 'one-time-code'
                    ];
                    if (sensitiveAutocomplete.some(s => autocomplete.includes(s))) {
                        return true;
                    }

                    // SECURITY: Patterns in name/id/autocomplete/placeholder that indicate sensitive fields
                    // LAYER 1 ENHANCEMENT: Added "pass", "pwd" abbreviations
                    const sensitivePatterns = [
                        /password/i, /passwd/i, /secret/i, /pass/i, /pwd/i,
                        /credit.?card/i, /card.?number/i, /cvv/i, /cvc/i, /csc/i,
                        /ssn/i, /social.?security/i, /tax.?id/i,
                        /pin/i, /security.?code/i, /routing.?number/i, /account.?number/i
                    ];
                    const fieldsToCheck = [name, id, autocomplete, placeholder];
                    for (const field of fieldsToCheck) {
                        if (sensitivePatterns.some(pattern => pattern.test(field))) {
                            return true;
                        }
                    }

                    // ================================================================
                    // LAYER 2: Password toggle sibling detection
                    // ================================================================
                    // Handles "show password" cases where type="text" but it's actually a password field

                    if (type === 'text' || !type) {
                        const togglePatterns = ['toggle', 'eye', 'show', 'hide', 'visibility', 'reveal', 'peek'];
                        const containerPatterns = ['password', 'pass-field', 'pwd-field', 'password-field', 'password-input', 'password-wrapper'];

                        // Check if input is inside a password container
                        const parent = input.closest('[class], [id]');
                        if (parent) {
                            const parentClass = ((parent as HTMLElement).className || '').toLowerCase();
                            const parentId = (parent.id || '').toLowerCase();
                            const combined = parentClass + ' ' + parentId;

                            if (containerPatterns.some(p => combined.includes(p))) {
                                return true;
                            }
                        }

                        // Check for toggle button siblings
                        const parentContainer = input.parentElement;
                        if (parentContainer) {
                            const searchContainers = [parentContainer, parentContainer.parentElement].filter(Boolean) as HTMLElement[];

                            for (const container of searchContainers) {
                                const allElements = container.querySelectorAll('*');
                                for (const el of allElements) {
                                    if (el === input) continue;
                                    const elClass = ((el as HTMLElement).className || '').toLowerCase();
                                    const elId = ((el as HTMLElement).id || '').toLowerCase();
                                    const combined = elClass + ' ' + elId;

                                    if (togglePatterns.some(p => combined.includes(p))) {
                                        return true;
                                    }
                                }

                                // Check for icon selectors (Font Awesome, Material Icons, etc.)
                                const iconSelectors = ['.fa-eye', '.fa-eye-slash', '[class*="icon-eye"]', 'svg[class*="eye"]'];
                                for (const iconSelector of iconSelectors) {
                                    if (container.querySelector(iconSelector)) {
                                        return true;
                                    }
                                }
                            }
                        }

                        // Check associated label
                        if (input.id) {
                            const label = document.querySelector(`label[for="${input.id}"]`);
                            if (label) {
                                const labelText = (label.textContent || '').toLowerCase();
                                if (/password|pass|secret|pin/i.test(labelText)) {
                                    return true;
                                }
                            }
                        }
                    }

                    // ================================================================
                    // LAYER 3: Value-based heuristics
                    // ================================================================
                    // Catches edge cases where value looks like a password

                    if (type === 'text' || !type) {
                        const value = input.value || '';

                        // Skip empty or very short/long values
                        if (value.length >= 8 && value.length <= 128 && !value.includes(' ')) {
                            const hasLowercase = /[a-z]/.test(value);
                            const hasUppercase = /[A-Z]/.test(value);
                            const hasNumbers = /\d/.test(value);
                            const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);

                            // If value has 3+ character types, likely a password
                            const charTypeCount = [hasLowercase, hasUppercase, hasNumbers, hasSymbols].filter(Boolean).length;
                            if (charTypeCount >= 3) {
                                return true;
                            }
                        }
                    }

                    return false;
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

                        // SECURITY: Strip sensitive input values (passwords, credit cards, SSN, etc.) to prevent PII leakage to AI
                        const shouldStripValue = isSensitiveInput(input);

                        inputs.push({
                            type: input.type || 'text',
                            label: getInputLabel(input),
                            placeholder: input.placeholder || undefined,
                            // SECURITY: Stripping value from sensitive fields to prevent sending passwords/PII to AI backend
                            value: shouldStripValue ? undefined : (input.value || undefined),
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

            // SECURITY: Defense-in-depth - never include values from sensitive field types in AI output
            // LAYER 1 patterns expanded with "pass", "pwd" abbreviations
            const isSensitiveType = input.type === 'password' ||
                /password|passwd|pass|pwd|card|cvv|cvc|csc|ssn|secret|pin|security.?code/i.test(input.name || '') ||
                /password|passwd|pass|pwd|card|cvv|cvc|csc|ssn|secret|pin|security.?code/i.test(input.id || '') ||
                /password|passwd|pass|pwd|secret/i.test(input.placeholder || '') ||
                /password|pass|pwd|secret|pin/i.test(label);

            // SECURITY: Stripping sensitive field values to prevent PII leakage to AI
            const valueDisplay = (input.value && !isSensitiveType) ? ` (value: "${input.value.substring(0, 30)}")` : '';
            parts.push(`  • ${input.type}: "${label}"${valueDisplay}`);
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

