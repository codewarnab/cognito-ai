import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

export function useWaitForPageLoadAction() {
    const log = createLogger("Actions-Primitives");

    useFrontendTool({
        name: "waitForPageLoad",
        description: "Wait until document.readyState is 'complete' or timeout",
        parameters: [
            { name: "timeoutMs", type: "number", description: "Timeout in milliseconds (default 10000)", required: false }
        ],
        handler: async ({ timeoutMs }) => {
            if (!shouldProcess("waitForPageLoad", { timeoutMs })) {
                return { skipped: true, reason: "duplicate" };
            }

            const timeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 10000;
            try {
                log.debug("waitForPageLoad", { timeout });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.id) return { error: "No active tab" };
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [timeout],
                    func: async (to: number) => {
                        if (document.readyState === 'complete') {
                            return { success: true, state: document.readyState };
                        }
                        return await new Promise((resolve) => {
                            const timer = setTimeout(() => { resolve({ success: false, timeout: true, state: document.readyState }); }, to);
                            const onLoad = () => { clearTimeout(timer); resolve({ success: true, state: 'complete' }); };
                            window.addEventListener('load', onLoad, { once: true });
                        });
                    }
                });
                return results[0]?.result || { error: "No result" };
            } catch (error) {
                log.error('[FrontendTool] Error waiting for page load:', error);
                return { error: "Failed waiting for page load" };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                const timeoutSec = ((args.timeoutMs || 10000) / 1000).toFixed(1);
                return <ToolCard title="Waiting for Page Load" subtitle={`Timeout: ${timeoutSec}s`} state="loading" icon="⏳" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Wait Failed" subtitle={result.error} state="error" icon="⏳" />;
                }
                if (result.timeout) {
                    return <ToolCard title="Page Load Timeout" subtitle={`State: ${result.state}`} state="error" icon="⏳" />;
                }
                return <ToolCard title="Page Loaded" subtitle="Document is ready" state="success" icon="⏳" />;
            }
            return null;
        },
    });
}
