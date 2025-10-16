import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";
import { waitForNavigation } from "./navigationHelpers";

const log = createLogger("Actions-Tabs");

export function useGoAndWait() {
    useFrontendTool({
        name: "goAndWait",
        description: "Navigate to URL (or pattern) and wait for page load/network idle",
        parameters: [
            { name: "url", type: "string", description: "URL to navigate to", required: true },
            { name: "waitFor", type: "string", description: "Wait strategy: 'load' or 'networkidle'", required: false },
            { name: "timeoutMs", type: "number", description: "Timeout in milliseconds", required: false }
        ],
        handler: async ({ url, waitFor = 'load', timeoutMs = 30000 }) => {
            if (!shouldProcess("goAndWait", { url })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("goAndWait", { url, waitFor, timeoutMs });

                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

                if (!activeTab?.id) {
                    return { error: "No active tab" };
                }

                // Navigate
                await chrome.tabs.update(activeTab.id, { url });

                // Wait with timeout handled inside waitForNavigation
                await waitForNavigation(activeTab.id, waitFor as 'load' | 'networkidle', timeoutMs);

                // Get final URL
                const updatedTab = await chrome.tabs.get(activeTab.id);

                return {
                    success: true,
                    finalUrl: updatedTab.url,
                    title: updatedTab.title
                };
            } catch (error) {
                log.error('[FrontendTool] Error in goAndWait:', error);
                return { error: `Navigation failed: ${(error as Error).message}` };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Navigating and Waiting" subtitle={args.url} state="loading" icon="⏳" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Navigation Failed" subtitle={result.error} state="error" icon="⏳" />;
                }
                return (
                    <ToolCard title="Navigation Complete" subtitle={result.finalUrl} state="success" icon="⏳">
                        {result.title && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>{result.title}</div>}
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
