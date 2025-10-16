import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard, Badge } from "../../components/ui/ToolCard";

export function useWaitForSelectorAction() {
    const log = createLogger("Actions-Primitives");

    useFrontendTool({
        name: "waitForSelector",
        description: "Wait for an element matching selector to exist (optionally visible)",
        parameters: [
            { name: "selector", type: "string", description: "CSS selector", required: true },
            { name: "timeoutMs", type: "number", description: "Timeout in milliseconds (default 10000)", required: false },
            { name: "visibleOnly", type: "boolean", description: "If true, require element to be visible", required: false }
        ],
        handler: async ({ selector, timeoutMs, visibleOnly }) => {
            if (!shouldProcess("waitForSelector", { selector, timeoutMs, visibleOnly })) {
                return { skipped: true, reason: "duplicate" };
            }

            const timeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 10000;
            const requireVisible = Boolean(visibleOnly);
            try {
                log.debug("waitForSelector", { selector, timeout, requireVisible });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.id) return { error: "No active tab" };
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [selector, timeout, requireVisible],
                    func: async (sel: string, to: number, visOnly: boolean) => {
                        const isVisible = (el: Element) => {
                            const rect = (el as HTMLElement).getBoundingClientRect();
                            const style = window.getComputedStyle(el as HTMLElement);
                            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                        };
                        const found = document.querySelector(sel);
                        if (found && (!visOnly || isVisible(found))) {
                            return { success: true };
                        }
                        return await new Promise((resolve) => {
                            const timer = setTimeout(() => { observer.disconnect(); resolve({ success: false, timeout: true }); }, to);
                            const observer = new MutationObserver(() => {
                                const el = document.querySelector(sel);
                                if (el && (!visOnly || isVisible(el))) {
                                    clearTimeout(timer);
                                    observer.disconnect();
                                    resolve({ success: true });
                                }
                            });
                            observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
                        });
                    }
                });
                return results[0]?.result || { error: "No result" };
            } catch (error) {
                log.error('[FrontendTool] Error waiting for selector:', error);
                return { error: "Failed waiting for selector" };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                const timeoutSec = ((args.timeoutMs || 10000) / 1000).toFixed(1);
                return (
                    <ToolCard title="Waiting for Element" subtitle={args.selector} state="loading" icon="🎯">
                        {args.visibleOnly && <Badge label="visible only" variant="default" />}
                        <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Timeout: {timeoutSec}s</div>
                    </ToolCard>
                );
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Wait Failed" subtitle={result.error} state="error" icon="🎯" />;
                }
                if (result.timeout) {
                    return <ToolCard title="Element Not Found" subtitle={`Selector: ${args.selector}`} state="error" icon="🎯" />;
                }
                return <ToolCard title="Element Found" subtitle={args.selector} state="success" icon="🎯" />;
            }
            return null;
        },
    });
}
