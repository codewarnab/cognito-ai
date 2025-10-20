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

        registerToolUI('clickElement', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return <ToolCard title="Clicking Element" subtitle={input?.selector} state="loading" icon="👆" />;
            }
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard title="Click Failed" subtitle={output.error} state="error" icon="👆">
                            {output.suggestion && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>{output.suggestion}</div>}
                        </ToolCard>
                    );
                }
                return (
                    <ToolCard title="Element Clicked" subtitle={output.message || 'Click successful'} state="success" icon="👆">
                        {output.clicked && (
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                <Badge label={output.clicked.tagName} variant="default" />
                                {output.clicked.text && <div style={{ marginTop: '4px', opacity: 0.7 }}>{output.clicked.text}</div>}
                            </div>
                        )}
                    </ToolCard>
                );
            }
            if (toolState === 'output-error') {
                return <ToolCard title="Click Failed" subtitle={state.errorText || 'Unknown error'} state="error" icon="👆" />;
            }
            return null;
        });

        log.info('✅ clickElement tool registration complete');

        return () => {
            log.info('🧹 Cleaning up clickElement tool');
            unregisterToolUI('clickElement');
        };
    }, [registerToolUI, unregisterToolUI]);
}
