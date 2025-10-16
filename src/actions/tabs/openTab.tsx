import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { useActionHelpers } from "../useActionHelpers";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Tabs");

export function useOpenTab() {
    const { normalizeUrl, urlsEqual, isRecentlyOpened, markOpened, focusTab } = useActionHelpers();

    useFrontendTool({
        name: "openTab",
        description: "Open a URL. If a tab with the same URL already exists anywhere, switch to that tab instead of opening a duplicate.",
        parameters: [
            { name: "url", type: "string", description: "The URL to open in a new tab", required: true }
        ],
        handler: async ({ url }) => {
            if (!shouldProcess("openTab", { url })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("openTab", { url });
                const key = normalizeUrl(url);
                if (isRecentlyOpened(key)) {
                    const recentTabs = await chrome.tabs.query({});
                    const recentExisting = recentTabs.find(t => urlsEqual(t.url || '', url));
                    if (recentExisting) {
                        await focusTab(recentExisting);
                        return { success: true, reused: true, tabId: recentExisting.id, url: recentExisting.url };
                    }
                }
                const allTabs = await chrome.tabs.query({});
                const existing = allTabs.find(t => urlsEqual(t.url || '', url));
                if (existing) {
                    await focusTab(existing);
                    return { success: true, reused: true, tabId: existing.id, url: existing.url };
                }
                const tab = await chrome.tabs.create({ url });
                markOpened(key);
                return { success: true, reused: false, tabId: tab.id, url: tab.url };
            } catch (error) {
                log.error('[FrontendTool] Error opening tab:', error);
                return { error: "Failed to open tab" };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Opening Tab" subtitle={args.url} state="loading" icon="🌐" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Failed to Open Tab" subtitle={result.error} state="error" icon="🌐" />;
                }
                const action = result.reused ? "Switched to existing tab" : "Opened new tab";
                return (
                    <ToolCard title={action} subtitle={result.url} state="success" icon="🌐" />
                );
            }
            return null;
        },
    });
}
