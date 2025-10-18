/**
 * Text Extraction Tool for AI SDK v5
 * Handles text extraction from the page and scrolling elements into view
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard, CodeBlock, Badge } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger("Actions-Interactions-Text");

export function registerTextExtractionInteractions() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering extractText tool...');

        // Register extractText tool
        registerTool({
            name: "extractText",
            description: "Extract text content from the page or specific elements. Can extract from entire page or specific selectors.",
            parameters: z.object({
                selector: z.string().optional().describe('Optional CSS selector; if omitted returns main body text'),
                all: z.boolean().optional().describe('If true and selector is provided, return all matches (default: false)').default(false),
                limit: z.number().optional().describe('Max characters to extract (default: 5000)').default(5000),
            }),
            execute: async ({ selector, all = false, limit = 5000 }) => {
                try {
                    const max = typeof limit === 'number' && limit > 0 ? limit : 5000;
                    log.info("TOOL CALL: extractText", { selector, all, max });
                    
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };
                    
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector || null, Boolean(all), max],
                        func: (sel: string | null, returnAll: boolean, maxLen: number) => {
                            if (!sel) {
                                const cloned = document.body.cloneNode(true) as HTMLElement;
                                cloned.querySelectorAll('script, style, noscript').forEach((e) => e.remove());
                                const text = (cloned.innerText || cloned.textContent || '').trim();
                                return { success: true, text: text.slice(0, maxLen), truncated: text.length > maxLen };
                            }
                            const nodes = Array.from(document.querySelectorAll(sel));
                            if (!nodes.length) return { success: false, error: `No elements match selector: ${sel}` };
                            if (returnAll) {
                                const texts = nodes.map((n) => (n.textContent || '').trim());
                                const joined = texts.join('\n').slice(0, maxLen);
                                return { success: true, text: joined, count: texts.length, truncated: texts.join('\n').length > maxLen };
                            }
                            const first = nodes[0];
                            const t = (first.textContent || '').trim();
                            return { success: true, text: t.slice(0, maxLen), truncated: t.length > maxLen };
                        }
                    });
                    
                    const result = results[0]?.result;
                    if (result?.success) {
                        log.info("✅ Text extracted successfully", { length: result.text?.length });
                    } else {
                        log.warn("extractText failed", result);
                    }
                    return result || { error: "No result" };
                } catch (error) {
                    log.error('[Tool] Error extracting text:', error);
                    return { error: "Failed to extract text" };
                }
            },
        });

        // Register UI for extractText
        registerToolUI('extractText', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return <ToolCard title="Extracting Text" subtitle={input?.selector || 'entire page'} state="loading" icon="📋" />;
            }
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return <ToolCard title="Extraction Failed" subtitle={output.error} state="error" icon="📋" />;
                }
                const charCount = (output as any).text?.length || 0;
                return (
                    <ToolCard
                        title="Text Extracted"
                        subtitle={`${charCount} characters${(output as any).count ? ` from ${(output as any).count} elements` : ''}`}
                        state="success"
                        icon="📋"
                    >
                        {(output as any).truncated && <Badge label="truncated" variant="warning" />}
                        {(output as any).text && (
                            <details className="tool-details">
                                <summary>View text</summary>
                                <CodeBlock code={(output as any).text.substring(0, 500) + ((output as any).text.length > 500 ? '...' : '')} />
                            </details>
                        )}
                    </ToolCard>
                );
            }
            if (toolState === 'output-error') {
                return <ToolCard title="Extraction Failed" subtitle={state.errorText} state="error" icon="📋" />;
            }
            return null;
        });

        log.info('✅ extractText tool registration complete');

        // Register scrollIntoView tool
        log.info('🔧 Registering scrollIntoView tool...');

        registerTool({
            name: "scrollIntoView",
            description: "Scroll an element into view on the page with smooth behavior.",
            parameters: z.object({
                selector: z.string().describe('CSS selector of the element to scroll to'),
                block: z.enum(['start', 'center', 'end', 'nearest']).optional().describe('Vertical alignment (default: nearest)').default('nearest'),
            }),
            execute: async ({ selector, block = 'nearest' }) => {
                try {
                    log.info("TOOL CALL: scrollIntoView", { selector, block });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab.id) return { error: "No active tab" };

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [selector, block],
                        func: (sel: string, blk: ScrollLogicalPosition) => {
                            const element = document.querySelector(sel);
                            if (!element) {
                                return { success: false, error: `Element not found: ${sel}` };
                            }

                            element.scrollIntoView({ behavior: 'smooth', block: blk });
                            return { success: true };
                        }
                    });

                    const result = results[0]?.result;
                    if (result?.success) {
                        log.info("✅ Scrolled to element successfully", { selector });
                    } else {
                        log.warn("scrollIntoView failed", result);
                    }
                    return result || { error: "Failed to scroll" };
                } catch (error) {
                    log.error('[Tool] Error scrolling:', error);
                    return { error: "Failed to scroll element into view" };
                }
            },
        });

        // Register UI for scrollIntoView
        registerToolUI('scrollIntoView', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return <ToolCard title="Scrolling to Element" subtitle={input?.selector} state="loading" icon="🔍" />;
            }
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return <ToolCard title="Scroll Failed" subtitle={output.error} state="error" icon="🔍" />;
                }
                return <ToolCard title="Scrolled to Element" subtitle={input?.selector} state="success" icon="🔍" />;
            }
            if (toolState === 'output-error') {
                return <ToolCard title="Scroll Failed" subtitle={state.errorText} state="error" icon="🔍" />;
            }
            return null;
        });

        log.info('✅ scrollIntoView tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up text extraction tools');
            unregisterToolUI('extractText');
            unregisterToolUI('scrollIntoView');
        };
    }, []);
}
