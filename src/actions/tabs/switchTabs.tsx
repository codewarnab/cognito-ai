/**
 * SwitchTabs Tool for AI SDK v5
 * Handles switching focus to an existing tab by URL or tab ID
 * This is separate from openTab which only opens new/current tabs
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { useActionHelpers } from '../useActionHelpers';
import { CompactToolRenderer } from '../../ai/CompactToolRenderer';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-SwitchTabs');

/**
 * Hook to register the switchTabs tool
 */
export function useSwitchTabsTool() {
    const { normalizeUrl, urlsEqual, focusTab } = useActionHelpers();
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering switchTabs tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'switchTabs',
            description: 'Switch focus to an existing tab. Can find tabs by URL (exact or partial match) or by tab ID. Brings the tab into focus and makes its window active.',
            parameters: z.object({
                url: z.string()
                    .describe('The URL to search for and switch to. Can be partial or full URL.')
                    .optional(),
                tabId: z.number()
                    .describe('The specific tab ID to switch to. Use this if you know the exact tab ID.')
                    .optional(),
            }).refine(
                (data) => data.url || data.tabId,
                { message: 'Either url or tabId must be provided' }
            ),
            execute: async ({ url, tabId }) => {
                try {
                    log.info("TOOL CALL: switchTabs", { url, tabId });

                    let targetTab: chrome.tabs.Tab | undefined;

                    if (tabId) {
                        // Look up by tab ID
                        const tabs = await chrome.tabs.query({});
                        targetTab = tabs.find(t => t.id === tabId);

                        if (!targetTab) {
                            return {
                                error: `Tab with ID ${tabId} not found`,
                                success: false
                            };
                        }
                        log.info('📌 Found tab by ID', { tabId, url: targetTab.url });
                    } else if (url) {
                        // Look up by URL (exact or partial match)
                        const tabs = await chrome.tabs.query({});

                        // First try exact match
                        targetTab = tabs.find(t => urlsEqual(t.url || '', url));

                        // If no exact match, try partial match
                        if (!targetTab) {
                            const lowerUrl = normalizeUrl(url);
                            targetTab = tabs.find(t => {
                                const tabUrl = normalizeUrl(t.url || '');
                                return tabUrl.includes(lowerUrl) || lowerUrl.includes(tabUrl);
                            });
                        }

                        if (!targetTab) {
                            // Return available tabs for debugging
                            const availableUrls = tabs
                                .filter(t => t.url)
                                .map(t => ({ id: t.id, url: t.url }))
                                .slice(0, 5);

                            return {
                                error: `No tab found matching URL: ${url}`,
                                availableTabsSample: availableUrls,
                                success: false
                            };
                        }
                        log.info('📌 Found tab by URL', { url, tabId: targetTab.id });
                    }

                    if (!targetTab) {
                        return {
                            error: 'No target tab determined',
                            success: false
                        };
                    }

                    // Focus the tab
                    await focusTab(targetTab);
                    log.info('✅ Switched to tab', { tabId: targetTab.id, url: targetTab.url });

                    return {
                        success: true,
                        action: 'switched_tab',
                        tabId: targetTab.id,
                        url: targetTab.url,
                        title: targetTab.title
                    };

                } catch (error) {
                    log.error('[Tool] Error switching tabs:', error);
                    return {
                        error: "Failed to switch tabs",
                        details: String(error),
                        success: false
                    };
                }
            },
        });

        // Register the UI renderer for this tool - uses CompactToolRenderer
        registerToolUI('switchTabs', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ switchTabs tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up switchTabs tool');
            unregisterToolUI('switchTabs');
        };
    }, []); // Empty dependency array - only register once on mount
}
