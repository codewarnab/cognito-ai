/**
 * GetAllTabs Tool for AI SDK v5
 * 
 * Gets information about all open browser tabs
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { CompactToolRenderer } from '../../ai/CompactToolRenderer';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-GetAllTabs');

/**
 * Hook to register the getAllTabs tool
 */
export function useGetAllTabs() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering getAllTabs tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'getAllTabs',
            description: 'Get information about all open browser tabs across all windows. Returns a list of tabs with their titles, URLs, and IDs.',
            parameters: z.object({}),
            execute: async () => {
                try {
                    log.info("TOOL CALL: getAllTabs");
                    const tabs = await chrome.tabs.query({});

                    if (!tabs || tabs.length === 0) {
                        log.warn("No tabs found");
                        return {
                            success: true,
                            tabs: [],
                            count: 0,
                            message: "No tabs currently open"
                        };
                    }

                    // Map tabs to a cleaner format
                    const tabList = tabs.map(tab => ({
                        id: tab.id,
                        title: tab.title || 'Untitled',
                        url: tab.url || '',
                        active: tab.active || false,
                        windowId: tab.windowId,
                        index: tab.index
                    }));

                    log.info('✅ Retrieved all tabs', { count: tabs.length });

                    return {
                        success: true,
                        tabs: tabList,
                        count: tabs.length
                    };
                } catch (error) {
                    log.error('[Tool] Error getting all tabs:', error);
                    return {
                        success: false,
                        error: "Failed to get all tabs",
                        details: String(error),
                        tabs: [],
                        count: 0
                    };
                }
            },
        });

        // Register the UI renderer for this tool - uses CompactToolRenderer
        registerToolUI('getAllTabs', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ getAllTabs tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up getAllTabs tool');
            unregisterToolUI('getAllTabs');
        };
    }, []); // Empty dependency array - only register once on mount
}
