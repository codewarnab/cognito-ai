/**
 * GetSearchResults Tool for AI SDK v5
 * Parse current Google/Bing search results page and return a structured ranked list with metadata
 */

import { z } from 'zod';
import { useEffect, useRef } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import type { ToolUIState } from '../../ai/tools/components';
import { CompactToolRenderer } from '../../ai/tools/components';
import { createLogger } from '../../logger';

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
            description: 'Parse current Google/Bing search results page and return a structured ranked list with metadata (title, href, hostname, snippet). Use this after navigating to a search engine to intelligently select which result to open. Do not use this on other websites.',
            parameters: z.object({
                maxResults: z.number()
                    .max(50)
                    .describe('Maximum number of results to return (default: 10)')
                    .default(10),
            }),
            validateContext: async () => {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    const url = tab?.url || '';
                    const isSearchPage = url.includes('google.com/search') || url.includes('bing.com/search');

                    if (!isSearchPage) {
                        return {
                            valid: false,
                            error: `Cannot use getSearchResults - not on a search page. Current URL: ${url}. You must first navigate to Google or Bing search using: navigateTo(url="https://www.google.com/search?q=YOUR_QUERY")`
                        };
                    }

                    return { valid: true };
                } catch (error) {
                    return { valid: false, error: `Failed to validate context: ${(error as Error).message}` };
                }
            },
            execute: async ({ maxResults = 10 }) => {
                if (!shouldProcess("getSearchResults", { maxResults })) {
                    return { skipped: true, reason: "duplicate" };
                }

                try {
                    log.info("TOOL CALL: getSearchResults", { maxResults });
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab?.id) return { error: "No active tab" };

                    // ⚠️ CRITICAL: Validate we're on a search page
                    const url = tab.url || '';
                    const isSearchPage = url.includes('google.com/search') || url.includes('bing.com/search');

                    if (!isSearchPage) {
                        log.warn("getSearchResults called on non-search page", { url });
                        return {
                            error: "NOT_ON_SEARCH_PAGE",
                            message: "This tool only works on Google or Bing search results pages. Please navigate to a search page first using navigateTo(url='https://www.google.com/search?q=YOUR_QUERY')",
                            currentUrl: url,
                            hint: "Navigate to google.com/search or bing.com/search first"
                        };
                    }

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [maxResults] as [number],
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
                                for (const [_i, h3] of blocks.entries()) {
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
                                for (const [_i, a] of blocks.entries()) {
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

        // Register UI with custom renderers
        registerToolUI('getSearchResults', (state: ToolUIState) => {
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
                    {input.maxResults !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Max Results:</span>
                            <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                {input.maxResults}
                            </span>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Found:</span>
                                <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                    {output.count} result{output.count !== 1 ? 's' : ''}
                                </span>
                                {output.engine && (
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '2px 6px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: '3px',
                                        border: '1px solid var(--border-color)',
                                        opacity: 0.9
                                    }}>
                                        {output.engine}
                                    </span>
                                )}
                            </div>
                            {output.results && output.results.length > 0 && (
                                <div style={{
                                    marginTop: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '3px'
                                }}>
                                    {output.results.slice(0, 2).map((result: any, i: number) => (
                                        <div key={i} style={{
                                            padding: '5px 8px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '3px',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '11px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <span style={{
                                                opacity: 0.7,
                                                fontSize: '10px',
                                                minWidth: '20px'
                                            }}>
                                                #{result.rank}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    color: 'var(--text-primary)',
                                                    opacity: 0.9,
                                                    fontSize: '11px',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {result.title}
                                                </div>
                                                <div style={{
                                                    color: 'var(--text-secondary)',
                                                    fontSize: '10px',
                                                    opacity: 0.6,
                                                    marginTop: '1px'
                                                }}>
                                                    {result.hostname}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {output.results.length > 2 && (
                                        <div style={{
                                            fontSize: '10px',
                                            opacity: 0.5,
                                            padding: '3px 6px',
                                            textAlign: 'center'
                                        }}>
                                            +{output.results.length - 2} more
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                    {output.error && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7, color: 'var(--error-color)' }}>
                                    {output.error === 'NOT_ON_SEARCH_PAGE' ? 'Not on search page' : output.error}
                                </span>
                            </div>
                            {output.message && (
                                <div style={{
                                    fontSize: '11px',
                                    opacity: 0.6,
                                    padding: '4px 6px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '3px',
                                    border: '1px solid var(--border-color)',
                                    marginTop: '2px'
                                }}>
                                    {output.message}
                                </div>
                            )}
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

        log.info('✅ getSearchResults tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up getSearchResults tool');
            unregisterToolUI('getSearchResults');
        };
    }, []); // Empty dependency array - only register once on mount
}

