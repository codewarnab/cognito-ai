/**
 * OpenSearchResult Tool for AI SDK v5
 * Open specific search results by rank from the current Google/Bing search results page
 * Supports opening single or multiple results in new tabs
 */

import { z } from 'zod';
import { useEffect, useRef } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import type { ToolUIState } from '@/ai/tools/components';
import { CompactToolRenderer } from '@/ai/tools/components';
import { createLogger } from '~logger';

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
            description: `Open search result(s) from Google/Bing by rank. Opens in background tabs, returns tabIds for switching.
USE: After getSearchResults to open relevant results (e.g., "open first result", "open top 3"). For multi-tab research workflows.
REQUIRES: Must be on google.com/search or bing.com/search. Call getSearchResults first. Ranks are 1-based.
WORKFLOW: getSearchResults → analyze → openSearchResult(ranks) → switchTabs → readPageContent/takeScreenshot
LIMITS: Google/Bing only. 1-based ranks. Background tabs. Can't exceed available results.
EXAMPLE: ranks=[1,2,3] opens top 3, returns [{rank:1, tabId:123, url:"..."}]`,
            parameters: z.object({
                rank: z.number()
                    .min(1)
                    .describe('1-based rank of a single result to open. Example: rank=1 opens the first result, rank=5 opens the fifth result. Use this when opening just one result. Cannot use with ranks parameter.')
                    .optional(),
                ranks: z.array(z.number().min(1))
                    .describe('Array of 1-based ranks to open multiple results in separate tabs. Example: [1, 2, 3] opens top 3 results, [1, 5, 10] opens results #1, #5, and #10. Use this for research workflows. Cannot use with rank parameter.')
                    .optional(),
            }).refine(
                (data) => (data.rank !== undefined) !== (data.ranks !== undefined),
                { message: 'Provide either rank (single) OR ranks (multiple), not both' }
            ),
            validateContext: async () => {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    const url = tab?.url || '';
                    const isSearchPage = (url.includes('google.com') && url.includes('/search')) ||
                        (url.includes('bing.com') && url.includes('/search'));

                    if (!isSearchPage) {
                        return {
                            valid: false,
                            error: `Cannot use openSearchResult - not on a search page. Current URL: ${url}. You must first navigate to Google or Bing search using: navigateTo(url="https://www.google.com/search?q=YOUR_QUERY"), then call getSearchResults, then use this tool.`
                        };
                    }

                    return { valid: true };
                } catch (error) {
                    return { valid: false, error: `Failed to validate context: ${(error as Error).message}` };
                }
            },
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

                            // Google SERP with fallback selectors
                            if (url.includes("google.")) {
                                let h3s: Element[] = [];

                                // Try multiple selectors in order of reliability
                                const selectors = [
                                    "h3.LC20lb",           // Modern Google class
                                    ".g h3",                // Container-based selector
                                    "[role='heading'] h3",  // ARIA-based selector
                                    "#search h3"            // Fallback to original
                                ];

                                for (const selector of selectors) {
                                    try {
                                        h3s = Array.from(document.querySelectorAll(selector));
                                        if (h3s.length > 0) break;
                                    } catch (e) {
                                        console.debug(`Selector failed: ${selector}`, e);
                                    }
                                }

                                if (h3s.length === 0) {
                                    console.warn('[SERP] No Google results found with any selector');
                                }

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

                                if (validIndex < requestedRanks.length) {
                                    console.warn(`[SERP] Google extracted ${validIndex} results, requested ${requestedRanks.length}`);
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

                            // Bing SERP with fallback selectors
                            else if (url.includes("bing.")) {
                                let anchors: HTMLAnchorElement[] = [];

                                // Try multiple selectors
                                const selectors = [
                                    "li.b_algo h2 a",      // Primary Bing selector
                                    "li.b_algo a",         // Alternative within result container
                                    ".b_title a",          // Title class fallback
                                    "[role='heading'] a"   // ARIA-based fallback
                                ];

                                for (const selector of selectors) {
                                    try {
                                        anchors = Array.from(document.querySelectorAll(selector)) as HTMLAnchorElement[];
                                        if (anchors.length > 0) break;
                                    } catch (e) {
                                        console.debug(`Bing selector failed: ${selector}`, e);
                                    }
                                }

                                if (anchors.length === 0) {
                                    console.warn('[SERP] No Bing results found with any selector');
                                }

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

                                if (validIndex < requestedRanks.length) {
                                    console.warn(`[SERP] Bing extracted ${validIndex} results, requested ${requestedRanks.length}`);
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

        // Register UI with custom renderers
        registerToolUI('openSearchResult', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    {input.rank !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Rank:</span>
                            <span style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                opacity: 0.9,
                                background: 'var(--bg-tertiary)',
                                borderRadius: '3px',
                                border: '1px solid var(--border-color)'
                            }}>
                                #{input.rank}
                            </span>
                        </div>
                    )}
                    {input.ranks !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Ranks:</span>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {input.ranks.map((r: number, i: number) => (
                                    <span key={i} style={{
                                        fontSize: '11px',
                                        padding: '2px 6px',
                                        opacity: 0.9,
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: '3px',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        #{r}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    {output.success && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Opened:</span>
                                <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                    {output.openedCount} tab{output.openedCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                            {output.tabs && output.tabs.length > 0 && (
                                <div style={{
                                    marginTop: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}>
                                    {output.tabs.map((tab: any, i: number) => (
                                        <div key={i} style={{
                                            padding: '6px 8px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '11px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                <span style={{
                                                    opacity: 0.7,
                                                    background: 'var(--bg-primary)',
                                                    padding: '1px 4px',
                                                    borderRadius: '2px'
                                                }}>
                                                    #{tab.rank}
                                                </span>
                                                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                                    {tab.title}
                                                </span>
                                            </div>
                                            <a href={tab.url} target="_blank" rel="noopener noreferrer"
                                                style={{
                                                    color: 'var(--text-secondary)',
                                                    fontSize: '10px',
                                                    textDecoration: 'none',
                                                    opacity: 0.7,
                                                    display: 'block',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                {tab.url}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {output.error && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7, color: 'var(--error-color)' }}>
                                    {output.error}
                                </span>
                            </div>
                            {output.hint && (
                                <div style={{
                                    fontSize: '11px',
                                    opacity: 0.6,
                                    padding: '4px 6px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '3px',
                                    border: '1px solid var(--border-color)',
                                    marginTop: '2px'
                                }}>
                                    💡 {output.hint}
                                </div>
                            )}
                        </>
                    )}
                    {output.skipped && (
                        <div style={{ fontSize: '11px', opacity: 0.6 }}>
                            Skipped (duplicate call)
                        </div>
                    )}
                </div>
            )
        });

        log.info('✅ openSearchResult tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up openSearchResult tool');
            unregisterToolUI('openSearchResult');
        };
    }, []); // Empty dependency array - only register once on mount
}



