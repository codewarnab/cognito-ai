/**
 * GetSearchResults Tool for AI SDK v5
 * Parse current Google/Bing search results page and return a structured ranked list with metadata
 */

import { z } from 'zod';
import { useEffect, useRef } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { startPageGlow, stopPageGlow } from '../../utils/pageGlowIndicator';

const log = createLogger('Tool-GetSearchResults');

/**
 * Hook to register the getSearchResults tool
 */
export function useGetSearchResultsTool() {
    const {  unregisterToolUI } = useToolUI();
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
            description: 'Search on Google with a query, open in new tab, and return structured ranked results with metadata (title, href, hostname, snippet).',
            parameters: z.object({
                query: z.string()
                    .describe('The search query to use on Google'),
                maxResults: z.number()
                    .max(50)
                    .describe('Maximum number of results to return (default: 10)')
                    .default(10),
            }),
            execute: async ({ query, maxResults = 10 }) => {
                if (!shouldProcess("getSearchResults", { query, maxResults })) {
                    return { skipped: true, reason: "duplicate" };
                }

                try {
                    log.info("TOOL CALL: getSearchResults", { query, maxResults });
                    
                    // Start the glow effect
                    startPageGlow();
                    
                    // Step 1: Navigate to Google with the query in a new tab
                    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                    const newTab = await chrome.tabs.create({ url: googleSearchUrl, active: true });
                    
                    if (!newTab?.id) {
                        stopPageGlow();
                        return { error: "Failed to create new tab" };
                    }
                    
                    log.info("Created new tab with Google search", { tabId: newTab.id, query });
                    
                    // Step 2: Wait for the page to load (give it 2 seconds)
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Step 3: Parse the search results from the new tab
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: newTab.id },
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
                    
                    stopPageGlow();
                    return result || { error: "No result" };
                } catch (error) {
                    log.error('[Tool] Error parsing search results:', error);
                    stopPageGlow();
                    return { error: `Failed to parse search results: ${(error as Error).message}` };
                }
            },
        });

        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ getSearchResults tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up getSearchResults tool');
            unregisterToolUI('getSearchResults');
        };
    }, []); // Empty dependency array - only register once on mount
}
