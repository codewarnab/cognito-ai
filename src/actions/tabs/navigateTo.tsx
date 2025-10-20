/**
 * NavigateTo Tool for AI SDK v5
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 * 
 * Opens a URL in a new tab or current tab (without switching/redirecting)
 * For switching to existing tabs, use the switchTabs tool instead
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { useActionHelpers } from '../useActionHelpers';
import { ToolCard } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-NavigateTo');

/**
 * Hook to register the navigateTo tool
 */
export function useNavigateToTool() {
    const { normalizeUrl, markOpened } = useActionHelpers();
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering navigateTo tool...');
        
        // Register the tool with AI SDK v5
        registerTool({
            name: 'navigateTo',
            description: 'Open a URL in a new tab or current tab. Use newTab parameter to control where the URL opens. This tool does NOT switch focus to existing tabs; use switchTabs for that instead.',
            parameters: z.object({
                url: z.string().describe('The URL to open'),
                newTab: z.boolean()
                    .describe('If true, opens URL in a new tab. If false, opens in the current tab. Defaults to true.')
                    .default(true),
            }),
            execute: async ({ url, newTab = true }) => {
                try {
                    log.info("TOOL CALL: openTab", { url, newTab });
                    const key = normalizeUrl(url);
                    markOpened(key);
                    
                    if (newTab) {
                        // Open in new tab
                        const tab = await chrome.tabs.create({ url });
                        log.info('📑 Opened URL in new tab', { tabId: tab.id, url });
                        return { 
                            success: true, 
                            action: 'opened_new_tab',
                            tabId: tab.id, 
                            url: tab.url 
                        };
                    } else {
                        // Open in current tab (update active tab)
                        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (!currentTab || currentTab.id === undefined) {
                            return { error: "Could not find current tab" };
                        }
                        
                        await chrome.tabs.update(currentTab.id, { url });
                        log.info('🔄 Opened URL in current tab', { tabId: currentTab.id, url });
                        return { 
                            success: true, 
                            action: 'opened_current_tab',
                            tabId: currentTab.id, 
                            url 
                        };
                    }
                } catch (error) {
                    log.error('[Tool] Error opening tab:', error);
                    return { error: "Failed to open tab", details: String(error) };
                }
            },
        });

        // Register the UI renderer for this tool
        registerToolUI('navigateTo', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                const location = input?.newTab ? 'new tab' : 'current tab';
                return (
                    <ToolCard 
                        title="Opening Tab" 
                        subtitle={`${input?.url} (in ${location})`} 
                        state="loading" 
                        icon="🌐" 
                    />
                );
            }
            
            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard 
                            title="Failed to Open Tab" 
                            subtitle={output.error} 
                            state="error" 
                            icon="🌐" 
                        />
                    );
                }
                const action = output.action === 'opened_new_tab' ? 'Opened in new tab' : 'Opened in current tab';
                return (
                    <ToolCard 
                        title={action} 
                        subtitle={output.url} 
                        state="success" 
                        icon="🌐" 
                    />
                );
            }
            
            if (toolState === 'output-error') {
                return (
                    <ToolCard 
                        title="Failed to Open Tab" 
                        subtitle={state.errorText} 
                        state="error" 
                        icon="🌐" 
                    />
                );
            }
            
            return null;
        });

        log.info('✅ openTab tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up navigateTo tool');
            unregisterToolUI('navigateTo');
        };
    }, []); // Empty dependency array - only register once on mount
}
