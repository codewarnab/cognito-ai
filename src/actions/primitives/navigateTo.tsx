import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { useActionHelpers } from "../useActionHelpers";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard, Badge } from "../../components/ui/ToolCard";

export function useNavigateToAction() {
    const log = createLogger("Actions-Primitives");
    const { urlsEqual, focusTab } = useActionHelpers();

    useFrontendTool({
        name: "navigateTo",
        description: "Navigate to a URL. If already on it, reload. If another tab has it, switch to it.",
        parameters: [
            { name: "url", type: "string", description: "Absolute URL", required: true }
        ],
        handler: async ({ url }) => {
            console.log("Hi i am from navigateTo")
            if (!shouldProcess("navigateTo", { url })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("navigateTo", { url });
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!activeTab?.id) return { error: "No active tab" };
                if (urlsEqual(activeTab.url || '', url)) {
                    await chrome.tabs.reload(activeTab.id);
                    return { success: true, reloaded: true, tabId: activeTab.id, url: activeTab.url };
                }
                const allTabs = await chrome.tabs.query({});
                const existing = allTabs.find(t => t.id !== activeTab.id && urlsEqual(t.url || '', url));
                if (existing) {
                    await focusTab(existing);
                    return { success: true, switched: true, tabId: existing.id, url: existing.url };
                }
                await chrome.tabs.update(activeTab.id, { url });
                return { success: true, navigated: true, tabId: activeTab.id, url };
            } catch (error) {
                log.error('[FrontendTool] Error navigating:', error);
                return { error: "Failed to navigate" };
            }
        },
        render: ({ args, status, result }) => {
            console.log("Render navigateTo", { args, status, result });
            if (status === "inProgress") {
                return <ToolCard title="Navigating" subtitle={args.url} state="loading" icon="🧭" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Navigation Failed" subtitle={result.error} state="error" icon="🧭" />;
                }
                const action = result.reloaded ? "reloaded" : result.switched ? "switched" : "navigated";
                return (
                    <ToolCard title="Navigation Complete" subtitle={result.url} state="success" icon="🧭">
                        <Badge label={action} variant="success" />
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
