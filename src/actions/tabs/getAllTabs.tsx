/**
 * GetAllTabs Tool for AI SDK v5
 * 
 * Gets information about all open browser tabs
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import type { ToolUIState } from '../../ai/tools/components';
import { tabManager } from './TabManager';

const log = createLogger('Tool-GetAllTabs');

/**
 * Hook to register the getAllTabs tool
 */
export function useGetAllTabs() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering getAllTabs tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'getAllTabs',
            description: `Get all open tabs across browser windows with titles, URLs, IDs, and active status.
USE WHEN: User asks "what tabs open?", "show/list tabs", analyzing tabs before organizing/closing, finding specific tab, before organizeTabsByContext.
RETURNS: List with id, title, url, active, windowId, index. Use IDs with switchTabs/other tools.
LIMITS: Returns all tabs (may be large), no filtering (use chromeSearch), includes all windows.
EXAMPLE: getAllTabs() -> {count: 15, tabs: [{id: 123, title: "GitHub", url: "...", active: true}, ...]}`,
            parameters: z.object({}),
            execute: async () => {
                try {
                    log.info("TOOL CALL: getAllTabs");

                    // Use TabManager for O(1) cached access with real-time sync
                    const tabs = await tabManager.getAllTabs();

                    if (!tabs || tabs.length === 0) {
                        log.warn("No tabs found");
                        return {
                            success: true,
                            tabs: [],
                            count: 0,
                            message: "No tabs currently open"
                        };
                    }

                    // Map tabs to a cleaner format
                    const tabList = tabs.map(tab => ({
                        id: tab.id,
                        title: tab.title || 'Untitled',
                        url: tab.url || '',
                        active: tab.active || false,
                        windowId: tab.windowId,
                        index: tab.index
                    }));

                    const stats = tabManager.getStats();
                    log.info('✅ Retrieved all tabs from cache', {
                        count: tabs.length,
                        domains: stats.totalDomains
                    });

                    return {
                        success: true,
                        tabs: tabList,
                        count: tabs.length
                    };
                } catch (error) {
                    log.error('[Tool] Error getting all tabs:', error);
                    return {
                        success: false,
                        error: "Failed to get all tabs",
                        details: String(error),
                        tabs: [],
                        count: 0
                    };
                }
            },
        });

        // Register UI with custom renderers
        registerToolUI('getAllTabs', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
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
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Total tabs:</span>
                                <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                    {output.count}
                                </span>
                            </div>
                            {output.tabs && output.tabs.length > 0 && (
                                <div style={{
                                    marginTop: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '3px'
                                }}>
                                    {output.tabs.slice(0, 3).map((tab: any, i: number) => (
                                        <div key={i} style={{
                                            padding: '5px 8px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '3px',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '11px'
                                        }}>
                                            <div style={{
                                                color: 'var(--text-primary)',
                                                opacity: 0.9,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                marginBottom: '2px'
                                            }}>
                                                {tab.active && <span style={{ opacity: 0.6, marginRight: '4px' }}>●</span>}
                                                {tab.title}
                                            </div>
                                            <div style={{
                                                fontSize: '10px',
                                                opacity: 0.6,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {tab.url}
                                            </div>
                                        </div>
                                    ))}
                                    {output.tabs.length > 3 && (
                                        <div style={{
                                            fontSize: '10px',
                                            opacity: 0.5,
                                            padding: '3px 6px',
                                            textAlign: 'center'
                                        }}>
                                            +{output.tabs.length - 3} more
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
                                    {output.error}
                                </span>
                            </div>
                            {output.details && (
                                <div style={{
                                    fontSize: '11px',
                                    opacity: 0.6,
                                    padding: '4px 6px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '3px',
                                    border: '1px solid var(--border-color)',
                                    marginTop: '2px'
                                }}>
                                    {output.details}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )
        });

        log.info('✅ getAllTabs tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up getAllTabs tool');
            unregisterToolUI('getAllTabs');
        };
    }, []); // Empty dependency array - only register once on mount
}


