import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { useActionHelpers } from "../useActionHelpers";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";
import { waitForNavigation } from "./navigationHelpers";

const log = createLogger("Actions-Tabs");

export function useEnsureAtUrl() {
    const { urlsEqual, focusTab } = useActionHelpers();

    useFrontendTool({
        name: "ensureAtUrl",
        description: "Ensure the active tab is at a specific URL. Navigates or reuses existing tab if same origin.",
        parameters: [
            { name: "url", type: "string", description: "Target URL", required: true },
            { name: "reuse", type: "boolean", description: "Reuse existing tab with same origin", required: false },
            { name: "waitFor", type: "string", description: "Wait strategy: 'load' or 'networkidle'", required: false },
            { name: "retries", type: "number", description: "Number of retries on failure", required: false }
        ],
        handler: async ({ url, reuse = true, waitFor = 'load', retries = 2 }) => {
            if (!shouldProcess("ensureAtUrl", { url })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                // validate retries
                let retriesValidated = 0;
                if (typeof retries === 'number' && Number.isFinite(retries)) {
                    retriesValidated = Math.max(0, Math.floor(retries));
                }

                const totalAttempts = retriesValidated + 1;

                log.info("ensureAtUrl", { url, reuse, waitFor, retries: retriesValidated, totalAttempts });

                let targetUrl: URL;
                try {
                    targetUrl = new URL(url);
                } catch (e) {
                    log.warn("ensureAtUrl received invalid URL", {
                        url,
                        error: e instanceof Error ? e.message : String(e)
                    });
                    return { error: "Invalid URL" };
                }
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

                if (!activeTab?.id) {
                    return { error: "No active tab" };
                }

                // Check if already at URL
                if (urlsEqual(activeTab.url || '', url)) {
                    return {
                        success: true,
                        navigated: false,
                        tabId: activeTab.id,
                        finalUrl: activeTab.url
                    };
                }

                // Helper: sleep with exponential backoff and jitter
                const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

                let lastError: unknown = null;
                for (let attempt = 1; attempt <= totalAttempts; attempt++) {
                    try {
                        // Check if we should reuse existing tab with same origin
                        if (reuse && activeTab.url) {
                            try {
                                const currentUrl = new URL(activeTab.url);
                                if (currentUrl.origin === targetUrl.origin) {
                                    // Same origin, update URL
                                    await chrome.tabs.update(activeTab.id, { url });

                                    // Wait for navigation
                                    await waitForNavigation(activeTab.id, waitFor as 'load' | 'networkidle');

                                    return {
                                        success: true,
                                        navigated: true,
                                        reused: true,
                                        tabId: activeTab.id,
                                        finalUrl: url,
                                        attempt
                                    };
                                }
                            } catch (_) {
                                // Invalid URL or origin check failed; fall through to normal navigation
                            }
                        }

                        // Check for existing tab with this URL
                        const allTabs = await chrome.tabs.query({});
                        const existing = allTabs.find(t => t.id !== activeTab.id && urlsEqual(t.url || '', url));

                        if (existing) {
                            await focusTab(existing);
                            return {
                                success: true,
                                navigated: false,
                                reused: true,
                                tabId: existing.id,
                                finalUrl: existing.url,
                                attempt
                            };
                        }

                        // Navigate active tab
                        await chrome.tabs.update(activeTab.id, { url });
                        await waitForNavigation(activeTab.id, waitFor as 'load' | 'networkidle');

                        const updatedTab = await chrome.tabs.get(activeTab.id);

                        return {
                            success: true,
                            navigated: true,
                            tabId: activeTab.id,
                            finalUrl: updatedTab.url,
                            attempt
                        };
                    } catch (attemptError) {
                        lastError = attemptError;
                        const remaining = totalAttempts - attempt;
                        if (remaining <= 0) break;
                        // exponential backoff with jitter: 300ms * 2^(attempt-1) +/- 20%
                        const base = 300 * Math.pow(2, attempt - 1);
                        const jitter = base * (0.2 * (Math.random() - 0.5) * 2);
                        const delay = Math.max(100, Math.floor(base + jitter));
                        log.warn('ensureAtUrl attempt failed; will retry', {
                            attempt,
                            remaining,
                            delayMs: delay,
                            error: attemptError instanceof Error ? attemptError.message : String(attemptError)
                        });
                        await sleep(delay);
                    }
                }

                // If we get here, all attempts failed
                throw lastError instanceof Error ? lastError : new Error('Unknown error after retries');
            } catch (error) {
                log.error('[FrontendTool] Error ensuring at URL:', {
                    error,
                    message: error instanceof Error ? error.message : String(error)
                });
                return {
                    error: `Failed to ensure at URL after retries: ${error instanceof Error ? error.message : String(error)}`
                };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Navigating to URL" subtitle={args.url} state="loading" icon="🧭" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Navigation Failed" subtitle={result.error} state="error" icon="🧭" />;
                }
                const action = result.navigated ? "Navigated" : result.reused ? "Reused existing tab" : "Already at URL";
                return <ToolCard title={action} subtitle={result.finalUrl} state="success" icon="🧭" />;
            }
            return null;
        },
    });
}
