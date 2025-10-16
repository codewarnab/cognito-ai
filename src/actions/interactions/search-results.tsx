import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard, Badge } from "../../components/ui/ToolCard";

const log = createLogger("Actions-Interactions-Search");

export function registerSearchResultsInteractions() {
    useFrontendTool({
        name: "getSearchResults",
        description: "Parse current Google/Bing search results page and return a structured ranked list with metadata (title, href, hostname, snippet). Use this after navigating to a search engine to intelligently select which result to open.",
        parameters: [
            { name: "maxResults", type: "number", description: "Maximum number of results to return (default 10)", required: false }
        ],
        handler: async ({ maxResults = 10 }) => {
            if (!shouldProcess("getSearchResults", { maxResults })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("getSearchResults", { maxResults });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.id) return { error: "No active tab" };

                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [maxResults],
                    func: (limit: number) => {
                        const url = location.href;

                        const normalize = (href: string) => {
                            try {
                                const u = new URL(href);
                                return {
                                    href: u.href,
                                    hostname: u.hostname.replace(/^www\./i, ""),
                                    path: u.pathname,
                                };
                            } catch {
                                return { href, hostname: "", path: "" };
                            }
                        };

                        const items: Array<{
                            rank: number;
                            title: string;
                            href: string;
                            hostname: string;
                            path: string;
                            snippet?: string;
                        }> = [];

                        // Google SERP
                        if (url.includes("google.")) {
                            // Primary web results typically have an h3 with a containing anchor
                            const blocks = Array.from(document.querySelectorAll("#search h3"));
                            for (const [i, h3] of blocks.entries()) {
                                if (items.length >= limit) break;
                                const a = h3.closest("a") as HTMLAnchorElement | null;
                                if (!a || !a.href) continue;
                                const { href, hostname, path } = normalize(a.href);

                                // Skip Google internal links
                                if (hostname.includes("google.")) continue;

                                const snippetEl =
                                    h3.closest("div.g")?.querySelector(".VwiC3b, .Uroaid, .g7W9Dc") ||
                                    h3.parentElement?.parentElement?.querySelector(".VwiC3b");
                                const snippet = snippetEl?.textContent?.trim();
                                items.push({
                                    rank: items.length + 1,
                                    title: h3.textContent?.trim() || a.textContent?.trim() || "",
                                    href,
                                    hostname,
                                    path,
                                    snippet,
                                });
                            }

                            // Fallback if structure changes: collect visible anchors with h3 children
                            if (items.length === 0) {
                                const anchors = Array.from(document.querySelectorAll("#search a[href] h3"))
                                    .map((h3) => h3.parentElement as HTMLAnchorElement)
                                    .filter(Boolean) as HTMLAnchorElement[];
                                anchors.slice(0, limit).forEach((a) => {
                                    const { href, hostname, path } = normalize(a.href);
                                    if (hostname.includes("google.")) return;
                                    items.push({
                                        rank: items.length + 1,
                                        title: a.textContent?.trim() || "",
                                        href,
                                        hostname,
                                        path,
                                    });
                                });
                            }
                        }

                        // Bing SERP
                        if (url.includes("bing.")) {
                            const blocks = Array.from(document.querySelectorAll("li.b_algo h2 a"));
                            for (const [i, a] of blocks.entries()) {
                                if (items.length >= limit) break;
                                const { href, hostname, path } = normalize((a as HTMLAnchorElement).href);
                                if (hostname.includes("bing.")) continue;

                                const snippetEl = (a as HTMLElement).closest("li.b_algo")?.querySelector(".b_caption p");
                                items.push({
                                    rank: items.length + 1,
                                    title: a.textContent?.trim() || "",
                                    href,
                                    hostname,
                                    path,
                                    snippet: snippetEl?.textContent?.trim(),
                                });
                            }
                        }

                        return {
                            success: true,
                            engine: url.includes("bing.") ? "bing" : url.includes("google.") ? "google" : "unknown",
                            count: items.length,
                            results: items
                        };
                    }
                });

                const result = results[0]?.result;
                if (result?.success) {
                    log.info("getSearchResults success", { engine: result.engine, count: result.count });
                } else {
                    log.warn("getSearchResults failed", result);
                }
                return result || { error: "No result" };
            } catch (error) {
                log.error('[FrontendTool] Error parsing search results:', error);
                return { error: `Failed to parse search results: ${(error as Error).message}` };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Parsing Search Results" subtitle={`Extracting up to ${args.maxResults || 10} results`} state="loading" icon="🔍" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Parse Failed" subtitle={result.error} state="error" icon="🔍" />;
                }
                return (
                    <ToolCard
                        title="Search Results Parsed"
                        subtitle={`${result.count} results from ${result.engine}`}
                        state="success"
                        icon="🔍"
                    >
                        <div style={{ fontSize: '12px', marginTop: '8px' }}>
                            <Badge label={`${result.count} results`} variant="success" />
                            {result.results && result.results.length > 0 && (
                                <details className="tool-details" style={{ marginTop: '8px' }}>
                                    <summary>View top {Math.min(5, result.results.length)} results</summary>
                                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                                        {result.results.slice(0, 5).map((r: any, idx: number) => (
                                            <div key={idx} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
                                                <div style={{ fontWeight: 'bold' }}>#{r.rank}: {r.title}</div>
                                                <div style={{ opacity: 0.7, fontSize: '10px' }}>{r.hostname}{r.path}</div>
                                                {r.snippet && <div style={{ opacity: 0.6, marginTop: '2px' }}>{r.snippet.substring(0, 100)}...</div>}
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>
                    </ToolCard>
                );
            }
            return null;
        },
    });

    useFrontendTool({
        name: "openSearchResult",
        description: "Open a specific search result by rank (1-based index) from the current Google/Bing search results page. Must be called after getSearchResults to ensure results are available.",
        parameters: [
            { name: "rank", type: "number", description: "1-based rank of the result to open", required: true }
        ],
        handler: async ({ rank }) => {
            if (!shouldProcess("openSearchResult", { rank })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("openSearchResult", { rank });
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.id) return { error: "No active tab" };

                const res = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    args: [rank],
                    func: (r: number) => {
                        const url = location.href;
                        const normalize = (href: string) => {
                            try {
                                const u = new URL(href);
                                return u.href;
                            } catch {
                                return href;
                            }
                        };

                        // Google SERP
                        if (url.includes("google.")) {
                            const h3s = Array.from(document.querySelectorAll("#search h3"));
                            let validIndex = 0;
                            for (const h3 of h3s) {
                                const a = h3.closest("a") as HTMLAnchorElement | null;
                                if (!a || !a.href) continue;
                                const href = normalize(a.href);
                                if (href.includes("google.")) continue;
                                validIndex++;
                                if (validIndex === r) {
                                    return { href, title: h3.textContent?.trim() };
                                }
                            }
                        }

                        // Bing SERP
                        if (url.includes("bing.")) {
                            const anchors = Array.from(document.querySelectorAll("li.b_algo h2 a")) as HTMLAnchorElement[];
                            let validIndex = 0;
                            for (const a of anchors) {
                                const href = normalize(a.href);
                                if (href.includes("bing.")) continue;
                                validIndex++;
                                if (validIndex === r) {
                                    return { href, title: a.textContent?.trim() };
                                }
                            }
                        }

                        return null;
                    }
                });

                const data = res[0]?.result as { href: string; title: string } | null;
                if (!data?.href) {
                    log.warn("openSearchResult: No result at rank", { rank });
                    return { error: `No result found at rank ${rank}` };
                }

                log.info("openSearchResult: Navigating to", { rank, href: data.href, title: data.title });
                await chrome.tabs.update(tab.id, { url: data.href });
                return { success: true, rank, url: data.href, title: data.title };
            } catch (error) {
                log.error('[FrontendTool] Error opening search result:', error);
                return { error: `Failed to open search result: ${(error as Error).message}` };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Opening Search Result" subtitle={`Rank #${args.rank}`} state="loading" icon="🔗" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Open Failed" subtitle={result.error} state="error" icon="🔗" />;
                }
                return (
                    <ToolCard
                        title="Search Result Opened"
                        subtitle={result.title || result.url}
                        state="success"
                        icon="🔗"
                    >
                        <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>
                            Rank #{result.rank}: {result.url}
                        </div>
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
