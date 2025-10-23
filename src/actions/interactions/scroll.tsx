import React, { useEffect } from "react";
import { z } from "zod";
import { createLogger } from "../../logger";
import { ToolCard, Badge } from "../../components/ui/ToolCard";
import { registerTool } from "../../ai/toolRegistryUtils";
import { useToolUI } from "../../ai/ToolUIContext";
import type { ToolUIState } from "../../ai/ToolUIContext";

const log = createLogger("Actions-Interactions-Scroll");

export function useScrollPageTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering scrollPage tool...');

        registerTool({
            name: "scrollPage",
            description: "Scroll page up/down/top/bottom or to a specific element.",
            parameters: z.object({
                direction: z.enum(['up', 'down', 'top', 'bottom', 'to-element']).describe("Scroll direction"),
                amount: z.number().optional().default(500).describe("Pixels to scroll (for up/down). Default 500"),
                selector: z.string().optional().describe("CSS selector for 'to-element'"),
            }),
            execute: async ({ direction, amount, selector }) => {
                try {
                    log.info("TOOL CALL: scrollPage", { direction, amount, selector });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [direction, amount || 500, selector || null],
                        func: (dir: string, amt: number, sel: string | null) => {
                            // Animation: Page Slide (Option C)
                            function showPageSlide(direction: 'up' | 'down') {
                                try {
                                    const css = `
                                        @keyframes ai-page-slide-indicator {
                                            0% { opacity: 0; transform: translateY(${direction === 'down' ? '-20px' : '20px'}); }
                                            50% { opacity: 1; transform: translateY(0); }
                                            100% { opacity: 0; transform: translateY(${direction === 'down' ? '20px' : '-20px'}); }
                                        }
                                        .ai-page-slide-indicator {
                                            position: fixed; ${direction === 'down' ? 'top' : 'bottom'}: 50%; right: 20px;
                                            width: 40px; height: 40px; background: rgba(59, 130, 246, 0.8); border-radius: 50%;
                                            display: flex; align-items: center; justify-content: center;
                                            color: white; font-size: 24px; font-weight: bold; z-index: 999999; pointer-events: none;
                                            animation: ai-page-slide-indicator 250ms ease-out forwards;
                                        }
                                    `;
                                    const style = document.createElement('style');
                                    style.id = 'ai-page-slide-style';
                                    style.textContent = css;
                                    document.head.appendChild(style);

                                    const indicator = document.createElement('div');
                                    indicator.className = 'ai-page-slide-indicator';
                                    indicator.textContent = direction === 'down' ? '↓' : '↑';
                                    document.body.appendChild(indicator);

                                    setTimeout(() => {
                                        try {
                                            indicator.remove();
                                            document.getElementById('ai-page-slide-style')?.remove();
                                        } catch (e) { }
                                    }, 250);
                                } catch (e) { }
                            }

                            const beforeScroll = window.scrollY;
                            switch (dir.toLowerCase()) {
                                case 'up':
                                    showPageSlide('up');
                                    window.scrollBy({ top: -amt, behavior: 'smooth' });
                                    break;
                                case 'down':
                                    showPageSlide('down');
                                    window.scrollBy({ top: amt, behavior: 'smooth' });
                                    break;
                                case 'top': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
                                case 'bottom': window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); break;
                                case 'to-element':
                                    if (!sel) return { success: false, error: "Selector required for 'to-element' direction" };
                                    const element = document.querySelector(sel);
                                    if (!element) return { success: false, error: `Element not found: ${sel}` };
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    break;
                                default:
                                    return { success: false, error: `Invalid direction: ${dir}. Use 'up','down','top','bottom','to-element'` };
                            }
                            setTimeout(() => {
                                const afterScroll = window.scrollY;
                                return { success: true, direction: dir, scrolledFrom: beforeScroll, scrolledTo: afterScroll, scrollDistance: Math.abs(afterScroll - beforeScroll) };
                            }, 100);
                            return { success: true, direction: dir, message: `Scrolling ${dir}${amt ? ' by ' + amt + 'px' : ''}${sel ? ' to ' + sel : ''}` };
                        }
                    });
                    const result = results[0]?.result;
                    log.info("✅ scrollPage completed", result);
                    return result || { success: true, message: `Scrolling ${direction}` };
                } catch (error) {
                    log.error('[Tool] Error scrolling page:', error);
                    return { error: "Failed to scroll page. Make sure you have permission to access this page." };
                }
            },
        });

        registerToolUI('scrollPage', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                const scrollInfo = input?.direction === "to-element" && input?.selector
                    ? `to ${input.selector}`
                    : input?.amount ? `${input.direction} ${input.amount}px` : input?.direction;
                return <ToolCard title="Scrolling Page" subtitle={scrollInfo} state="loading" icon="📜" />;
            }
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return <ToolCard title="Scroll Failed" subtitle={output.error} state="error" icon="📜" />;
                }
                return (
                    <ToolCard title="Page Scrolled" subtitle={output.message || `Scrolled ${output.direction}`} state="success" icon="📜">
                        {output.scrollDistance !== undefined && (
                            <Badge label={`${output.scrollDistance}px`} variant="success" />
                        )}
                    </ToolCard>
                );
            }
            if (toolState === 'output-error') {
                return <ToolCard title="Scroll Failed" subtitle={state.errorText || 'Unknown error'} state="error" icon="📜" />;
            }
            return null;
        });

        log.info('✅ scrollPage tool registration complete');

        return () => {
            log.info('🧹 Cleaning up scrollPage tool');
            unregisterToolUI('scrollPage');
        };
    }, [registerToolUI, unregisterToolUI]);
}