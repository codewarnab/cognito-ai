/**
 * UngroupTabs Tool for AI SDK v5
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 * 
 * Ungroup tabs by removing them from their tab groups.
 * Can ungroup all tabs, specific groups by name/ID, or tabs from multiple groups at once.
 * Tabs remain open but are no longer grouped.
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '@logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import type { ToolUIState } from '../../ai/tools/components';

const log = createLogger('Tool-UngroupTabs');

/**
 * Hook to register the ungroupTabs tool
 */
export function useUngroupTabs() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering ungroupTabs tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'ungroupTabs',
            description: 'Ungroup tabs by removing them from their tab groups. Can ungroup all tabs, specific groups by name/ID, or tabs from multiple groups at once. Tabs remain open but are no longer grouped.',
            parameters: z.object({
                groupIds: z.array(z.union([z.number(), z.string()]))
                    .optional()
                    .describe('Optional array of group IDs to ungroup. Can be group IDs (numbers) or group names (strings). If not provided, ungroups ALL tab groups.'),
                ungroupAll: z.boolean()
                    .optional()
                    .default(true)
                    .describe('If true, ungroups all tab groups at once. Default is true if no groupIds specified.'),
            }),
            execute: async ({ groupIds, ungroupAll = true }) => {
                try {
                    log.info("TOOL CALL: ungroupTabs", { groupIds, ungroupAll });

                    // Check if Tab Groups API is available
                    if (!chrome.tabs.group || !chrome.tabGroups) {
                        log.error("Tab Groups API not available");
                        return {
                            error: "Tab Groups API not available. This feature requires Chrome 89 or later.",
                            details: "chrome.tabGroups is undefined"
                        };
                    }

                    let targetGroupIds: number[] = [];
                    let ungroupedGroups: { id: number; title: string; tabCount: number }[] = [];

                    // Determine which groups to ungroup
                    if (ungroupAll && !groupIds) {
                        // Ungroup all groups
                        const allGroups = await chrome.tabGroups.query({});
                        targetGroupIds = allGroups.map(g => g.id);
                        log.debug("Ungrouping all groups", { count: targetGroupIds.length });
                    } else if (groupIds && Array.isArray(groupIds)) {
                        // Ungroup specific groups
                        const allGroups = await chrome.tabGroups.query({});

                        for (const groupIdOrName of groupIds) {
                            if (typeof groupIdOrName === 'number') {
                                // It's a group ID
                                targetGroupIds.push(groupIdOrName);
                            } else if (typeof groupIdOrName === 'string') {
                                // It's a group name - find the group by title
                                const matchingGroup = allGroups.find(g =>
                                    g.title?.toLowerCase().includes(groupIdOrName.toLowerCase())
                                );
                                if (matchingGroup) {
                                    targetGroupIds.push(matchingGroup.id);
                                } else {
                                    log.warn("Group not found by name", { name: groupIdOrName });
                                }
                            }
                        }
                        log.debug("Ungrouping specific groups", { targetGroupIds });
                    } else {
                        return { error: "Invalid parameters. Provide groupIds array or set ungroupAll to true." };
                    }

                    if (targetGroupIds.length === 0) {
                        return {
                            success: true,
                            message: "No groups to ungroup",
                            ungroupedCount: 0,
                            totalTabsUngrouped: 0,
                            groups: []
                        };
                    }

                    // Get tabs for each group before ungrouping
                    for (const groupId of targetGroupIds) {
                        try {
                            // Get group info
                            const groupInfo = await chrome.tabGroups.get(groupId);

                            // Get tabs in this group
                            const tabsInGroup = await chrome.tabs.query({ groupId });

                            // Ungroup the tabs
                            const tabIds = tabsInGroup.map(t => t.id!).filter(id => id !== undefined);
                            if (tabIds.length > 0) {
                                await chrome.tabs.ungroup(tabIds);

                                ungroupedGroups.push({
                                    id: groupId,
                                    title: groupInfo.title || `Group ${groupId}`,
                                    tabCount: tabIds.length
                                });

                                log.info("Ungrouped tabs", {
                                    groupId,
                                    groupTitle: groupInfo.title,
                                    tabCount: tabIds.length
                                });
                            }
                        } catch (groupError) {
                            log.error("Failed to ungroup", { groupId, error: String(groupError) });
                            // Continue with other groups even if one fails
                        }
                    }

                    log.info('✅ Tabs ungrouped', { count: ungroupedGroups.length });

                    return {
                        success: true,
                        ungroupedCount: ungroupedGroups.length,
                        totalTabsUngrouped: ungroupedGroups.reduce((sum, g) => sum + g.tabCount, 0),
                        groups: ungroupedGroups
                    };

                } catch (error) {
                    log.error('[Tool] Error ungrouping tabs:', error);
                    return { error: "Failed to ungroup tabs", details: String(error) };
                }
            },
        });

        // Register the UI renderer for this tool - uses CompactToolRenderer
        registerToolUI('ungroupTabs', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ ungroupTabs tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up ungroupTabs tool');
            unregisterToolUI('ungroupTabs');
        };
    }, []); // Empty dependency array - only register once on mount
}

