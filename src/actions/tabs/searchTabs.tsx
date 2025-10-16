import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard, ResultList } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Tabs");

export function useSearchTabs() {
    useFrontendTool({
        name: "searchTabs",
        description: "Search through all open browser tabs by title or URL",
        parameters: [
            { name: "query", type: "string", description: "Search query to match against tab titles and URLs", required: true }
        ],
        handler: async ({ query }) => {
            if (!shouldProcess("searchTabs", { query })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.debug("searchTabs", { query });
                const tabs = await chrome.tabs.query({});
                const q = String(query || '').toLowerCase();
                const matchingTabs = tabs.filter(tab => tab.title?.toLowerCase().includes(q) || tab.url?.toLowerCase().includes(q));
                return { found: matchingTabs.length, tabs: matchingTabs.map(t => ({ id: t.id, title: t.title, url: t.url })) };
            } catch (error) {
                log.error('[FrontendTool] Error searching tabs:', error);
                return { error: "Failed to search tabs" };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Searching Tabs" subtitle={`Query: "${args.query}"`} state="loading" icon="🔎" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Search Failed" subtitle={result.error} state="error" icon="🔎" />;
                }
                return (
                    <ToolCard title="Tab Search Results" subtitle={`Found ${result.found} tab(s)`} state="success" icon="🔎">
                        {result.tabs && result.tabs.length > 0 && (
                            <ResultList items={result.tabs} />
                        )}
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
