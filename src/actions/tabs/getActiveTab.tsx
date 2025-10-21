/**
 * GetActiveTab Tool for AI SDK v5
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 * 
 * Gets information about the currently active browser tab
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { CompactToolRenderer } from '../../ai/CompactToolRenderer';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-GetActiveTab');

/**
 * Hook to register the getActiveTab tool
 */
export function useGetActiveTab() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering getActiveTab tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'getActiveTab',
            description: 'Get information about the currently active browser tab in the current window',
            parameters: z.object({}),
            execute: async () => {
                try {
                    log.info("TOOL CALL: getActiveTab");
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

                    if (!tabs || tabs.length === 0 || !tabs[0]) {
                        log.warn("No active tab found in current window");
                        return { error: "No active tab found" };
                    }

                    const tab = tabs[0];
                    log.info('✅ Retrieved active tab info', { tabId: tab.id, title: tab.title });

                    return {
                        success: true,
                        title: tab.title || 'Untitled',
                        url: tab.url || '',
                        id: tab.id
                    };
                } catch (error) {
                    log.error('[Tool] Error getting active tab:', error);
                    return { error: "Failed to get active tab info", details: String(error) };
                }
            },
        });

        // Register the UI renderer for this tool - uses CompactToolRenderer
        registerToolUI('getActiveTab', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ getActiveTab tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up getActiveTab tool');
            unregisterToolUI('getActiveTab');
        };
    }, []); // Empty dependency array - only register once on mount
}
