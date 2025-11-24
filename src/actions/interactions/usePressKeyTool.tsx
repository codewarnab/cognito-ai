
// Keep only pressKey from old keyboard interactions
import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@ai/tools';
import { useToolUI } from '@ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@ai/tools/components';
import type { ToolUIState } from '@ai/tools/components';

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
            description: `Press a special keyboard key on the currently focused element. Use for navigation and control keys, not for typing text.

WHEN TO USE:
- Need to press Enter to submit a form or search
- Navigate with arrow keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
- Close modals or cancel actions with Escape
- Navigate between fields with Tab
- Trigger keyboard shortcuts (Space, Backspace, etc.)

PRECONDITIONS:
- An element must be currently focused (use typeInField or clickByText first)
- Key must be a valid keyboard key name

WORKFLOW:
1. Get currently focused element
2. Dispatch keydown, keypress, keyup events in sequence
3. Simulates real keyboard interaction

LIMITATIONS:
- Only works on currently focused element (cannot target specific element)
- Cannot press key combinations (Ctrl+C, Alt+Tab, etc.)
- Does not type text - use typeInField for that
- May not work on custom keyboard handlers

EXAMPLE: pressKey(key="Enter") after typeInField to submit search`,
            parameters: z.object({
                key: z.string().describe('Key name to press. Common keys: "Enter" (submit/confirm), "Escape" (cancel/close), "Tab" (next field), "ArrowDown"/"ArrowUp" (navigate lists), "Space" (activate), "Backspace" (delete). Must be valid KeyboardEvent.key value.'),
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


