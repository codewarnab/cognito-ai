/**
 * OpenSearchResult Tool for AI SDK v5
 * Open specific search results by rank from the current Google/Bing search results page
 * Supports opening single or multiple results in new tabs
 */

import { z } from 'zod';
import { useEffect, useRef } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';

const log = createLogger('Tool-OpenSearchResult');

/**
 * Hook to register the openSearchResult tool
 */
export function useOpenSearchResultTool() {
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
        log.info('🔧 Registering openSearchResult tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'openSearchResult',
            description: 'CRITICAL: This tool ONLY works on Google/Bing search results pages. Before calling, verify you are on a search page (google.com/search or bing.com/search). Open specific search result(s) by rank (1-based index). Can open single result or multiple results in new tabs. Must be called after getSearchResults. Example: rank: 2 opens result #2, ranks: [1, 3, 5] opens results #1, #3, and #5 in separate tabs.',
            parameters: z.object({
                rank: z.number()
                    .min(1)
                    .describe('1-based rank of a single result to open (use this OR ranks, not both)')
                    .optional(),
                ranks: z.array(z.number().min(1))
                    .describe('Array of 1-based ranks to open in new tabs (e.g., [1, 2, 3] opens top 3 results). Use this to open multiple sources at once.')
                    .optional(),
            }).refine(
                (data) => (data.rank !== undefined) !== (data.ranks !== undefined),
                { message: 'Provide either rank (single) OR ranks (multiple), not both' }
            ),
            execute: async ({ rank, ranks }) => {
                const ranksToOpen = ranks || (rank !== undefined ? [rank] : []);

                if (ranksToOpen.length === 0) {
                    return { error: "No ranks specified" };
                }

                if (!shouldProcess("openSearchResult", { rank, ranks })) {
                    return { skipped: true, reason: "duplicate" };
                }

                try {
                    log.info("TOOL CALL: openSearchResult", { rank, ranks, count: ranksToOpen.length });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab?.id) return { error: "No active tab" };

                    // First, verify we're on a search page
                    const pageCheck = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            const url = location.href;
                            const isGoogle = url.includes("google.") && url.includes("/search");
                            const isBing = url.includes("bing.") && url.includes("/search");
                            return {
                                isSearchPage: isGoogle || isBing,
                                currentUrl: url,
                                pageType: isGoogle ? 'google' : isBing ? 'bing' : 'unknown'
                            };
                        }
                    });

                    const pageInfo = pageCheck[0]?.result;
                    if (!pageInfo?.isSearchPage) {
                        return {
                            error: "NOT ON SEARCH PAGE! This tool only works on Google/Bing search results pages.",
                            currentUrl: pageInfo?.currentUrl,
                            hint: "Navigate to google.com/search or bing.com/search first, then call getSearchResults, then use this tool."
                        };
                    }

                    // Extract all requested results
                    const res = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [ranksToOpen],
                        func: (requestedRanks: number[]) => {
                            const url = location.href;
                            const normalize = (href: string) => {
                                try {
                                    const u = new URL(href);
                                    return u.href;
                                } catch {
                                    return href;
                                }
                            };

                            const results: Array<{ rank: number; href: string; title: string } | null> = [];

                            // Google SERP
                            if (url.includes("google.")) {
                                const h3s = Array.from(document.querySelectorAll("#search h3"));
                                let validIndex = 0;
                                const foundResults: Record<number, { href: string; title: string }> = {};

                                for (const h3 of h3s) {
                                    const a = h3.closest("a") as HTMLAnchorElement | null;
                                    if (!a || !a.href) continue;
                                    const href = normalize(a.href);
                                    if (href.includes("google.")) continue;
                                    validIndex++;

                                    if (requestedRanks.includes(validIndex)) {
                                        foundResults[validIndex] = {
                                            href,
                                            title: h3.textContent?.trim() || 'Untitled'
                                        };
                                    }
                                }

                                // Map results to requested order
                                for (const rank of requestedRanks) {
                                    if (foundResults[rank]) {
                                        results.push({ rank, ...foundResults[rank] });
                                    } else {
                                        results.push(null);
                                    }
                                }
                            }

                            // Bing SERP
                            else if (url.includes("bing.")) {
                                const anchors = Array.from(document.querySelectorAll("li.b_algo h2 a")) as HTMLAnchorElement[];
                                let validIndex = 0;
                                const foundResults: Record<number, { href: string; title: string }> = {};

                                for (const a of anchors) {
                                    const href = normalize(a.href);
                                    if (href.includes("bing.")) continue;
                                    validIndex++;

                                    if (requestedRanks.includes(validIndex)) {
                                        foundResults[validIndex] = {
                                            href,
                                            title: a.textContent?.trim() || 'Untitled'
                                        };
                                    }
                                }

                                // Map results to requested order
                                for (const rank of requestedRanks) {
                                    if (foundResults[rank]) {
                                        results.push({ rank, ...foundResults[rank] });
                                    } else {
                                        results.push(null);
                                    }
                                }
                            }

                            return results;
                        }
                    });

                    const extractedResults = res[0]?.result as Array<{ rank: number; href: string; title: string } | null>;

                    if (!extractedResults || extractedResults.length === 0) {
                        return { error: `No results found for ranks: ${ranksToOpen.join(', ')}` };
                    }

                    // Filter out nulls and open tabs
                    const validResults = extractedResults.filter((r): r is NonNullable<typeof r> => r !== null);

                    if (validResults.length === 0) {
                        return {
                            error: `No valid results found at ranks: ${ranksToOpen.join(', ')}`,
                            hint: "The requested ranks may be out of range. Try lower numbers."
                        };
                    }

                    const openedTabs: Array<{ rank: number; url: string; title: string; tabId: number }> = [];

                    // Open each result in a new tab
                    for (const result of validResults) {
                        const newTab = await chrome.tabs.create({
                            url: result.href,
                            active: false, // Don't steal focus
                            windowId: tab.windowId
                        });

                        if (newTab.id) {
                            openedTabs.push({
                                rank: result.rank,
                                url: result.href,
                                title: result.title,
                                tabId: newTab.id
                            });
                        }
                    }

                    log.info("openSearchResult: Opened tabs", {
                        count: openedTabs.length,
                        ranks: openedTabs.map(t => t.rank)
                    });

                    return {
                        success: true,
                        openedCount: openedTabs.length,
                        tabs: openedTabs,
                        message: `Opened ${openedTabs.length} search result(s) in new tabs. Use switchTabs and readPageContent to analyze each one.`
                    };

                } catch (error) {
                    log.error('[Tool] Error opening search result:', error);
                    return { error: `Failed to open search result: ${(error as Error).message}` };
                }
            },
        });

        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ openSearchResult tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up openSearchResult tool');
            unregisterToolUI('openSearchResult');
        };
    }, []); // Empty dependency array - only register once on mount
}

