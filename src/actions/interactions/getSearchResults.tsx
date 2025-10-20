/**
 * GetSearchResults Tool for AI SDK v5
 * Parse current Google/Bing search results page and return a structured ranked list with metadata
 */

import { z } from 'zod';
import { useEffect, useRef } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard, Badge } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-GetSearchResults');

/**
 * Hook to register the getSearchResults tool
 */
export function useGetSearchResultsTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();
    const lastCallRef = useRef<{ args: any; timestamp: number } | null>(null);

    const shouldProcess = (toolName: string, args: any) => {
        const now = Date.now();
        const last = lastCallRef.current;

        // Check if this is a duplicate call within 2 seconds
        if (last && now - last.timestamp < 2000) {
            const argsMatch = JSON.stringify(args) === JSON.stringify(last.args);
            if (argsMatch) {
                log.info(`Skipping duplicate ${toolName} call`, args);
                return false;
            }
        }

        lastCallRef.current = { args, timestamp: now };
        return true;
    };

    useEffect(() => {
        log.info('🔧 Registering getSearchResults tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'getSearchResults',
            description: 'Parse current Google/Bing search results page and return a structured ranked list with metadata (title, href, hostname, snippet). Use this after navigating to a search engine to intelligently select which result to open.',
            parameters: z.object({
                maxResults: z.number()
                    .max(50)
                    .describe('Maximum number of results to return (default: 10)')
                    .default(10),
            }),
            execute: async ({ maxResults = 10 }) => {
                if (!shouldProcess("getSearchResults", { maxResults })) {
                    return { skipped: true, reason: "duplicate" };
                }

                try {
                    log.info("TOOL CALL: getSearchResults", { maxResults });
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
                    log.error('[Tool] Error parsing search results:', error);
                    return { error: `Failed to parse search results: ${(error as Error).message}` };
                }
            },
        });

        // Register the UI renderer for this tool
        registerToolUI('getSearchResults', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard
                        title="Parsing Search Results"
                        subtitle={`Extracting up to ${input?.maxResults || 10} results`}
                        state="loading"
                        icon="🔍"
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard
                            title="Parse Failed"
                            subtitle={output.error}
                            state="error"
                            icon="🔍"
                        />
                    );
                }
                return (
                    <ToolCard
                        title="Search Results Parsed"
                        subtitle={`${output.count} results from ${output.engine}`}
                        state="success"
                        icon="🔍"
                    >
                        <div style={{ fontSize: '12px', marginTop: '8px' }}>
                            <Badge label={`${output.count} results`} variant="success" />
                            {output.results && output.results.length > 0 && (
                                <details className="tool-details" style={{ marginTop: '8px' }}>
                                    <summary>View top {Math.min(5, output.results.length)} results</summary>
                                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                                        {output.results.slice(0, 5).map((r: any, idx: number) => (
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

            if (toolState === 'output-error') {
                return (
                    <ToolCard
                        title="Parse Failed"
                        subtitle={state.errorText}
                        state="error"
                        icon="🔍"
                    />
                );
            }

            return null;
        });

        log.info('✅ getSearchResults tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up getSearchResults tool');
            unregisterToolUI('getSearchResults');
        };
    }, []); // Empty dependency array - only register once on mount
}
