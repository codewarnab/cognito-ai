import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Tabs");

export function useApplyTabGroups() {
    useFrontendTool({
        name: "applyTabGroups",
        description: "Apply AI-suggested tab groups. This is called after organizeTabsByContext with the AI's grouping suggestions.",
        parameters: [
            {
                name: "groups",
                type: "object",
                description: "Array of group objects with name, description, and tabIds",
                required: true
            }
        ],
        handler: async ({ groups }) => {
            if (!shouldProcess("applyTabGroups", { groups })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.debug("applyTabGroups invoked", { groupCount: Array.isArray(groups) ? groups.length : 0 });

                // Check if Tab Groups API is available
                if (!chrome.tabs.group || !chrome.tabGroups) {
                    return { error: "Tab Groups API not available" };
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

                return {
                    success: true,
                    groupsCreated: createdGroups.length,
                    groups: createdGroups
                };

            } catch (error) {
                log.error('[FrontendTool] Error applying tab groups:', error);
                return { error: "Failed to apply tab groups", details: String(error) };
            }
        },
        render: ({ status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Applying Groups" subtitle="Creating tab groups..." state="loading" icon="✨" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Failed to Apply Groups" subtitle={result.error} state="error" icon="✨" />;
                }
                return (
                    <ToolCard
                        title="Groups Applied"
                        subtitle={`Successfully created ${result.groupsCreated} group(s)`}
                        state="success"
                        icon="✨"
                    >
                        {result.groups && result.groups.length > 0 && (
                            <div style={{ fontSize: '12px', marginTop: '8px' }}>
                                {result.groups.map((group: any, idx: number) => (
                                    <div key={idx} style={{
                                        padding: '8px',
                                        marginBottom: '6px',
                                        background: 'rgba(0,0,0,0.05)',
                                        borderRadius: '4px'
                                    }}>
                                        <div style={{ fontWeight: 600, marginBottom: '2px' }}>{group.name}</div>
                                        {group.description && (
                                            <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>
                                                {group.description}
                                            </div>
                                        )}
                                        <div style={{ opacity: 0.6 }}>{group.tabCount} tab(s)</div>
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
