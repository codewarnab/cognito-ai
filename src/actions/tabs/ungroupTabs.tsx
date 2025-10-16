import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Tabs");

export function useUngroupTabs() {
    useFrontendTool({
        name: "ungroupTabs",
        description: "Ungroup tabs by removing them from their tab groups. Can ungroup all tabs, specific groups by name/ID, or tabs from multiple groups at once. Tabs remain open but are no longer grouped.",
        parameters: [
            {
                name: "groupIds",
                type: "object",
                description: "Optional array of group IDs to ungroup. If not provided, ungroups ALL tab groups. Can be group IDs (numbers) or group names (strings).",
                required: false
            },
            {
                name: "ungroupAll",
                type: "boolean",
                description: "If true, ungroups all tab groups at once. Default is true if no groupIds specified.",
                required: false
            }
        ],
        handler: async ({ groupIds, ungroupAll = true }) => {
            if (!shouldProcess("ungroupTabs", { groupIds, ungroupAll })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.debug("ungroupTabs invoked", { groupIds, ungroupAll });

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

                return {
                    success: true,
                    ungroupedCount: ungroupedGroups.length,
                    totalTabsUngrouped: ungroupedGroups.reduce((sum, g) => sum + g.tabCount, 0),
                    groups: ungroupedGroups
                };

            } catch (error) {
                log.error('[FrontendTool] Error ungrouping tabs:', error);
                return { error: "Failed to ungroup tabs", details: String(error) };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                const subtitle = args.ungroupAll ? "Ungrouping all groups..." :
                    args.groupIds ? `Ungrouping ${Array.isArray(args.groupIds) ? args.groupIds.length : 1} group(s)...` :
                        "Ungrouping...";
                return <ToolCard title="Ungrouping Tabs" subtitle={subtitle} state="loading" icon="🔓" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Ungroup Failed" subtitle={result.error} state="error" icon="🔓" />;
                }

                if (result.ungroupedCount === 0) {
                    return <ToolCard title="No Groups to Ungroup" subtitle={result.message} state="success" icon="🔓" />;
                }

                return (
                    <ToolCard
                        title="Tabs Ungrouped"
                        subtitle={`Ungrouped ${result.ungroupedCount} group(s), ${result.totalTabsUngrouped} tab(s) freed`}
                        state="success"
                        icon="🔓"
                    >
                        {result.groups && result.groups.length > 0 && (
                            <div style={{ fontSize: '12px', marginTop: '8px' }}>
                                {result.groups.map((group: any, idx: number) => (
                                    <div key={idx} style={{
                                        padding: '6px 8px',
                                        marginBottom: '4px',
                                        background: 'rgba(0,0,0,0.05)',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span style={{ fontWeight: 500 }}>{group.title}</span>
                                        <span style={{ opacity: 0.6 }}>{group.tabCount} tab(s)</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
