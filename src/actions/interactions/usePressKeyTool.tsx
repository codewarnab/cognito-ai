
// Keep only pressKey from old keyboard interactions
import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '@logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import type { ToolUIState } from '../../ai/tools/components';

const log = createLogger("Actions-Interactions-PressKey");

/**
 * Hook to register pressKey tool (for special keys like Enter, Tab, Escape, etc.)
 */
export function usePressKeyTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering pressKey tool...');

        registerTool({
            name: "pressKey",
            description: "Press a special key on the currently focused element (e.g., Enter, Escape, Tab, ArrowDown, Space). Use this for navigation keys, not for typing text.",
            parameters: z.object({
                key: z.string().describe('Key to press (e.g., "Enter", "Escape", "Tab", "ArrowDown", "ArrowUp", "Space", "Backspace")'),
            }),
            execute: async ({ key }) => {
                try {
                    log.info("TOOL CALL: pressKey", { key });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) return { error: "No active tab" };

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [key],
                        func: (k: string) => {
                            const target = document.activeElement as Element | null;
                            if (!target) return { success: false, error: 'No active element found' };

                            const focusable = target as HTMLElement;
                            if (typeof focusable.focus === 'function') focusable.focus();

                            const base: KeyboardEventInit = {
                                key: k,
                                code: k,
                                bubbles: true,
                                cancelable: true
                            };

                            const keydown = new KeyboardEvent('keydown', base);
                            const keypress = new KeyboardEvent('keypress', base);
                            const keyup = new KeyboardEvent('keyup', base);

                            target.dispatchEvent(keydown);
                            target.dispatchEvent(keypress);
                            target.dispatchEvent(keyup);
                            return { success: true };
                        }
                    });

                    const result = results[0]?.result;
                    if (result?.success) {
                        log.info("✅ Key pressed successfully", { key });
                    } else {
                        log.warn("pressKey failed", result);
                    }
                    return result || { error: "No result" };
                } catch (error) {
                    log.error('[Tool] Error pressing key:', error);
                    return { error: "Failed to press key" };
                }
            },
        });

        // Use CompactToolRenderer for consistent modern UI
        registerToolUI('pressKey', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ pressKey tool registration complete');

        return () => {
            log.info('🧹 Cleaning up pressKey tool');
            unregisterToolUI('pressKey');
        };
    }, [registerToolUI, unregisterToolUI]);
}

