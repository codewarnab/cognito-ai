import { useEffect } from "react";
import { z } from "zod";
import { createLogger } from '~logger';
import { CompactToolRenderer } from "../../ai/tools/components";
import { registerTool } from "../../ai/tools";
import { useToolUI } from "../../ai/tools/components";
import type { ToolUIState } from "../../ai/tools/components";

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
                    if (!tab || !tab.id) return { error: "No active tab" };
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector],
                        func: (sel: string) => {
                            // Animation: Spotlight (Option B)
                            function showSpotlight(element: Element) {
                                try {
                                    const css = `
                                        @keyframes ai-spotlight-dim { 0% { opacity: 0; } 100% { opacity: 1; } }
                                        @keyframes ai-spotlight-brighten { 0% { filter: brightness(1); } 100% { filter: brightness(1.3); } }
                                        body.ai-spotlight-active::before {
                                            content: ''; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                                            background: rgba(0, 0, 0, 0.7); z-index: 999996; pointer-events: none;
                                            animation: ai-spotlight-dim 250ms ease-out forwards;
                                        }
                                        .ai-spotlight-element {
                                            position: relative !important; z-index: 999997 !important;
                                            animation: ai-spotlight-brighten 250ms ease-out forwards !important;
                                            box-shadow: 0 0 30px 10px rgba(59, 130, 246, 0.6) !important;
                                        }
                                    `;
                                    const style = document.createElement('style');
                                    style.id = 'ai-spotlight-style';
                                    style.textContent = css;
                                    document.head.appendChild(style);

                                    document.body.classList.add('ai-spotlight-active');
                                    (element as HTMLElement).classList.add('ai-spotlight-element');

                                    setTimeout(() => {
                                        try {
                                            document.body.classList.remove('ai-spotlight-active');
                                            (element as HTMLElement).classList.remove('ai-spotlight-element');
                                            document.getElementById('ai-spotlight-style')?.remove();
                                        } catch (e) { }
                                    }, 250);
                                } catch (e) { }
                            }

                            const el = document.querySelector(sel) as HTMLElement | null;
                            if (!el) return { success: false, error: `Element not found: ${sel}` };
                            showSpotlight(el);
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

        // Use CompactToolRenderer for consistent modern UI
        registerToolUI('focusElement', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ focusElement tool registration complete');

        return () => {
            log.info('🧹 Cleaning up focusElement tool');
            unregisterToolUI('focusElement');
        };
    }, [registerToolUI, unregisterToolUI]);
}


