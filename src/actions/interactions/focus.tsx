import { useEffect } from "react";
import { z } from "zod";
import { createLogger } from '~logger';
import { CompactToolRenderer } from "@ai/tools/components";
import { registerTool } from "@ai/tools";
import { useToolUI } from "@ai/tools/components";
import type { ToolUIState } from "@ai/tools/components";

const log = createLogger("Actions-Interactions-Focus");

export function useFocusElementTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering focusElement tool...');

        registerTool({
            name: "focusElement",
            description: `Focus a specific element on the page by CSS selector. Brings element into focus and highlights it with spotlight animation.

WHEN TO USE:
- Need to focus an input field before typing (alternative to typeInField with target)
- Bringing keyboard focus to a specific element
- Highlighting an element for user attention

PRECONDITIONS:
- Element must exist and match the selector
- Element must be focusable (input, button, link, or has tabindex)

WORKFLOW:
1. Find element by CSS selector
2. Show spotlight animation (dims page, highlights element)
3. Call element.focus() to set keyboard focus
4. Returns success or error

LIMITATIONS:
- Only works with CSS selectors (not text-based search)
- Element must be focusable (not all elements can receive focus)
- Cannot focus hidden or disabled elements
- Prefer typeInField or clickByText for most interactions

EXAMPLE: focusElement(selector="#search-input") or focusElement(selector="input[name='email']")`,
            parameters: z.object({
                selector: z.string().describe("CSS selector for the element to focus. Examples: '#search-input', 'input[name=\"email\"]', '.login-button', 'textarea'. Must match exactly one element. Use specific selectors to avoid ambiguity."),
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
                            // Track spotlight count for concurrent executions
                            (window as any).__aiSpotlightCount = (window as any).__aiSpotlightCount || 0;

                            // Animation: Spotlight (Option B)
                            function showSpotlight(element: Element) {
                                try {
                                    (window as any).__aiSpotlightCount++;

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

                                    // Idempotent style injection
                                    let style = document.getElementById('ai-spotlight-style') as HTMLStyleElement;
                                    if (!style) {
                                        style = document.createElement('style');
                                        style.id = 'ai-spotlight-style';
                                        style.textContent = css;
                                        document.head.appendChild(style);
                                    }

                                    document.body.classList.add('ai-spotlight-active');
                                    (element as HTMLElement).classList.add('ai-spotlight-element');

                                    setTimeout(() => {
                                        try {
                                            document.body.classList.remove('ai-spotlight-active');
                                            (element as HTMLElement).classList.remove('ai-spotlight-element');

                                            // Only remove style when no active spotlights
                                            (window as any).__aiSpotlightCount--;
                                            if ((window as any).__aiSpotlightCount === 0) {
                                                document.getElementById('ai-spotlight-style')?.remove();
                                            }
                                        } catch (e) {
                                            log.debug('Spotlight cleanup error:', e);
                                        }
                                    }, 250);
                                } catch (e) {
                                    log.debug('Spotlight animation error:', e);
                                    (window as any).__aiSpotlightCount--;
                                }
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


