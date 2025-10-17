/**
 * OpenTab Tool for AI SDK v5
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistry';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { useActionHelpers } from '../useActionHelpers';
import { shouldProcess } from '../useActionDeduper';
import { ToolCard } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-OpenTab');

/**
 * Hook to register the openTab tool
 */
export function useOpenTabTool() {
    const { normalizeUrl, urlsEqual, isRecentlyOpened, markOpened, focusTab } = useActionHelpers();
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering openTab tool...');
        
        // Register the tool with AI SDK v5
        registerTool({
            name: 'openTab',
            description: 'Open a URL. If a tab with the same URL already exists anywhere, switch to that tab instead of opening a duplicate.',
            parameters: z.object({
                url: z.string().describe('The URL to open in a new tab'),
            }),
            execute: async ({ url }) => {
                if (!shouldProcess("openTab", { url })) {
                    return { skipped: true, reason: "duplicate" };
                }

                try {
                    log.info("TOOL CALL : openTab", { url });
                    const key = normalizeUrl(url);
                    
                    if (isRecentlyOpened(key)) {
                        const recentTabs = await chrome.tabs.query({});
                        const recentExisting = recentTabs.find(t => urlsEqual(t.url || '', url));
                        if (recentExisting) {
                            await focusTab(recentExisting);
                            return { success: true, reused: true, tabId: recentExisting.id, url: recentExisting.url };
                        }
                    }
                    
                    const allTabs = await chrome.tabs.query({});
                    const existing = allTabs.find(t => urlsEqual(t.url || '', url));
                    
                    if (existing) {
                        await focusTab(existing);
                        return { success: true, reused: true, tabId: existing.id, url: existing.url };
                    }
                    
                    const tab = await chrome.tabs.create({ url });
                    markOpened(key);
                    return { success: true, reused: false, tabId: tab.id, url: tab.url };
                } catch (error) {
                    log.error('[Tool] Error opening tab:', error);
                    return { error: "Failed to open tab" };
                }
            },
        });

        // Register the UI renderer for this tool
        registerToolUI('openTab', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return <ToolCard title="Opening Tab" subtitle={input?.url} state="loading" icon="🌐" />;
            }
            
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return <ToolCard title="Failed to Open Tab" subtitle={output.error} state="error" icon="🌐" />;
                }
                const action = output.reused ? "Switched to existing tab" : "Opened new tab";
                return <ToolCard title={action} subtitle={output.url} state="success" icon="🌐" />;
            }
            
            if (toolState === 'output-error') {
                return <ToolCard title="Failed to Open Tab" subtitle={state.errorText} state="error" icon="🌐" />;
            }
            
            return null;
        });

        log.info('✅ openTab tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up openTab tool');
            unregisterToolUI('openTab');
        };
    }, []); // Empty dependency array - only register once on mount
}
