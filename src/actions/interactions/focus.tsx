import React, { useEffect } from "react";
import { z } from "zod";
import { createLogger } from "../../logger";
import { ToolCard } from "../../components/ui/ToolCard";
import { registerTool } from "../../ai/toolRegistryUtils";
import { useToolUI } from "../../ai/ToolUIContext";
import type { ToolUIState } from "../../ai/ToolUIContext";

const log = createLogger("Actions-Interactions-Focus");

export function useFocusElementTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering focusElement tool...');

        registerTool({
            name: "focusElement",
            description: "Focus an element by selector.",
            parameters: z.object({
                selector: z.string().describe("Element selector"),
            }),
            execute: async ({ selector }) => {
                try {
                    log.info("TOOL CALL: focusElement", { selector });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector],
                        func: (sel: string) => {
                            const el = document.querySelector(sel) as HTMLElement | null;
                            if (!el) return { success: false, error: `Element not found: ${sel}` };
                            el.focus();
                            return { success: true };
                        }
                    });
                    const result = results[0]?.result || { error: "No result" };
                    log.info('✅ focusElement completed', { result });
                    return result;
                } catch (error) {
                    log.error('[Tool] Error focusing element:', error);
                    return { error: "Failed to focus element" };
                }
            },
        });

        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ focusElement tool registration complete');

        return () => {
            log.info('🧹 Cleaning up focusElement tool');
            unregisterToolUI('focusElement');
        };
    }, [registerToolUI, unregisterToolUI]);
}
