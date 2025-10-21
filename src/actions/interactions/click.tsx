import React, { useEffect } from "react";
import { z } from "zod";
import { createLogger } from "../../logger";
import { ToolCard, Badge } from "../../components/ui/ToolCard";
import { registerTool } from "../../ai/toolRegistryUtils";
import { useToolUI } from "../../ai/ToolUIContext";
import type { ToolUIState } from "../../ai/ToolUIContext";

const log = createLogger("Actions-Interactions-Click");

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
                    if (!tab.id) return { error: "No active tab" };
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector],
                        func: (sel: string) => {
                            let element = document.querySelector(sel);
                            if (!element) {
                                const allElements = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
                                element = allElements.find(el =>
                                    el.textContent?.trim().toLowerCase().includes(sel.toLowerCase()) ||
                                    el.getAttribute('aria-label')?.toLowerCase().includes(sel.toLowerCase())
                                ) as Element;
                            }
                            if (!element) {
                                return { success: false, error: `Element not found: ${sel}`, suggestion: "Try a different selector, button text, or aria-label" };
                            }
                            const elementInfo = { tagName: element.tagName, text: element.textContent?.trim().slice(0, 100), id: (element as HTMLElement).id, className: (element as HTMLElement).className, href: (element as HTMLAnchorElement).href };
                            (element as HTMLElement).click();
                            return { success: true, clicked: elementInfo, message: `Successfully clicked ${element.tagName}${(element as HTMLElement).id ? '#' + (element as HTMLElement).id : ''}` };
                        }
                    });
                    const result = results[0]?.result;
                    if (result?.success) log.info("✅ clickElement success", result.clicked);
                    else log.warn("❌ clickElement failed", result);
                    return result || { error: "Failed to execute click" };
                } catch (error) {
                    const errorMsg = (error as Error)?.message || String(error);

                    // Don't retry if frame was removed (page is navigating)
                    if (errorMsg.includes('Frame with ID') || errorMsg.includes('was removed')) {
                        log.warn('[Tool] Frame removed during click - page may be navigating', { selector });
                        return { error: "Page is navigating - action cancelled to prevent loops", frameRemoved: true };
                    }

                    log.error('[Tool] Error clicking element:', error);
                    return { error: "Failed to click element. Make sure you have permission to access this page." };
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
