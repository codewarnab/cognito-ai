/**
 * OrganizeTabsByContext Tool for AI SDK v5
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 * 
 * Intelligently organize tabs by analyzing their content and context.
 * Groups related tabs together even if they're from different websites.
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { CompactToolRenderer } from '../../ai/CompactToolRenderer';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-OrganizeTabsByContext');

/**
 * Hook to register the organizeTabsByContext tool
 */
export function useOrganizeTabsByContextTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering organizeTabsByContext tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'organizeTabsByContext',
            description: 'Intelligently organize tabs by analyzing their content and context. Groups related tabs together even if they are from different websites. For example, all tabs about "React hooks" will be grouped together regardless of whether they are from GitHub, StackOverflow, or documentation sites.',
            parameters: z.object({
                maxGroups: z.number()
                    .describe('Maximum number of groups to create (default: 5)')
                    .default(5),
            }),
            execute: async ({ maxGroups = 5 }) => {
                try {
                    log.info("TOOL CALL: organizeTabsByContext", { maxGroups });

                    // Check if Tab Groups API is available
                    if (!chrome.tabs.group || !chrome.tabGroups) {
                        log.error("Tab Groups API not available");
                        return {
                            error: "Tab Groups API not available. This feature requires Chrome 89 or later.",
                            details: "chrome.tabGroups is undefined"
                        };
                    }

                    // Get all tabs
                    const tabs = await chrome.tabs.query({});

                    // Filter out special URLs
                    const validTabs = tabs.filter(tab => {
                        if (!tab.url) return false;
                        try {
                            const url = new URL(tab.url);
                            return url.protocol !== 'chrome:' && url.protocol !== 'chrome-extension:';
                        } catch {
                            return false;
                        }
                    });

                    if (validTabs.length === 0) {
                        return { error: "No valid tabs to organize" };
                    }

                    // Prepare tab information for AI analysis
                    const tabsInfo = validTabs.map(tab => ({
                        id: tab.id!,
                        title: tab.title || '',
                        url: tab.url || '',
                        domain: new URL(tab.url!).hostname
                    }));

                    // Return tab information for AI to analyze and group
                    // The AI will analyze these tabs and suggest groups based on context
                    return {
                        needsAIAnalysis: true,
                        tabs: tabsInfo,
                        maxGroups,
                        message: "Please analyze these tabs and group them by topic/context. Consider the title, URL, and domain to identify related work or research. Return a JSON array of groups where each group has: {name: string, description: string, tabIds: number[]}. Group tabs that are related to the same topic, project, or research, even if they're from different websites."
                    };

                } catch (error) {
                    log.error('[Tool] Error organizing tabs by context:', error);
                    return { error: "Failed to organize tabs by context", details: String(error) };
                }
            },
        });

        // Register the UI renderer for this tool - uses CompactToolRenderer
        registerToolUI('organizeTabsByContext', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ organizeTabsByContext tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up organizeTabsByContext tool');
            unregisterToolUI('organizeTabsByContext');
        };
    }, []); // Empty dependency array - only register once on mount
}
