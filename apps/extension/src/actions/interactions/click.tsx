import { useEffect } from "react";
import { z } from "zod";
import { createLogger } from '~logger';
import { registerTool } from "@/ai/tools";
import { useToolUI } from "@/ai/tools/components";
import { getClickAnimationInjectScript } from "./clickAnimations";
import type { InteractionResult } from "../types";

const log = createLogger("Actions-Interactions-Click", "TOOLS_EXECUTION");

// Get the animation script once at module load
const clickAnimationScript = getClickAnimationInjectScript();

/**
 * Registers the 'clickElement' tool.
 * This tool allows the AI to click on elements within the active tab using CSS selectors.
 */
export function useClickElementTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering clickElement tool...');

        registerTool({
            name: "clickElement",
            description: "Click an element on the active page by selector, text, or aria-label.",
            parameters: z.object({
                selector: z.string().describe("CSS selector or text/aria-label"),
            }),
            execute: async ({ selector }) => {
                try {
                    log.info("TOOL CALL: clickElement", { selector });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) return { error: "No active tab" };
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector, clickAnimationScript],
                        func: (sel: string, animationScript: string) => {
                            return new Promise((resolve) => {
                                // Wait for page to be fully loaded before interacting
                                const waitForLoad = () => {
                                    if (document.readyState === 'complete') {
                                        performClickAction();
                                    } else {
                                        window.addEventListener('load', performClickAction, { once: true });
                                        // Fallback timeout in case load event doesn't fire
                                        setTimeout(performClickAction, 5000);
                                    }
                                };

                                const performClickAction = () => {
                                    // Inject the animation function if not already present
                                    if (typeof (window as any).showClickAnimation !== 'function') {
                                        // eslint-disable-next-line no-eval
                                        eval(animationScript);
                                    }

                                    let element = document.querySelector(sel);
                                    if (!element) {
                                        const allElements = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
                                        element = allElements.find(el =>
                                            el.textContent?.trim().toLowerCase().includes(sel.toLowerCase()) ||
                                            el.getAttribute('aria-label')?.toLowerCase().includes(sel.toLowerCase())
                                        ) as Element;
                                    }
                                    if (!element) {
                                        resolve({ success: false, error: `Element not found: ${sel}`, suggestion: "Try a different selector, button text, or aria-label" });
                                        return;
                                    }
                                    const elementInfo = { tagName: element.tagName, text: element.textContent?.trim().slice(0, 100), id: (element as HTMLElement).id, className: (element as HTMLElement).className, href: (element as HTMLAnchorElement).href };

                                    // Show animation at element center
                                    const rect = element.getBoundingClientRect();
                                    const x = rect.left + rect.width / 2;
                                    const y = rect.top + rect.height / 2;

                                    // Call the injected animation function
                                    if (typeof (window as any).showClickAnimation === 'function') {
                                        (window as any).showClickAnimation(x, y);
                                    }

                                    (element as HTMLElement).click();
                                    resolve({ success: true, clicked: elementInfo, message: `Successfully clicked ${element.tagName}${(element as HTMLElement).id ? '#' + (element as HTMLElement).id : ''}` });
                                }; // End of performClickAction

                                waitForLoad();
                            }); // End of Promise
                        }
                    });
                    const result = results[0]?.result as InteractionResult | undefined;
                    if (result?.success) log.info("✅ clickElement success", result.clicked);
                    else log.warn("❌ clickElement failed", result);
                    return result || { success: false, error: "Failed to execute click" } as InteractionResult;
                } catch (error) {
                    const errorMsg = (error as Error)?.message || String(error);

                    // Don't retry if frame was removed (page is navigating)
                    if (errorMsg.includes('Frame with ID') || errorMsg.includes('was removed')) {
                        log.warn('[Tool] Frame removed during click - page may be navigating', { selector });
                        return { success: false, error: "Page is navigating - action cancelled to prevent loops", frameRemoved: true } as InteractionResult;
                    }

                    log.error('[Tool] Error clicking element:', error);
                    return { success: false, error: "Failed to click element. Make sure you have permission to access this page." } as InteractionResult;
                }
            },
        });

        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ clickElement tool registration complete');

        return () => {
            log.info('🧹 Cleaning up clickElement tool');
            unregisterToolUI('clickElement');
        };
    }, [registerToolUI, unregisterToolUI]);
}


