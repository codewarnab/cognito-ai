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

        registerToolUI('focusElement', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return <ToolCard title="Focusing Element" subtitle={input?.selector} state="loading" icon="🎯" />;
            }
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return <ToolCard title="Focus Failed" subtitle={output.error} state="error" icon="🎯" />;
                }
                return <ToolCard title="Element Focused" subtitle={input?.selector} state="success" icon="🎯" />;
            }
            if (toolState === 'output-error') {
                return <ToolCard title="Focus Failed" subtitle={state.errorText || 'Unknown error'} state="error" icon="🎯" />;
            }
            return null;
        });

        log.info('✅ focusElement tool registration complete');

        return () => {
            log.info('🧹 Cleaning up focusElement tool');
            unregisterToolUI('focusElement');
        };
    }, [registerToolUI, unregisterToolUI]);
}
