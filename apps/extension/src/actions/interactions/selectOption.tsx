
import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { createLogger } from '~logger';

const log = createLogger("Actions-Interactions-SelectOption");

/**
 * Hook to register the select option tool
 */
export function useSelectOptionTool() {
    useEffect(() => {
        log.info('🔧 Registering selectOption tool...');

        registerTool({
            name: "selectOption",
            description: `Select an option from a dropdown menu. Supports both standard HTML <select> tags and custom UI libraries (like Radix UI, Shadcn, MUI). handled automatically. USE FOR: Changing values in dropdowns, comboboxes, language pickers, etc.`,
            parameters: z.object({
                target: z.string().describe('Description or selector of the dropdown element. E.g., "language picker", "#country-select", "Select a fruit"'),
                value: z.string().describe('The visible text or value of the option to select. E.g., "English", "United States", "Banana"'),
            }),
            execute: async ({ target, value }) => {
                try {
                    log.info("TOOL CALL: selectOption", { target, value });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) return { error: "No active tab" };

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: true },
                        args: [target, value],
                        func: (targetDesc: string, valueText: string) => {
                            return new Promise((resolve) => {
                                const waitForLoad = () => {
                                    if (document.readyState === 'complete') {
                                        performSelectAction();
                                    } else {
                                        window.addEventListener('load', performSelectAction, { once: true });
                                        setTimeout(performSelectAction, 5000); // Fallback
                                    }
                                };

                                const performSelectAction = async () => {
                                    // --- UTILS ---

                                    function highlightElement(element: HTMLElement) {
                                        const originalOutline = element.style.outline;
                                        element.style.outline = '2px solid #06B6D4';
                                        setTimeout(() => { element.style.outline = originalOutline; }, 1000);
                                    }

                                    function getVisibleText(element: HTMLElement): string {
                                        return element.innerText || element.textContent || '';
                                    }

                                    // Find element logic (simplified from typeInField)
                                    function findElementRegex(text: string, root: ParentNode = document): HTMLElement | null {
                                        // 1. Try selector
                                        try {
                                            const bySelector = root.querySelector(text);
                                            if (bySelector) return bySelector as HTMLElement;
                                        } catch (e) { }

                                        // 2. Try by text content / placeholder / aria-label
                                        const all = Array.from(root.querySelectorAll('select, [role="combobox"], button, div[role="button"]'));
                                        const lowerText = text.toLowerCase();

                                        let bestMatch: HTMLElement | null = null;
                                        let bestScore = 0;

                                        for (const el of all) {
                                            let score = 0;
                                            const elText = getVisibleText(el as HTMLElement).toLowerCase();
                                            const placeholder = (el as HTMLInputElement).placeholder?.toLowerCase() || '';
                                            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                                            const labelEl = (el as HTMLElement).id ? document.querySelector(`label[for="${(el as HTMLElement).id}"]`) : null;
                                            const labelText = labelEl?.textContent?.toLowerCase() || '';

                                            // Only consider visible elements
                                            const rect = el.getBoundingClientRect();
                                            if (rect.width === 0 || rect.height === 0) continue;

                                            if (elText.includes(lowerText)) score += 10;
                                            if (elText === lowerText) score += 20;
                                            if (placeholder.includes(lowerText)) score += 10;
                                            if (ariaLabel.includes(lowerText)) score += 15;
                                            if (labelText.includes(lowerText)) score += 15;

                                            if (score > bestScore) {
                                                bestScore = score;
                                                bestMatch = el as HTMLElement;
                                            }
                                        }

                                        return bestMatch;
                                    }

                                    // --- MAIN ---
                                    const element = findElementRegex(targetDesc);

                                    if (!element) {
                                        resolve({ success: false, error: `Could not find dropdown matching "${targetDesc}"` });
                                        return;
                                    }

                                    highlightElement(element);
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                    // CASE 1: Native <select>
                                    if (element.tagName.toLowerCase() === 'select') {
                                        const select = element as HTMLSelectElement;
                                        let optionToSelect: HTMLOptionElement | undefined;

                                        // Find option by text or value
                                        for (const opt of Array.from(select.options)) {
                                            if (opt.text.toLowerCase().includes(valueText.toLowerCase()) ||
                                                opt.value.toLowerCase() === valueText.toLowerCase()) {
                                                optionToSelect = opt;
                                                break;
                                            }
                                        }

                                        if (optionToSelect) {
                                            select.value = optionToSelect.value;
                                            select.dispatchEvent(new Event('change', { bubbles: true }));
                                            select.dispatchEvent(new Event('input', { bubbles: true }));
                                            resolve({ success: true, message: `Selected "${optionToSelect.text}" in native dropdown` });
                                        } else {
                                            resolve({ success: false, error: `Option "${valueText}" not found in dropdown options` });
                                        }
                                        return;
                                    }

                                    // CASE 2: Custom Dropdown (Radix, etc.)
                                    // Assume element is the trigger. We need to click it, wait for menu, find option, click it.
                                    try {
                                        // Click trigger
                                        (element as HTMLElement).click();

                                        // Wait for the menu to open. 
                                        const now = Date.now();
                                        const maxWait = 2000;

                                        const interval = setInterval(() => {
                                            if (Date.now() - now > maxWait) {
                                                clearInterval(interval);
                                                resolve({ success: false, error: `Opened dropdown but count not find option matching "${valueText}" within timeout.` });
                                                return;
                                            }

                                            // Strategy: Radix and others often render the content in a portal at the end of body.
                                            // We look for elements with role="option" or "menuitem" that are currently visible.
                                            let potentialOptions = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], .select-item, .dropdown-item, li'));

                                            // Filter for visibility
                                            potentialOptions = potentialOptions.filter(opt => {
                                                const r = opt.getBoundingClientRect();
                                                return r.width > 0 && r.height > 0;
                                            });

                                            // Find match
                                            let match: HTMLElement | null = null;
                                            const searchLower = valueText.toLowerCase().trim();

                                            for (const opt of potentialOptions) {
                                                const text = (opt.textContent || '').toLowerCase().trim();
                                                if (text === searchLower || text.includes(searchLower)) {
                                                    match = opt as HTMLElement;
                                                    break;
                                                }
                                            }

                                            if (match) {
                                                clearInterval(interval);
                                                highlightElement(match);

                                                // Radix UI and some modern libs rely on Pointer Events
                                                const opts = { bubbles: true, cancelable: true, view: window };
                                                match.dispatchEvent(new PointerEvent('pointerdown', opts));
                                                match.dispatchEvent(new MouseEvent('mousedown', opts));
                                                match.dispatchEvent(new PointerEvent('pointerup', opts));
                                                match.dispatchEvent(new MouseEvent('mouseup', opts));
                                                match.click();

                                                resolve({ success: true, message: `Selected "${match.textContent?.trim()}" (Custom Dropdown)` });
                                            }
                                        }, 100);

                                    } catch (e) {
                                        resolve({ success: false, error: `Failed to interact with custom dropdown: ${String(e)}` });
                                    }
                                };

                                waitForLoad();
                            });
                        }
                    });

                    const result = results[0]?.result as any;
                    if (result?.success) {
                        log.info("✅ selectOption success", result);
                    } else {
                        log.warn("❌ selectOption failed", result);
                    }
                    return result || { error: "Failed to execute selectOption" };

                } catch (error) {
                    log.error('[Tool] Error selecting option:', error);
                    return { error: "Failed to select option. Unexpected error." };
                }
            }
        });

        log.info('✅ selectOption tool registration complete');
    }, []);
}
