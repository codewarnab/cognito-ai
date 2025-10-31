/**
 * SwitchTabs Tool for AI SDK v5
 * Handles switching focus to an existing tab by URL or tab ID
 * This is separate from openTab which only opens new/current tabs
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { useActionHelpers } from '../useActionHelpers';
import { CompactToolRenderer } from '../../ai/CompactToolRenderer';
import type { ToolUIState } from '../../ai/ToolUIContext';
import { safeTabsQuery, safeTabUpdate } from '../chromeApiHelpers';
import { BrowserAPIError } from '../../errors';

const log = createLogger('Tool-SwitchTabs');

/**
 * Hook to register the switchTabs tool
 */
export function useSwitchTabsTool() {
    const { normalizeUrl, urlsEqual, focusTab } = useActionHelpers();
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering switchTabs tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'switchTabs',
            description: 'Switch focus to an ALREADY OPEN tab. CRITICAL: Use this ONLY for tabs that are already open in the browser. Can find tabs by URL (exact or partial match) or by tab ID. Brings the tab into focus and makes its window active. IMPORTANT: Always provide either a URL or tabId - do not call without parameters. If you have a tab ID from openSearchResult, use that for accurate switching.',
            parameters: z.object({
                url: z.string()
                    .describe('The URL to search for and switch to. Can be partial or full URL. Example: "github.com" or "https://github.com/user/repo"')
                    .optional(),
                tabId: z.number()
                    .describe('The specific tab ID to switch to. Use this if you have the tab ID from openSearchResult or other tools.')
                    .optional(),
            }).refine(
                (data) => data.url || data.tabId,
                { message: 'Either url or tabId must be provided - cannot call switchTabs without specifying which tab' }
            ),
            execute: async ({ url, tabId }) => {
                try {
                    log.info("TOOL CALL: switchTabs", { url, tabId });

                    let targetTab: chrome.tabs.Tab | undefined;

                    if (tabId) {
                        // Look up by tab ID using safe helper
                        const tabs = await safeTabsQuery({});
                        targetTab = tabs.find(t => t.id === tabId);

                        if (!targetTab) {
                            throw BrowserAPIError.tabNotFound(tabId);
                        }
                        log.info('📌 Found tab by ID', { tabId, url: targetTab.url });
                    } else if (url) {
                        // Look up by URL (exact or partial match)
                        const tabs = await safeTabsQuery({});

                        // First try exact match
                        targetTab = tabs.find(t => urlsEqual(t.url || '', url));

                        // If no exact match, try partial match
                        if (!targetTab) {
                            const lowerUrl = normalizeUrl(url);
                            targetTab = tabs.find(t => {
                                const tabUrl = normalizeUrl(t.url || '');
                                return tabUrl.includes(lowerUrl) || lowerUrl.includes(tabUrl);
                            });
                        }

                        if (!targetTab) {
                            // Return available tabs for debugging
                            const availableUrls = tabs
                                .filter(t => t.url)
                                .map(t => ({ id: t.id, url: t.url }))
                                .slice(0, 5);

                            return {
                                error: `No tab found matching URL: ${url}`,
                                availableTabsSample: availableUrls,
                                success: false
                            };
                        }
                        log.info('📌 Found tab by URL', { url, tabId: targetTab.id });
                    }

                    if (!targetTab) {
                        return {
                            error: 'No target tab determined',
                            success: false
                        };
                    }

                    // Focus the tab using safe helper
                    if (!targetTab.id) {
                        throw BrowserAPIError.tabNotFound(-1);
                    }

                    await safeTabUpdate(targetTab.id, { active: true });
                    if (targetTab.windowId) {
                        await chrome.windows.update(targetTab.windowId, { focused: true });
                    }

                    log.info('✅ Switched to tab', { tabId: targetTab.id, url: targetTab.url });

                    return {
                        success: true,
                        action: 'switched_tab',
                        tabId: targetTab.id,
                        url: targetTab.url,
                        title: targetTab.title
                    };

                } catch (error) {
                    log.error('[Tool] Error switching tabs:', error);

                    // Re-throw BrowserAPIError for proper display in CompactToolCard
                    if (error instanceof BrowserAPIError) {
                        throw error;
                    }

                    return {
                        error: error instanceof Error ? error.message : "Failed to switch tabs",
                        details: String(error),
                        success: false
                    };
                }
            },
        });

        // Register the UI renderer for this tool - uses CompactToolRenderer with custom renderers
        registerToolUI('switchTabs', (state: ToolUIState) => {
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
                    {input.url && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>URL:</span>
                            <a href={input.url} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--text-primary)', fontSize: '12px', textDecoration: 'none' }}>
                                {input.url}
                            </a>
                        </div>
                    )}
                    {input.tabId !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Tab ID:</span>
                            <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                {input.tabId}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Switched to:</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.title || 'Tab'}
                                </span>
                            </div>
                            {output.url && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', opacity: 0.7 }}>URL:</span>
                                    <a href={output.url} target="_blank" rel="noopener noreferrer"
                                        style={{ color: 'var(--text-primary)', fontSize: '12px', textDecoration: 'none' }}>
                                        {output.url}
                                    </a>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Tab ID:</span>
                                <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                    {output.tabId}
                                </span>
                            </div>
                        </>
                    )}
                    {output.error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7, color: 'var(--error-color)' }}>
                                {output.error}
                            </span>
                        </div>
                    )}
                    {output.availableTabsSample && (
                        <div style={{
                            marginTop: '4px',
                            fontSize: '11px',
                            opacity: 0.6,
                            borderTop: '1px solid var(--border-color)',
                            paddingTop: '6px'
                        }}>
                            <div>Available tabs (sample):</div>
                            {output.availableTabsSample.slice(0, 3).map((tab: any, i: number) => (
                                <div key={i} style={{ paddingLeft: '8px', marginTop: '2px' }}>
                                    ID {tab.id}: {tab.url}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )
        });

        log.info('✅ switchTabs tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up switchTabs tool');
            unregisterToolUI('switchTabs');
        };
    }, []); // Empty dependency array - only register once on mount
}
