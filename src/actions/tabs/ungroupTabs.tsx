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
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@/ai/tools/components';
import type { ToolUIState } from '@/ai/tools/components';

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
            description: `Remove tabs from their groups while keeping tabs open. Can ungroup all groups or specific groups by name/ID.
WHEN TO USE: User wants to "ungroup all tabs", "remove tab groups", "ungroup X group"; cleaning up tab organization; removing groups after completing a project.
PRECONDITIONS: Must have tab groups created (from applyTabGroups or manual grouping); Chrome 89+ required.
WORKFLOW: 1) Identify which groups to ungroup (all or specific) 2) For each group, get tabs 3) Remove tabs from group (tabs stay open, just ungrouped) 4) Return count of ungrouped groups and tabs.
LIMITATIONS: Cannot undo ungrouping (must recreate groups); tabs remain open (not closed); cannot ungroup chrome:// or extension pages.
EXAMPLE: ungroupTabs(ungroupAll=true) or ungroupTabs(groupIds=["React Docs", 123])`,
            parameters: z.object({
                groupIds: z.array(z.union([z.number(), z.string()]))
                    .optional()
                    .describe('Array of group IDs (numbers) or group names (strings) to ungroup. Examples: [123, 456] or ["React Docs", "GitHub Issues"]. If omitted and ungroupAll=true, ungroups all groups.'),
                ungroupAll: z.boolean()
                    .optional()
                    .default(true)
                    .describe('If true (default), ungroups all tab groups. If false, only ungroups groups specified in groupIds. Use true for complete cleanup, false for selective ungrouping.'),
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


