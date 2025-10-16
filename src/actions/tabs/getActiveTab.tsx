import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Tabs");

export function useGetActiveTab() {
    useFrontendTool({
        name: "getActiveTab",
        description: "Get information about the currently active browser tab",
        parameters: [],
        handler: async () => {
            if (!shouldProcess("getActiveTab", {})) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.debug("getActiveTab invoked");
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tabs || tabs.length === 0 || !tabs[0]) {
                    log.warn("No active tab found in current window");
                    return { error: "No active tab" };
                }
                const tab = tabs[0];
                return { title: tab.title, url: tab.url, id: tab.id };
            } catch (error) {
                log.error('[FrontendTool] Error getting active tab:', error);
                return { error: "Failed to get active tab info" };
            }
        },
        render: ({ status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Getting Active Tab" state="loading" icon="🔍" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Failed to Get Tab" subtitle={result.error} state="error" icon="🔍" />;
                }
                return (
                    <ToolCard title="Active Tab" state="success" icon="🔍">
                        <div style={{ fontSize: '13px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{result.title || 'Untitled'}</div>
                            <div style={{ opacity: 0.7, wordBreak: 'break-all', fontSize: '12px' }}>{result.url}</div>
                        </div>
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
