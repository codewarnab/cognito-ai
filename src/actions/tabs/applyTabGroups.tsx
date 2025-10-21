/**
 * ApplyTabGroups Tool for AI SDK v5
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 * 
 * Apply AI-suggested tab groups. This is called after organizeTabsByContext
 * with the AI's grouping suggestions.
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { CompactToolRenderer } from '../../ai/CompactToolRenderer';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-ApplyTabGroups');

/**
 * Hook to register the applyTabGroups tool
 */
export function useApplyTabGroups() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering applyTabGroups tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'applyTabGroups',
            description: 'Apply AI-suggested tab groups. This is called after organizeTabsByContext with the AI\'s grouping suggestions. Groups tabs together by context.',
            parameters: z.object({
                groups: z.array(
                    z.object({
                        name: z.string().describe('Name of the group'),
                        description: z.string().optional().describe('Description of the group'),
                        tabIds: z.array(z.number()).describe('Array of tab IDs to group together'),
                    })
                ).describe('Array of group objects with name, description, and tabIds'),
            }),
            execute: async ({ groups }) => {
                try {
                    log.info("TOOL CALL: applyTabGroups", { groupCount: groups.length });

                    // Check if Tab Groups API is available
                    if (!chrome.tabs.group || !chrome.tabGroups) {
                        log.error("Tab Groups API not available");
                        return { error: "Tab Groups API not available. This feature requires Chrome 89 or later." };
                    }

                    const groupsArray = Array.isArray(groups) ? groups : [];
                    const colors: chrome.tabGroups.ColorEnum[] = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];
                    const createdGroups = [];

                    for (let i = 0; i < groupsArray.length; i++) {
                        const group = groupsArray[i];

                        if (!group.tabIds || !Array.isArray(group.tabIds) || group.tabIds.length === 0) {
                            log.debug("Skipping group with no tabs", { group });
                            continue;
                        }

                        try {
                            // Create the group
                            const groupId = await chrome.tabs.group({ tabIds: group.tabIds });

                            // Update with name and color
                            await chrome.tabGroups.update(groupId, {
                                title: group.name || `Group ${i + 1}`,
                                color: colors[i % colors.length],
                                collapsed: true
                            });

                            createdGroups.push({
                                name: group.name,
                                description: group.description,
                                tabCount: group.tabIds.length,
                                groupId
                            });

                            log.info("Created contextual tab group", {
                                name: group.name,
                                tabCount: group.tabIds.length
                            });

                        } catch (groupError) {
                            log.error("Failed to create group", { group, error: String(groupError) });
                        }
                    }

                    log.info('✅ Tab groups applied', { groupsCreated: createdGroups.length });

                    return {
                        success: true,
                        groupsCreated: createdGroups.length,
                        groups: createdGroups
                    };

                } catch (error) {
                    log.error('[Tool] Error applying tab groups:', error);
                    return { error: "Failed to apply tab groups", details: String(error) };
                }
            },
        });

        // Register the UI renderer for this tool - uses CompactToolRenderer
        registerToolUI('applyTabGroups', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ applyTabGroups tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up applyTabGroups tool');
            unregisterToolUI('applyTabGroups');
        };
    }, []); // Empty dependency array - only register once on mount
}
