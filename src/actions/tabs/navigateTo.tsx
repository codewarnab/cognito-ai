/**
 * NavigateTo Tool for AI SDK v5
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 * 
 * Opens a URL in a new tab or current tab (without switching/redirecting)
 * For switching to existing tabs, use the switchTabs tool instead
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '../../logger';
import { useActionHelpers } from '../useActionHelpers';
import { CompactToolRenderer } from '../../ai/tools/components';
import type { ToolUIState } from '../../ai/tools/components';
import { safeTabCreate, safeTabsQuery, safeTabUpdate } from '../chromeApiHelpers';
import { BrowserAPIError } from '../../errors';

const log = createLogger('Tool-NavigateTo');

/**
 * Hook to register the navigateTo tool
 */
export function useNavigateToTool() {
    const { normalizeUrl, markOpened } = useActionHelpers();
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering navigateTo tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'navigateTo',
            description: 'Open a URL in a new tab or current tab. Use newTab parameter to control where the URL opens. This tool does NOT switch focus to existing tabs; use switchTabs for that instead.',
            parameters: z.object({
                url: z.string().describe('The URL to open'),
                newTab: z.boolean()
                    .describe('If true, opens URL in a new tab. If false, opens in the current tab. Defaults to true.')
                    .default(true),
            }),
            execute: async ({ url, newTab = true }) => {
                try {
                    log.info("TOOL CALL: openTab", { url, newTab });
                    const key = normalizeUrl(url);
                    markOpened(key);

                    if (newTab) {
                        // Open in new tab using safe helper
                        const tab = await safeTabCreate({ url });
                        log.info('📑 Opened URL in new tab', { tabId: tab.id, url });
                        return {
                            success: true,
                            action: 'opened_new_tab',
                            tabId: tab.id,
                            url: tab.url
                        };
                    } else {
                        // Open in current tab (update active tab)
                        const tabs = await safeTabsQuery({ active: true, currentWindow: true });
                        const currentTab = tabs[0];

                        if (!currentTab || currentTab.id === undefined) {
                            throw BrowserAPIError.tabNotFound(-1);
                        }

                        await safeTabUpdate(currentTab.id, { url });
                        log.info('🔄 Opened URL in current tab', { tabId: currentTab.id, url });
                        return {
                            success: true,
                            action: 'opened_current_tab',
                            tabId: currentTab.id,
                            url
                        };
                    }
                } catch (error) {
                    log.error('[Tool] Error opening tab:', error);

                    // Re-throw BrowserAPIError for proper display in CompactToolCard
                    if (error instanceof BrowserAPIError) {
                        throw error;
                    }

                    return {
                        error: error instanceof Error ? error.message : "Failed to open tab",
                        details: String(error)
                    };
                }
            },
        });

        // Register the UI renderer for this tool - uses CompactToolRenderer with custom renderers
        registerToolUI('navigateTo', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            // Optional: Custom input renderer for navigateTo tool
            renderInput: (input: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ opacity: 0.7 }}>URL:</span>
                    <a href={input.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--text-primary)', textDecoration: 'none', opacity: 0.9 }}>
                        {input.url}
                    </a>
                </div>
            ),
            // Optional: Custom output renderer for navigateTo tool
            renderOutput: (output: any) => (
                <a href={output.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: 'var(--text-primary)', textDecoration: 'none', opacity: 0.9 }}>
                    {output.url}
                </a>
            )
        });

        log.info('✅ openTab tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up navigateTo tool');
            unregisterToolUI('navigateTo');
        };
    }, []); // Empty dependency array - only register once on mount
}

