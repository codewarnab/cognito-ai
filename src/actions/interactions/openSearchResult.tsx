/**
 * OpenSearchResult Tool for AI SDK v5
 * Open a specific search result by rank from the current Google/Bing search results page
 */

import { z } from 'zod';
import { useEffect, useRef } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

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
            description: 'Open a specific search result by rank (1-based index) from the current Google/Bing search results page. Must be called after getSearchResults to ensure results are available.',
            parameters: z.object({
                rank: z.number()
                    .min(1)
                    .describe('1-based rank of the result to open'),
            }),
            execute: async ({ rank }) => {
                if (!shouldProcess("openSearchResult", { rank })) {
                    return { skipped: true, reason: "duplicate" };
                }

                try {
                    log.info("TOOL CALL: openSearchResult", { rank });
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
