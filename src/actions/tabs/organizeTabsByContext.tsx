import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Tabs");

export function useOrganizeTabsByContext() {
    useFrontendTool({
        name: "organizeTabsByContext",
        description: "Intelligently organize tabs by analyzing their content and context. Groups related tabs together even if they're from different websites. For example, all tabs about 'React hooks' will be grouped together regardless of whether they're from GitHub, StackOverflow, or documentation sites.",
        parameters: [
            {
                name: "maxGroups",
                type: "number",
                description: "Maximum number of groups to create (default: 5)",
                required: false
            }
        ],
        handler: async ({ maxGroups = 5 }) => {
            if (!shouldProcess("organizeTabsByContext", { maxGroups })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.debug("organizeTabsByContext invoked", { maxGroups });

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

                // Return a special marker that tells CopilotKit to use AI for grouping
                // The AI will analyze the tabs and suggest groups
                return {
                    needsAIAnalysis: true,
                    tabs: tabsInfo,
                    maxGroups,
                    message: "Please analyze these tabs and group them by topic/context. Consider the title, URL, and domain to identify related work or research. Return a JSON array of groups where each group has: {name: string, description: string, tabIds: number[]}. Group tabs that are related to the same topic, project, or research, even if they're from different websites."
                };

            } catch (error) {
                log.error('[FrontendTool] Error organizing tabs by context:', error);
                return { error: "Failed to organize tabs by context", details: String(error) };
            }
        },
        render: ({ status, result, args }) => {
            if (status === "inProgress") {
                return <ToolCard title="Analyzing Tabs" subtitle="AI is analyzing tab content and context..." state="loading" icon="🧠" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Organization Failed" subtitle={result.error} state="error" icon="🧠" />;
                }
                if (result.needsAIAnalysis) {
                    return (
                        <ToolCard title="Tabs Ready for Analysis" subtitle={`${result.tabs.length} tabs prepared`} state="success" icon="🧠">
                            <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
                                AI will now analyze and group these tabs by context...
                            </div>
                        </ToolCard>
                    );
                }
                if (result.groups) {
                    return (
                        <ToolCard
                            title="Tabs Organized by Context"
                            subtitle={`Created ${result.groups.length} contextual group(s)`}
                            state="success"
                            icon="🧠"
                        >
                            {result.groups.length > 0 && (
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
            }
            return null;
        },
    });
}
