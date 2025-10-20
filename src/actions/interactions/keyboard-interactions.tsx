/**
 * Keyboard Interactions Tool for AI SDK v5
 * Handles keyboard input and text typing as if a user is typing
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard, Keycap } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger("Actions-Interactions-Keyboard");

/**
 * Hook to register keyboard interaction tools
 */
export function registerKeyboardInteractions() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering pressKey tool...');
        
        // Register pressKey tool - dispatches keyboard events to active element
        registerTool({
            name: "pressKey",
            description: "Press a key on the active element (simulates keyboard input). Works like pressing a physical key.",
            parameters: z.object({
                key: z.string().describe('Key to press (e.g., "Enter", "Escape", "Tab", "ArrowDown", "Space", "A", etc.)'),
            }),
            execute: async ({ key }) => {
                try {
                    log.info("TOOL CALL: pressKey", { key });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };
                    
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

        // Register UI for pressKey
        registerToolUI('pressKey', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard title="Pressing Key" subtitle="Active element" state="loading" icon="⌨️">
                        <Keycap keyName={input?.key || ''} />
                    </ToolCard>
                );
            }
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return <ToolCard title="Key Press Failed" subtitle={output.error} state="error" icon="⌨️" />;
                }
                return (
                    <ToolCard title="Key Pressed" state="success" icon="⌨️">
                        <Keycap keyName={input?.key || ''} />
                    </ToolCard>
                );
            }
            if (toolState === 'output-error') {
                return <ToolCard title="Key Press Failed" subtitle={state.errorText} state="error" icon="⌨️" />;
            }
            return null;
        });

        log.info('✅ pressKey tool registration complete');

        // Now register globalTypeText - global keyboard typing without selector
        log.info('🔧 Registering globalTypeText tool...');
        
        registerTool({
            name: "globalTypeText",
            description: "Type text into the currently focused element as if a user is typing on the keyboard. Works with any input field, textarea, or content-editable element. Types immediately without delays.",
            parameters: z.object({
                text: z.string().describe('Text to type into the focused element'),
                clearFirst: z.boolean().optional().describe('If true, clear the element before typing (default: false)').default(false),
            }),
            execute: async ({ text, clearFirst = false }) => {
                try {
                    log.info("TOOL CALL: globalTypeText", { textLength: text.length, clearFirst });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [text, clearFirst],
                        func: (txt: string, clear: boolean) => {
                            const target = document.activeElement as HTMLElement | null;
                            if (!target) return { success: false, error: 'No focused element found' };

                            // Ensure element is focused
                            if (typeof target.focus === 'function') {
                                target.focus();
                            }

                            const dispatchInputLike = (element: Element) => {
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                element.dispatchEvent(new Event('keyup', { bubbles: true }));
                            };

                            // Handle input and textarea elements
                            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                                if (clear) {
                                    target.value = '';
                                }
                                
                                // Simulate typing by setting value and dispatching events
                                const oldValue = target.value;
                                target.value = oldValue + txt;
                                
                                dispatchInputLike(target);
                                return { success: true, typed: txt.length };
                            }

                            // Handle contentEditable elements
                            if ((target as HTMLElement).isContentEditable) {
                                if (clear) {
                                    target.innerText = '';
                                }
                                
                                const oldText = target.innerText;
                                target.innerText = oldText + txt;
                                
                                dispatchInputLike(target);
                                return { success: true, typed: txt.length };
                            }

                            return { success: false, error: `Unsupported element type: ${target.tagName}` };
                        }
                    });

                    const result = results[0]?.result;
                    if (result?.success) {
                        log.info("✅ Text typed successfully", { length: text.length });
                    } else {
                        log.warn("globalTypeText failed", result);
                    }
                    return result || { error: "Failed to type text" };
                } catch (error) {
                    log.error('[Tool] Error typing text:', error);
                    return { error: "Failed to type text" };
                }
            },
        });

        // Register UI for globalTypeText
        registerToolUI('globalTypeText', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                const preview = (input?.text || '').substring(0, 30);
                const displayText = preview.length < (input?.text || '').length 
                    ? preview + '...' 
                    : preview;
                return <ToolCard title="Typing Text" subtitle={`"${displayText}"`} state="loading" icon="⌨️" />;
            }
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return <ToolCard title="Type Failed" subtitle={output.error} state="error" icon="⌨️" />;
                }
                return <ToolCard title="Text Typed" subtitle={`${output.typed} characters`} state="success" icon="⌨️" />;
            }
            if (toolState === 'output-error') {
                return <ToolCard title="Type Failed" subtitle={state.errorText} state="error" icon="⌨️" />;
            }
            return null;
        });

        log.info('✅ globalTypeText tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up keyboard interaction tools');
            unregisterToolUI('pressKey');
            unregisterToolUI('globalTypeText');
        };
    }, []);
}
